const pool = require("../config/baseDeDatos");
const reservasClient = require("../clientes/reservasClient");
const housekeepingClient = require("../clientes/housekeepingClient");
const { publish } = require("../eventos/rabbitmq");

/**
 * POST /api/recepcion/iniciar-turno
 * Comunicacion SINCRONA (REST) hacia servicio-reservas: al iniciar el
 * turno, el panel de recepcion trae las reservas confirmadas del dia
 * directamente desde la fuente de verdad.
 */
async function iniciarTurno(req, res) {
  const { hotel_id, fecha } = req.body;
  if (!hotel_id) return res.status(400).json({ error: "hotel_id es obligatorio" });

  const fechaConsulta = fecha || new Date().toISOString().slice(0, 10);

  try {
    const reservas = await reservasClient.consultarReservasDelDia(hotel_id, fechaConsulta);

    for (const reserva of reservas) {
      await pool.query(
        `INSERT INTO llegadas
          (reserva_id, nombre_huesped, hotel_id, tipo_habitacion_id, fecha_checkin, fecha_checkout, canal, monto_total, estado_reserva, origen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmada', 'consulta_sync')
         ON CONFLICT (reserva_id) DO UPDATE SET estado_reserva = 'confirmada'`,
        [
          reserva.id, reserva.nombre_huesped, reserva.hotel_id, reserva.tipo_habitacion_id,
          reserva.fecha_checkin, reserva.fecha_checkout, reserva.canal, reserva.monto_total
        ]
      );
    }

    res.json({
      mensaje: "Turno iniciado: reservas sincronizadas via REST con servicio-reservas",
      total_reservas: reservas.length,
      reservas
    });
  } catch (error) {
    res.status(502).json({
      error: "No fue posible comunicarse con servicio-reservas",
      detalle: error.message
    });
  }
}

/** GET /api/recepcion/llegadas?hotel_id=&fecha_checkin= */
async function listarLlegadas(req, res) {
  const { hotel_id, fecha_checkin } = req.query;
  const condiciones = [];
  const parametros = [];

  if (hotel_id) { condiciones.push("hotel_id = $" + (parametros.length + 1)); parametros.push(hotel_id); }
  if (fecha_checkin) { condiciones.push("fecha_checkin = $" + (parametros.length + 1)); parametros.push(fecha_checkin); }

  const clausulaWhere = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const { rows } = await pool.query(`SELECT * FROM llegadas ${clausulaWhere} ORDER BY fecha_checkin ASC`, parametros);
  res.json(rows);
}

/**
 * POST /api/recepcion/checkin
 */
async function checkin(req, res) {
  const { reserva_id, numero_habitacion } = req.body;
  if (!reserva_id || !numero_habitacion) {
    return res.status(400).json({ error: "reserva_id y numero_habitacion son obligatorios" });
  }

  try {
    const reserva = await reservasClient.consultarReservaPorId(reserva_id);
    if (!reserva) return res.status(404).json({ error: "La reserva no existe en servicio-reservas" });
    if (reserva.estado !== "confirmada") {
      return res.status(409).json({ error: `La reserva esta en estado "${reserva.estado}", no se puede hacer check-in` });
    }

    const estadoHabitacion = await housekeepingClient.consultarEstadoHabitacion(numero_habitacion);
    if (estadoHabitacion !== "lista") {
      return res.status(409).json({
        error: `La habitacion ${numero_habitacion} no esta lista para check-in (estado actual: "${estadoHabitacion}")`
      });
    }

    const { rows: asignacionAbierta } = await pool.query(
      "SELECT * FROM asignaciones_habitacion WHERE numero_habitacion = $1 AND checkout_en IS NULL LIMIT 1",
      [numero_habitacion]
    );
    if (asignacionAbierta.length > 0) {
      return res.status(409).json({
        error: `La habitacion ${numero_habitacion} ya tiene una asignacion abierta (reserva #${asignacionAbierta[0].reserva_id})`
      });
    }

    const { rows: resultado } = await pool.query(
      "INSERT INTO asignaciones_habitacion (reserva_id, numero_habitacion, checkin_en) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id",
      [reserva_id, numero_habitacion]
    );
    const { rows: filas } = await pool.query("SELECT * FROM asignaciones_habitacion WHERE id = $1", [resultado[0].id]);

    res.status(201).json(filas[0]);
  } catch (error) {
    res.status(502).json({ error: "No fue posible completar el check-in", detalle: error.message });
  }
}

/**
 * POST /api/recepcion/checkout
 * Cierra la estadia localmente y publica los eventos ASINCRONOS
 * checkout.completed y booking.completed a RabbitMQ.
 */
async function checkout(req, res) {
  const { reserva_id } = req.body;
  if (!reserva_id) return res.status(400).json({ error: "reserva_id es obligatorio" });

  const { rows: asignaciones } = await pool.query(
    "SELECT * FROM asignaciones_habitacion WHERE reserva_id = $1 AND checkout_en IS NULL ORDER BY id DESC LIMIT 1",
    [reserva_id]
  );
  if (asignaciones.length === 0) {
    return res.status(404).json({ error: "No hay una asignacion de habitacion abierta para esa reserva (ya se hizo checkout o no se hizo check-in)" });
  }

  // Validar en la fuente de verdad que la reserva sigue confirmada.
  try {
    const reserva = await reservasClient.consultarReservaPorId(reserva_id);
    if (!reserva) return res.status(404).json({ error: "La reserva no existe en servicio-reservas" });
    if (reserva.estado !== "confirmada") {
      return res.status(409).json({ error: `La reserva esta en estado "${reserva.estado}", no se puede hacer checkout` });
    }
  } catch (error) {
    return res.status(502).json({ error: "No fue posible validar la reserva", detalle: error.message });
  }

  const asignacion = asignaciones[0];
  await pool.query("UPDATE asignaciones_habitacion SET checkout_en = CURRENT_TIMESTAMP WHERE id = $1", [asignacion.id]);

  const { rows: llegadaFilas } = await pool.query("SELECT hotel_id, monto_total FROM llegadas WHERE reserva_id = $1", [reserva_id]);
  let hotel_id = llegadaFilas[0] ? llegadaFilas[0].hotel_id : null;
  let monto_total = llegadaFilas[0] ? llegadaFilas[0].monto_total : null;

  // Si no llego por el evento async, consultamos a reservas para completar datos.
  if (!hotel_id || !monto_total) {
    try {
      const reserva = await reservasClient.consultarReservaPorId(reserva_id);
      if (reserva) {
        hotel_id = hotel_id || reserva.hotel_id;
        monto_total = monto_total || reserva.monto_total;
      }
    } catch (error) {
      console.warn("[recepcion] No se pudo complementar datos de la reserva:", error.message);
    }
  }

  const timestamp = Date.now();
  const eventoPayload = {
    event_id: `checkout-${reserva_id}-${timestamp}`,
    reserva_id: Number(reserva_id),
    numero_habitacion: asignacion.numero_habitacion,
    hotel_id,
    monto_total
  };
  const eventoBookingCompleted = {
    event_id: `booking-completed-${reserva_id}-${timestamp}`,
    reserva_id: Number(reserva_id),
    numero_habitacion: asignacion.numero_habitacion,
    hotel_id,
    monto_total
  };

  await publish("checkout.completed", eventoPayload);
  await publish("booking.completed", eventoBookingCompleted);

  res.json({ ...asignacion, checkout_en: new Date().toISOString() });
}

/** GET /api/recepcion/asignaciones?hotel_id= */
async function listarAsignaciones(req, res) {
  const { hotel_id } = req.query;

  if (hotel_id) {
    const { rows } = await pool.query(
      `SELECT a.* FROM asignaciones_habitacion a
       JOIN llegadas l ON l.reserva_id = a.reserva_id
       WHERE l.hotel_id = $1
       ORDER BY a.id DESC`,
      [hotel_id]
    );
    return res.json(rows);
  }

  const { rows } = await pool.query("SELECT * FROM asignaciones_habitacion ORDER BY id DESC");
  res.json(rows);
}

/** POST /api/recepcion/incidencias */
async function registrarIncidencia(req, res) {
  const { reserva_id, descripcion } = req.body;
  if (!reserva_id || !descripcion) {
    return res.status(400).json({ error: "reserva_id y descripcion son obligatorios" });
  }

  const { rows: resultado } = await pool.query(
    "INSERT INTO incidencias_huesped (reserva_id, descripcion) VALUES ($1, $2) RETURNING id",
    [reserva_id, descripcion]
  );
  const { rows } = await pool.query("SELECT * FROM incidencias_huesped WHERE id = $1", [resultado[0].id]);
  res.status(201).json(rows[0]);
}

/**
 * Procesa el evento booking.created de RabbitMQ para mantener la lista
 * local de llegadas actualizada de forma asincrona.
 */
async function procesarBookingCreated(reserva) {
  try {
    await pool.query(
      `INSERT INTO llegadas
        (reserva_id, nombre_huesped, hotel_id, tipo_habitacion_id, fecha_checkin, fecha_checkout, canal, monto_total, estado_reserva, origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmada', 'evento_async')
       ON CONFLICT (reserva_id) DO UPDATE SET estado_reserva = 'confirmada', origen = 'evento_async'`,
      [
        reserva.id, reserva.nombre_huesped, reserva.hotel_id, reserva.tipo_habitacion_id,
        reserva.fecha_checkin, reserva.fecha_checkout, reserva.canal, reserva.monto_total
      ]
    );
    console.log(`[recepcion] Llegada registrada por evento async (reserva #${reserva.id})`);
  } catch (error) {
    console.error("[recepcion] Error procesando booking.created:", error.message);
    throw error;
  }
}

module.exports = {
  iniciarTurno,
  listarLlegadas,
  checkin,
  checkout,
  listarAsignaciones,
  registrarIncidencia,
  procesarBookingCreated
};
