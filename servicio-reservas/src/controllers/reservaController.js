const pool = require("../config/baseDeDatos");
const { bloquearInventarioSincrono, liberarInventarioSincrono } = require("../clientes/disponibilidadClient");
const { registrarEventoSaliente } = require("../eventos/eventosOutbox");

/**
 * POST /api/reservas
 * 1) Llama SÍNCRONAMENTE al servicio de disponibilidad para bloquear el
 *    inventario. Si no hay disponibilidad, no se crea la reserva.
 * 2) Si el bloqueo fue exitoso, guarda la reserva en la base de datos
 *    propia de este microservicio.
 * 3) Publica un evento ASÍNCRONO booking.created (patrón outbox): lo
 *    consume servicio-recepcion para armar su lista de llegadas del día,
 *    sin que este servicio necesite saber que existe.
 */
async function crearReserva(req, res) {
  const {
    guest_id,
    nombre_huesped,
    email_huesped,
    hotel_id,
    tipo_habitacion_id,
    fecha_checkin,
    fecha_checkout,
    canal = "directo",
    monto_total
  } = req.body;

  if (!nombre_huesped || !tipo_habitacion_id || !fecha_checkin || !fecha_checkout || !monto_total) {
    return res.status(400).json({
      error: "Faltan campos obligatorios: nombre_huesped, tipo_habitacion_id, fecha_checkin, fecha_checkout, monto_total"
    });
  }

  // Buscar o crear huésped para poder integrar con fidelización.
  let huespedId = guest_id || null;
  if (!huespedId && email_huesped) {
    const [existente] = await pool.query("SELECT id FROM huespedes WHERE email = ?", [email_huesped]);
    if (existente.length > 0) {
      huespedId = existente[0].id;
    } else {
      const [nuevo] = await pool.query(
        "INSERT INTO huespedes (nombre, email) VALUES (?, ?)",
        [nombre_huesped, email_huesped]
      );
      huespedId = nuevo.insertId;
    }
  }

  try {
    await bloquearInventarioSincrono({
      tipo_habitacion_id,
      checkin: fecha_checkin,
      checkout: fecha_checkout
    });
  } catch (error) {
    if (error.response && error.response.status === 409) {
      return res.status(409).json({ error: "No hay disponibilidad para las fechas solicitadas" });
    }
    return res.status(502).json({
      error: "No fue posible comunicarse con el servicio de disponibilidad y tarifas",
      detalle: error.message
    });
  }

  let reserva;
  try {
    const [resultado] = await pool.query(
      `INSERT INTO reservas
        (guest_id, nombre_huesped, email_huesped, hotel_id, tipo_habitacion_id, fecha_checkin, fecha_checkout, canal, monto_total, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada')`,
      [huespedId, nombre_huesped, email_huesped, hotel_id, tipo_habitacion_id, fecha_checkin, fecha_checkout, canal, monto_total]
    );

    reserva = { id: resultado.insertId, guest_id: huespedId, ...req.body, canal, estado: "confirmada" };
  } catch (error) {
    // Si no se pudo guardar la reserva, liberamos el inventario bloqueado
    // para no dejarlo inconsistente.
    await liberarInventarioSincrono({
      tipo_habitacion_id,
      checkin: fecha_checkin,
      checkout: fecha_checkout
    });
    return res.status(500).json({ error: "No se pudo guardar la reserva", detalle: error.message });
  }

  await registrarEventoSaliente("booking.created", reserva);

  res.status(201).json(reserva);
}

/** GET /api/reservas — lista todas las reservas. */
async function listarReservas(req, res) {
  const [filas] = await pool.query("SELECT * FROM reservas ORDER BY creada_en DESC");
  res.json(filas);
}

/** GET /api/reservas/:id */
async function obtenerReserva(req, res) {
  const [filas] = await pool.query("SELECT * FROM reservas WHERE id = ?", [req.params.id]);
  if (filas.length === 0) {
    return res.status(404).json({ error: "Reserva no encontrada" });
  }
  res.json(filas[0]);
}

/**
 * PATCH /api/reservas/:id/cancelar
 * Marca la reserva como cancelada y publica el evento ASÍNCRONO
 * booking.cancelled: responde al usuario de inmediato, sin esperar a
 * que el servicio de disponibilidad libere el inventario.
 */
async function cancelarReserva(req, res) {
  const [filas] = await pool.query("SELECT * FROM reservas WHERE id = ?", [req.params.id]);
  if (filas.length === 0) {
    return res.status(404).json({ error: "Reserva no encontrada" });
  }

  const reserva = filas[0];

  if (reserva.estado === "cancelada") {
    return res.status(400).json({ error: "La reserva ya estaba cancelada" });
  }

  await pool.query("UPDATE reservas SET estado = 'cancelada' WHERE id = ?", [reserva.id]);

  // Se responde al usuario de inmediato; el evento queda anotado para que
  // el servicio de disponibilidad lo procese cuando lo consulte (asíncrono).
  await registrarEventoSaliente("booking.cancelled", {
    id: reserva.id,
    tipo_habitacion_id: reserva.tipo_habitacion_id,
    fecha_checkin: reserva.fecha_checkin,
    fecha_checkout: reserva.fecha_checkout
  });

  res.json({ ...reserva, estado: "cancelada" });
}

module.exports = { crearReserva, listarReservas, obtenerReserva, cancelarReserva };
