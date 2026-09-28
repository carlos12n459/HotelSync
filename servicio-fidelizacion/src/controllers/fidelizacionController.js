const pool = require("../config/baseDeDatos");
const { consultarReservaPorId } = require("../clientes/reservasClient");

const FACTORES_PUNTOS = {
  plata: 1,
  oro: 2,
  platino: 3
};

function calcularPuntos(monto, nivel) {
  const factor = FACTORES_PUNTOS[nivel] || FACTORES_PUNTOS.plata;
  return Math.floor(monto / 1000) * factor;
}

/** GET /api/fidelizacion/cuentas */
async function listarCuentas(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM cuentas_fidelizacion ORDER BY creado_en DESC");
    res.json(rows);
  } catch (error) {
    console.error("[fidelizacion] Error al listar cuentas:", error.message);
    res.status(500).json({ error: "No se pudieron listar las cuentas", detalle: error.message });
  }
}

/** GET /api/fidelizacion/cuentas/:guest_id */
async function obtenerCuenta(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM cuentas_fidelizacion WHERE guest_id = $1", [req.params.guest_id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Cuenta de fidelizacion no encontrada" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("[fidelizacion] Error al obtener cuenta:", error.message);
    res.status(500).json({ error: "No se pudo obtener la cuenta", detalle: error.message });
  }
}

/** GET /api/fidelizacion/cuentas/:guest_id/transacciones */
async function listarTransacciones(req, res) {
  try {
    const { rows: cuentas } = await pool.query("SELECT id FROM cuentas_fidelizacion WHERE guest_id = $1", [req.params.guest_id]);
    if (cuentas.length === 0) {
      return res.status(404).json({ error: "Cuenta de fidelizacion no encontrada" });
    }

    const { rows } = await pool.query(
      "SELECT * FROM transacciones_puntos WHERE cuenta_id = $1 ORDER BY creado_en DESC",
      [cuentas[0].id]
    );
    res.json(rows);
  } catch (error) {
    console.error("[fidelizacion] Error al listar transacciones:", error.message);
    res.status(500).json({ error: "No se pudieron listar las transacciones", detalle: error.message });
  }
}

/** POST /api/fidelizacion/cuentas/:guest_id/canjear */
async function canjearPuntos(req, res) {
  const { puntos, descripcion } = req.body;

  if (!puntos || puntos <= 0 || !Number.isInteger(Number(puntos))) {
    return res.status(400).json({ error: "El campo 'puntos' es obligatorio y debe ser un entero positivo" });
  }
  if (!descripcion || descripcion.trim().length === 0) {
    return res.status(400).json({ error: "El campo 'descripcion' es obligatorio" });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const { rows: cuentas } = await cliente.query("SELECT * FROM cuentas_fidelizacion WHERE guest_id = $1 FOR UPDATE", [req.params.guest_id]);
    if (cuentas.length === 0) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ error: "Cuenta de fidelizacion no encontrada" });
    }

    const cuenta = cuentas[0];
    if (cuenta.puntos < puntos) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ error: "Puntos insuficientes", puntos_disponibles: cuenta.puntos });
    }

    await cliente.query(
      "UPDATE cuentas_fidelizacion SET puntos = puntos - $1, puntos_canjeados = puntos_canjeados + $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2",
      [puntos, cuenta.id]
    );

    await cliente.query(
      "INSERT INTO transacciones_puntos (cuenta_id, tipo, puntos, descripcion) VALUES ($1, 'canje', $2, $3)",
      [cuenta.id, puntos, descripcion]
    );

    await cliente.query("COMMIT");

    const { rows: actualizada } = await pool.query("SELECT * FROM cuentas_fidelizacion WHERE id = $1", [cuenta.id]);
    res.json({ mensaje: "Canje realizado exitosamente", cuenta: actualizada[0] });
  } catch (error) {
    await cliente.query("ROLLBACK");
    console.error("[fidelizacion] Error al canjear puntos:", error.message);
    res.status(500).json({ error: "No se pudo realizar el canje", detalle: error.message });
  } finally {
    cliente.release();
  }
}

/**
 * Procesa un evento booking.completed acumulando puntos al huesped.
 */
async function acumularPuntosPorReserva(reserva) {
  const { reserva_id, monto_total } = reserva;
  const monto = Number(monto_total);

  if (!reserva_id || isNaN(monto)) {
    throw new Error("Payload de booking.completed invalido: faltan reserva_id o monto_total");
  }

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    let { rows: cuentas } = await cliente.query("SELECT * FROM cuentas_fidelizacion WHERE guest_id = $1 FOR UPDATE", [reserva.guest_id]);

    let cuenta;
    if (cuentas.length === 0) {
      const { rows: resultado } = await cliente.query(
        "INSERT INTO cuentas_fidelizacion (guest_id, nombre_huesped, email, nivel, puntos) VALUES ($1, $2, $3, 'plata', 0) RETURNING id",
        [reserva.guest_id, reserva.nombre_huesped, reserva.email_huesped]
      );
      const { rows: nueva } = await cliente.query("SELECT * FROM cuentas_fidelizacion WHERE id = $1", [resultado[0].id]);
      cuenta = nueva[0];
    } else {
      cuenta = cuentas[0];
    }

    const puntos = calcularPuntos(monto, cuenta.nivel);

    await cliente.query(
      "UPDATE cuentas_fidelizacion SET puntos = puntos + $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2",
      [puntos, cuenta.id]
    );

    await cliente.query(
      "INSERT INTO transacciones_puntos (cuenta_id, reserva_id, tipo, puntos, descripcion) VALUES ($1, $2, 'acumulacion', $3, $4)",
      [cuenta.id, reserva_id, puntos, `Puntos acumulados por reserva #${reserva_id} (nivel ${cuenta.nivel})`]
    );

    await cliente.query("COMMIT");

    console.log(`[fidelizacion] +${puntos} puntos al huesped ${cuenta.guest_id} por reserva #${reserva_id}`);
    return { cuenta_id: cuenta.id, puntos_acumulados: puntos };
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Procesa el evento booking.completed de RabbitMQ.
 */
async function procesarBookingCompleted(payload) {
  const eventoId = payload.event_id;
  const reservaId = Number(payload.reserva_id);

  if (!eventoId || !reservaId) {
    console.warn("[fidelizacion] booking.completed sin event_id o reserva_id; se omite");
    return;
  }

  try {
    // Idempotencia: no procesar el mismo evento dos veces.
    const { rows: yaProcesado } = await pool.query("SELECT id FROM eventos_procesados WHERE evento_id = $1", [String(eventoId)]);
    if (yaProcesado.length > 0) {
      console.log(`[fidelizacion] Evento ${eventoId} ya fue procesado; se omite`);
      return;
    }

    let reserva;
    try {
      reserva = await consultarReservaPorId(reservaId);
    } catch (error) {
      console.warn(`[fidelizacion] No se pudo consultar la reserva ${reservaId}:`, error.message);
      return;
    }

    if (!reserva) {
      console.warn(`[fidelizacion] Reserva ${reservaId} no encontrada; se omite el evento ${eventoId}`);
      await pool.query(
        "INSERT INTO eventos_procesados (evento_id, tipo, reserva_id) VALUES ($1, 'booking.completed', $2) ON CONFLICT (evento_id) DO NOTHING",
        [String(eventoId), reservaId]
      );
      return;
    }

    if (!reserva.guest_id) {
      console.warn(`[fidelizacion] La reserva ${reserva.id} no tiene guest_id asociado; no se pueden acumular puntos`);
      await pool.query(
        "INSERT INTO eventos_procesados (evento_id, tipo, reserva_id) VALUES ($1, 'booking.completed', $2) ON CONFLICT (evento_id) DO NOTHING",
        [String(eventoId), reservaId]
      );
      return;
    }

    const datosAcumulacion = {
      reserva_id: reservaId,
      guest_id: Number(reserva.guest_id),
      nombre_huesped: reserva.nombre_huesped,
      email_huesped: reserva.email_huesped,
      monto_total: payload.monto_total !== null && payload.monto_total !== undefined
        ? payload.monto_total
        : reserva.monto_total
    };

    await acumularPuntosPorReserva(datosAcumulacion);

    await pool.query(
      "INSERT INTO eventos_procesados (evento_id, tipo, reserva_id) VALUES ($1, 'booking.completed', $2) ON CONFLICT (evento_id) DO NOTHING",
      [String(eventoId), reservaId]
    );

    console.log(`[fidelizacion] Evento ${eventoId} procesado (reserva #${reservaId})`);
  } catch (error) {
    console.error(`[fidelizacion] Error procesando evento ${eventoId}:`, error.message);
  }
}

module.exports = {
  listarCuentas,
  obtenerCuenta,
  listarTransacciones,
  canjearPuntos,
  acumularPuntosPorReserva,
  procesarBookingCompleted
};
