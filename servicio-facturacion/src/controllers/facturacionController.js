const pool = require("../config/baseDeDatos");
const reservasClient = require("../clientes/reservasClient");
const { publish, consume } = require("../eventos/rabbitmq");

/** GET /api/facturacion/folios */
async function listarFolios(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM folios ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron listar los folios", detalle: error.message });
  }
}

/** GET /api/facturacion/folios/:id */
async function obtenerFolio(req, res) {
  try {
    const folioId = Number(req.params.id);
    const { rows: folios } = await pool.query("SELECT * FROM folios WHERE id = $1", [folioId]);
    if (folios.length === 0) {
      return res.status(404).json({ error: "Folio no encontrado" });
    }

    const { rows: cargos } = await pool.query("SELECT * FROM cargos WHERE folio_id = $1 ORDER BY id ASC", [folioId]);
    const { rows: pagos } = await pool.query("SELECT * FROM pagos WHERE folio_id = $1 ORDER BY id ASC", [folioId]);

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

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const { rows: folios } = await cliente.query("SELECT * FROM folios WHERE id = $1 FOR UPDATE", [folioId]);
    if (folios.length === 0) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ error: "Folio no encontrado" });
    }
    const folio = folios[0];
    if (folio.estado === "cerrado") {
      await cliente.query("ROLLBACK");
      return res.status(409).json({ error: "No se pueden agregar cargos a un folio cerrado" });
    }

    const { rows: cargoResult } = await cliente.query(
      "INSERT INTO cargos (folio_id, concepto, cantidad, precio_unitario, total) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [folioId, concepto, cantidadNum, precioNum, totalCargo]
    );

    const { rows: suma } = await cliente.query(
      "SELECT COALESCE(SUM(total), 0) AS total_cargos FROM cargos WHERE folio_id = $1",
      [folioId]
    );
    const totalCargos = Number(suma[0].total_cargos);
    const totalImpuestos = Number(folio.total_impuestos);

    await cliente.query(
      "UPDATE folios SET total_cargos = $1, total = $2 WHERE id = $3",
      [totalCargos, totalCargos + totalImpuestos, folioId]
    );

    await cliente.query("COMMIT");

    await publish("charge.added", {
      folio_id: folioId,
      reserva_id: folio.reserva_id,
      cargo_id: cargoResult[0].id,
      concepto,
      cantidad: cantidadNum,
      precio_unitario: precioNum,
      total: totalCargo,
      timestamp: new Date().toISOString()
    });

    const { rows: cargo } = await pool.query("SELECT * FROM cargos WHERE id = $1", [cargoResult[0].id]);
    res.status(201).json(cargo[0]);
  } catch (error) {
    await cliente.query("ROLLBACK");
    res.status(500).json({ error: "No se pudo agregar el cargo", detalle: error.message });
  } finally {
    cliente.release();
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

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const { rows: folios } = await cliente.query("SELECT * FROM folios WHERE id = $1 FOR UPDATE", [folioId]);
    if (folios.length === 0) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ error: "Folio no encontrado" });
    }
    const folio = folios[0];

    const { rows: pagoResult } = await cliente.query(
      "INSERT INTO pagos (folio_id, monto, metodo, referencia) VALUES ($1, $2, $3, $4) RETURNING id",
      [folioId, montoNum, metodo, referencia || null]
    );

    await cliente.query("COMMIT");

    await publish("payment.processed", {
      folio_id: folioId,
      reserva_id: folio.reserva_id,
      pago_id: pagoResult[0].id,
      monto: montoNum,
      metodo,
      referencia: referencia || null,
      timestamp: new Date().toISOString()
    });

    const { rows: pago } = await pool.query("SELECT * FROM pagos WHERE id = $1", [pagoResult[0].id]);
    res.status(201).json(pago[0]);
  } catch (error) {
    await cliente.query("ROLLBACK");
    res.status(500).json({ error: "No se pudo registrar el pago", detalle: error.message });
  } finally {
    cliente.release();
  }
}

/** POST /api/facturacion/folios/:folio_id/cerrar */
async function cerrarFolio(req, res) {
  const folioId = Number(req.params.folio_id);

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const { rows: folios } = await cliente.query("SELECT * FROM folios WHERE id = $1 FOR UPDATE", [folioId]);
    if (folios.length === 0) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ error: "Folio no encontrado" });
    }
    const folio = folios[0];
    if (folio.estado === "cerrado") {
      await cliente.query("ROLLBACK");
      return res.status(409).json({ error: "El folio ya esta cerrado" });
    }
    if (folio.estado === "cancelado") {
      await cliente.query("ROLLBACK");
      return res.status(409).json({ error: "No se puede cerrar un folio cancelado" });
    }

    const { rows: suma } = await cliente.query(
      "SELECT COALESCE(SUM(total), 0) AS total_cargos FROM cargos WHERE folio_id = $1",
      [folioId]
    );
    const totalCargos = Number(suma[0].total_cargos);
    const totalImpuestos = Number(folio.total_impuestos);
    const totalFinal = totalCargos + totalImpuestos;

    const numeroFactura = `FAC-${folioId}-${Date.now()}`;
    const { rows: facturaResult } = await cliente.query(
      "INSERT INTO facturas (folio_id, numero, reserva_id, total, moneda) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [folioId, numeroFactura, folio.reserva_id, totalFinal, folio.moneda || "COP"]
    );

    await cliente.query(
      "UPDATE folios SET estado = 'cerrado', cerrado_en = CURRENT_TIMESTAMP, total_cargos = $1, total = $2 WHERE id = $3",
      [totalCargos, totalFinal, folioId]
    );

    await cliente.query("COMMIT");

    const { rows: factura } = await pool.query("SELECT * FROM facturas WHERE id = $1", [facturaResult[0].id]);
    res.json(factura[0]);
  } catch (error) {
    await cliente.query("ROLLBACK");
    res.status(500).json({ error: "No se pudo cerrar el folio", detalle: error.message });
  } finally {
    cliente.release();
  }
}

/** GET /api/facturacion/facturas */
async function listarFacturas(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM facturas ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron listar las facturas", detalle: error.message });
  }
}

/**
 * Procesa un evento checkout.completed proveniente de RabbitMQ.
 * Crea el folio de la reserva con un cargo por hospedaje y lo cierra
 * emitiendo la factura final.
 */
async function procesarCheckoutCompletado(payload) {
  const reservaId = Number(payload.reserva_id);

  let reserva;
  try {
    reserva = await reservasClient.consultarReservaPorId(reservaId);
  } catch (error) {
    console.warn(`[facturacion] No se pudo consultar la reserva ${reservaId}:`, error.message);
    return false;
  }

  if (!reserva) {
    console.warn(`[facturacion] Reserva ${reservaId} no encontrada; se omite el evento`);
    return true;
  }

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const { rows: existentes } = await cliente.query("SELECT id FROM folios WHERE reserva_id = $1", [reserva.id]);
    if (existentes.length > 0) {
      await cliente.query("COMMIT");
      console.log(`[facturacion] Ya existe un folio para la reserva ${reserva.id}; se omite`);
      return true;
    }

    const montoTotal = Number(reserva.monto_total);
    const hotelId = reserva.hotel_id || payload.hotel_id || null;
    const huespedId = reserva.guest_id || null;

    const { rows: folioResult } = await cliente.query(
      `INSERT INTO folios
        (reserva_id, hotel_id, huesped_id, moneda, estado, total_cargos, total_impuestos, total, cerrado_en)
       VALUES ($1, $2, $3, 'COP', 'cerrado', $4, 0, $5, CURRENT_TIMESTAMP)
       RETURNING id`,
      [reserva.id, hotelId, huespedId, montoTotal, montoTotal]
    );
    const folioId = folioResult[0].id;

    await cliente.query(
      "INSERT INTO cargos (folio_id, concepto, cantidad, precio_unitario, total) VALUES ($1, 'Hospedaje', 1, $2, $3)",
      [folioId, montoTotal, montoTotal]
    );

    const numeroFactura = `FAC-${folioId}-${Date.now()}`;
    await cliente.query(
      "INSERT INTO facturas (folio_id, numero, reserva_id, total, moneda) VALUES ($1, $2, $3, $4, 'COP')",
      [folioId, numeroFactura, reserva.id, montoTotal]
    );

    await cliente.query("COMMIT");

    console.log(`[facturacion] Folio #${folioId} cerrado y factura ${numeroFactura} emitida para reserva #${reserva.id}`);
    return true;
  } catch (error) {
    await cliente.query("ROLLBACK");
    console.error(`[facturacion] Error al procesar checkout.completed de reserva ${reservaId}:`, error.message);
    return false;
  } finally {
    cliente.release();
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
