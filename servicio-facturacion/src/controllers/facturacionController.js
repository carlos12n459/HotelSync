const pool = require("../config/baseDeDatos");
const reservasClient = require("../clientes/reservasClient");
const { registrarEventoSaliente } = require("../eventos/eventosOutbox");

/** GET /api/facturacion/folios */
async function listarFolios(req, res) {
  try {
    const [filas] = await pool.query("SELECT * FROM folios ORDER BY id DESC");
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron listar los folios", detalle: error.message });
  }
}

/** GET /api/facturacion/folios/:id */
async function obtenerFolio(req, res) {
  try {
    const folioId = Number(req.params.id);
    const [folios] = await pool.query("SELECT * FROM folios WHERE id = ?", [folioId]);
    if (folios.length === 0) {
      return res.status(404).json({ error: "Folio no encontrado" });
    }

    const [cargos] = await pool.query("SELECT * FROM cargos WHERE folio_id = ? ORDER BY id ASC", [folioId]);
    const [pagos] = await pool.query("SELECT * FROM pagos WHERE folio_id = ? ORDER BY id ASC", [folioId]);

    res.json({ folio: folios[0], cargos, pagos });
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener el folio", detalle: error.message });
  }
}

/** POST /api/facturacion/folios/:folio_id/cargos */
async function agregarCargo(req, res) {
  const folioId = Number(req.params.folio_id);
  const { concepto, cantidad, precio_unitario } = req.body;

  if (!concepto || cantidad === undefined || cantidad === null || precio_unitario === undefined || precio_unitario === null) {
    return res.status(400).json({ error: "concepto, cantidad y precio_unitario son obligatorios" });
  }

  const cantidadNum = Number(cantidad);
  const precioNum = Number(precio_unitario);
  const totalCargo = cantidadNum * precioNum;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [folios] = await conn.query("SELECT * FROM folios WHERE id = ? FOR UPDATE", [folioId]);
    if (folios.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: "Folio no encontrado" });
    }
    const folio = folios[0];
    if (folio.estado === "cerrado") {
      await conn.rollback();
      conn.release();
      return res.status(409).json({ error: "No se pueden agregar cargos a un folio cerrado" });
    }

    const [cargoResult] = await conn.query(
      "INSERT INTO cargos (folio_id, concepto, cantidad, precio_unitario, total) VALUES (?, ?, ?, ?, ?)",
      [folioId, concepto, cantidadNum, precioNum, totalCargo]
    );

    const [suma] = await conn.query(
      "SELECT COALESCE(SUM(total), 0) AS total_cargos FROM cargos WHERE folio_id = ?",
      [folioId]
    );
    const totalCargos = Number(suma[0].total_cargos);
    const totalImpuestos = Number(folio.total_impuestos);

    await conn.query(
      "UPDATE folios SET total_cargos = ?, total = ? WHERE id = ?",
      [totalCargos, totalCargos + totalImpuestos, folioId]
    );

    await registrarEventoSaliente("charge.added", {
      folio_id: folioId,
      reserva_id: folio.reserva_id,
      cargo_id: cargoResult.insertId,
      concepto,
      cantidad: cantidadNum,
      precio_unitario: precioNum,
      total: totalCargo,
      timestamp: new Date().toISOString()
    });

    await conn.commit();
    conn.release();

    const [cargo] = await pool.query("SELECT * FROM cargos WHERE id = ?", [cargoResult.insertId]);
    res.status(201).json(cargo[0]);
  } catch (error) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ error: "No se pudo agregar el cargo", detalle: error.message });
  }
}

/** POST /api/facturacion/folios/:folio_id/pagos */
async function registrarPago(req, res) {
  const folioId = Number(req.params.folio_id);
  const { monto, metodo, referencia } = req.body;

  if (monto === undefined || monto === null || !metodo) {
    return res.status(400).json({ error: "monto y metodo son obligatorios" });
  }

  const montoNum = Number(monto);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [folios] = await conn.query("SELECT * FROM folios WHERE id = ? FOR UPDATE", [folioId]);
    if (folios.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: "Folio no encontrado" });
    }
    const folio = folios[0];

    const [pagoResult] = await conn.query(
      "INSERT INTO pagos (folio_id, monto, metodo, referencia) VALUES (?, ?, ?, ?)",
      [folioId, montoNum, metodo, referencia || null]
    );

    await registrarEventoSaliente("payment.processed", {
      folio_id: folioId,
      reserva_id: folio.reserva_id,
      pago_id: pagoResult.insertId,
      monto: montoNum,
      metodo,
      referencia: referencia || null,
      timestamp: new Date().toISOString()
    });

    await conn.commit();
    conn.release();

    const [pago] = await pool.query("SELECT * FROM pagos WHERE id = ?", [pagoResult.insertId]);
    res.status(201).json(pago[0]);
  } catch (error) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ error: "No se pudo registrar el pago", detalle: error.message });
  }
}

/** POST /api/facturacion/folios/:folio_id/cerrar */
async function cerrarFolio(req, res) {
  const folioId = Number(req.params.folio_id);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [folios] = await conn.query("SELECT * FROM folios WHERE id = ? FOR UPDATE", [folioId]);
    if (folios.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: "Folio no encontrado" });
    }
    const folio = folios[0];
    if (folio.estado === "cerrado") {
      await conn.rollback();
      conn.release();
      return res.status(409).json({ error: "El folio ya esta cerrado" });
    }
    if (folio.estado === "cancelado") {
      await conn.rollback();
      conn.release();
      return res.status(409).json({ error: "No se puede cerrar un folio cancelado" });
    }

    const [suma] = await conn.query(
      "SELECT COALESCE(SUM(total), 0) AS total_cargos FROM cargos WHERE folio_id = ?",
      [folioId]
    );
    const totalCargos = Number(suma[0].total_cargos);
    const totalImpuestos = Number(folio.total_impuestos);
    const totalFinal = totalCargos + totalImpuestos;

    const numeroFactura = `FAC-${folioId}-${Date.now()}`;
    const [facturaResult] = await conn.query(
      "INSERT INTO facturas (folio_id, numero, reserva_id, total, moneda) VALUES (?, ?, ?, ?, ?)",
      [folioId, numeroFactura, folio.reserva_id, totalFinal, folio.moneda || "COP"]
    );

    await conn.query(
      "UPDATE folios SET estado = 'cerrado', cerrado_en = NOW(), total_cargos = ?, total = ? WHERE id = ?",
      [totalCargos, totalFinal, folioId]
    );

    await conn.commit();
    conn.release();

    const [factura] = await pool.query("SELECT * FROM facturas WHERE id = ?", [facturaResult.insertId]);
    res.json(factura[0]);
  } catch (error) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ error: "No se pudo cerrar el folio", detalle: error.message });
  }
}

/** GET /api/facturacion/facturas */
async function listarFacturas(req, res) {
  try {
    const [filas] = await pool.query("SELECT * FROM facturas ORDER BY id DESC");
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron listar las facturas", detalle: error.message });
  }
}

/**
 * Procesa un evento checkout.completed proveniente del outbox de recepcion.
 * Crea el folio de la reserva con un cargo por hospedaje y lo cierra
 * emitiendo la factura final.
 */
async function procesarCheckoutCompletado(evento) {
  const payload = typeof evento.payload === "string" ? JSON.parse(evento.payload) : evento.payload;
  const reservaId = Number(payload.reserva_id);

  let reserva;
  try {
    reserva = await reservasClient.consultarReservaPorId(reservaId);
  } catch (error) {
    console.warn(`[facturacion] No se pudo consultar la reserva ${reservaId}:`, error.message);
    return false;
  }

  if (!reserva) {
    console.warn(`[facturacion] Reserva ${reservaId} no encontrada; se omite el evento ${evento.id}`);
    return true;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existentes] = await conn.query("SELECT id FROM folios WHERE reserva_id = ?", [reserva.id]);
    if (existentes.length > 0) {
      await conn.commit();
      conn.release();
      console.log(`[facturacion] Ya existe un folio para la reserva ${reserva.id}; se omite`);
      return true;
    }

    const montoTotal = Number(reserva.monto_total);
    const hotelId = reserva.hotel_id || payload.hotel_id || null;
    const huespedId = reserva.guest_id || null;

    const [folioResult] = await conn.query(
      `INSERT INTO folios
        (reserva_id, hotel_id, huesped_id, moneda, estado, total_cargos, total_impuestos, total, cerrado_en)
       VALUES (?, ?, ?, 'COP', 'cerrado', ?, 0, ?, NOW())`,
      [reserva.id, hotelId, huespedId, montoTotal, montoTotal]
    );
    const folioId = folioResult.insertId;

    await conn.query(
      "INSERT INTO cargos (folio_id, concepto, cantidad, precio_unitario, total) VALUES (?, 'Hospedaje', 1, ?, ?)",
      [folioId, montoTotal, montoTotal]
    );

    const numeroFactura = `FAC-${folioId}-${Date.now()}`;
    await conn.query(
      "INSERT INTO facturas (folio_id, numero, reserva_id, total, moneda) VALUES (?, ?, ?, ?, 'COP')",
      [folioId, numeroFactura, reserva.id, montoTotal]
    );

    await conn.commit();
    conn.release();

    console.log(`[facturacion] Folio #${folioId} cerrado y factura ${numeroFactura} emitida para reserva #${reserva.id}`);
    return true;
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error(`[facturacion] Error al procesar checkout.completed de reserva ${reservaId}:`, error.message);
    return false;
  }
}

module.exports = {
  listarFolios,
  obtenerFolio,
  agregarCargo,
  registrarPago,
  cerrarFolio,
  listarFacturas,
  procesarCheckoutCompletado
};
