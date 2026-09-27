const pool = require("../config/baseDeDatos");
const reservasClient = require("../clientes/reservasClient");
const housekeepingClient = require("../clientes/housekeepingClient");
const { registrarEventoSaliente } = require("../eventos/eventosOutbox");

/**
 * POST /api/recepcion/iniciar-turno
 * Comunicación SÍNCRONA (REST) hacia servicio-reservas: al iniciar el
 * turno, el panel de recepción trae las reservas confirmadas del día
 * directamente desde la fuente de verdad, como respaldo/complemento de lo
 * que ya haya llegado de forma asíncrona por el poller de booking.created.
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmada', 'consulta_sync')
         ON DUPLICATE KEY UPDATE estado_reserva = 'confirmada'`,
        [
          reserva.id, reserva.nombre_huesped, reserva.hotel_id, reserva.tipo_habitacion_id,
          reserva.fecha_checkin, reserva.fecha_checkout, reserva.canal, reserva.monto_total
        ]
      );
    }

    res.json({
      mensaje: "Turno iniciado: reservas sincronizadas vía REST con servicio-reservas",
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

  if (hotel_id) { condiciones.push("hotel_id = ?"); parametros.push(hotel_id); }
  if (fecha_checkin) { condiciones.push("fecha_checkin = ?"); parametros.push(fecha_checkin); }

  const clausulaWhere = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const [filas] = await pool.query(`SELECT * FROM llegadas ${clausulaWhere} ORDER BY fecha_checkin ASC`, parametros);
  res.json(filas);
}

/**
 * POST /api/recepcion/checkin
 * Antes de asignar la habitación física:
 * 1) Valida SÍNCRONAMENTE contra servicio-reservas que la reserva exista
 *    y esté vigente.
 * 2) Valida SÍNCRONAMENTE contra servicio-housekeeping que la habitación
 *    esté en estado "lista" (limpia).
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
      return res.status(409).json({ error: `La reserva está en estado "${reserva.estado}", no se puede hacer check-in` });
    }

    const estadoHabitacion = await housekeepingClient.consultarEstadoHabitacion(numero_habitacion);
    if (estadoHabitacion !== "lista") {
      return res.status(409).json({
        error: `La habitación ${numero_habitacion} no está lista para check-in (estado actual: "${estadoHabitacion}")`
      });
    }

    const [asignacionAbierta] = await pool.query(
      "SELECT * FROM asignaciones_habitacion WHERE numero_habitacion = ? AND checkout_en IS NULL LIMIT 1",
      [numero_habitacion]
    );
    if (asignacionAbierta.length > 0) {
      return res.status(409).json({
        error: `La habitación ${numero_habitacion} ya tiene una asignación abierta (reserva #${asignacionAbierta[0].reserva_id})`
      });
    }

    const [resultado] = await pool.query(
      "INSERT INTO asignaciones_habitacion (reserva_id, numero_habitacion, checkin_en) VALUES (?, ?, NOW())",
      [reserva_id, numero_habitacion]
    );
    const [filas] = await pool.query("SELECT * FROM asignaciones_habitacion WHERE id = ?", [resultado.insertId]);

    res.status(201).json(filas[0]);
  } catch (error) {
    res.status(502).json({ error: "No fue posible completar el check-in", detalle: error.message });
  }
}

/**
 * POST /api/recepcion/checkout
 * Cierra la estadía localmente y publica el evento ASÍNCRONO
 * checkout.completed (patrón outbox), que housekeeping recoge por polling
 * para generar automáticamente la tarea de limpieza.
 */
async function checkout(req, res) {
  const { reserva_id } = req.body;
  if (!reserva_id) return res.status(400).json({ error: "reserva_id es obligatorio" });

  const [asignaciones] = await pool.query(
    "SELECT * FROM asignaciones_habitacion WHERE reserva_id = ? AND checkout_en IS NULL ORDER BY id DESC LIMIT 1",
    [reserva_id]
  );
  if (asignaciones.length === 0) {
    return res.status(404).json({ error: "No hay una asignación de habitación abierta para esa reserva (ya se hizo checkout o no se hizo check-in)" });
  }

  // Validar en la fuente de verdad que la reserva sigue confirmada.
  try {
    const reserva = await reservasClient.consultarReservaPorId(reserva_id);
    if (!reserva) return res.status(404).json({ error: "La reserva no existe en servicio-reservas" });
    if (reserva.estado !== "confirmada") {
      return res.status(409).json({ error: `La reserva está en estado "${reserva.estado}", no se puede hacer checkout` });
    }
  } catch (error) {
    return res.status(502).json({ error: "No fue posible validar la reserva", detalle: error.message });
  }

  const asignacion = asignaciones[0];
  await pool.query("UPDATE asignaciones_habitacion SET checkout_en = NOW() WHERE id = ?", [asignacion.id]);

  const [llegadaFilas] = await pool.query("SELECT hotel_id, monto_total FROM llegadas WHERE reserva_id = ?", [reserva_id]);
  let hotel_id = llegadaFilas[0] ? llegadaFilas[0].hotel_id : null;
  let monto_total = llegadaFilas[0] ? llegadaFilas[0].monto_total : null;

  // Si no llegó por el evento async, consultamos a reservas para completar datos.
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

  // Se responde al huésped de inmediato; housekeeping y facturación procesarán
  // los eventos cuando lo consulten (asíncrono), sin que recepción tenga que esperar.
  await registrarEventoSaliente("checkout.completed", {
    reserva_id: Number(reserva_id),
    numero_habitacion: asignacion.numero_habitacion,
    hotel_id,
    monto_total
  });

  // booking.completed notifica a fidelización para acumulación de puntos.
  await registrarEventoSaliente("booking.completed", {
    reserva_id: Number(reserva_id),
    numero_habitacion: asignacion.numero_habitacion,
    hotel_id,
    monto_total
  });

  res.json({ ...asignacion, checkout_en: new Date().toISOString() });
}

/** GET /api/recepcion/asignaciones?hotel_id= */
async function listarAsignaciones(req, res) {
  const { hotel_id } = req.query;

  if (hotel_id) {
    const [filas] = await pool.query(
      `SELECT a.* FROM asignaciones_habitacion a
       JOIN llegadas l ON l.reserva_id = a.reserva_id
       WHERE l.hotel_id = ?
       ORDER BY a.id DESC`,
      [hotel_id]
    );
    return res.json(filas);
  }

  const [filas] = await pool.query("SELECT * FROM asignaciones_habitacion ORDER BY id DESC");
  res.json(filas);
}

/** POST /api/recepcion/incidencias — registro de solicitudes/incidencias del huésped. */
async function registrarIncidencia(req, res) {
  const { reserva_id, descripcion } = req.body;
  if (!reserva_id || !descripcion) {
    return res.status(400).json({ error: "reserva_id y descripcion son obligatorios" });
  }

  const [resultado] = await pool.query(
    "INSERT INTO incidencias_huesped (reserva_id, descripcion) VALUES (?, ?)",
    [reserva_id, descripcion]
  );
  const [filas] = await pool.query("SELECT * FROM incidencias_huesped WHERE id = ?", [resultado.insertId]);
  res.status(201).json(filas[0]);
}

module.exports = {
  iniciarTurno,
  listarLlegadas,
  checkin,
  checkout,
  listarAsignaciones,
  registrarIncidencia
};
