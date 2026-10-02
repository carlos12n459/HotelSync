const pool = require("../config/baseDeDatos");
const { bloquearInventarioSincrono, liberarInventarioSincrono } = require("../clientes/disponibilidadClient");
const { publish } = require("../eventos/rabbitmq");

async function registrarEvento(tipo, payload) {
  await publish(tipo, payload);
  console.log(`[reservas] Evento publicado: ${tipo}`, payload);
}

// Lee el usuario autenticado enviado por el gateway.
function obtenerUsuarioHeaders(req) {
  return {
    id: req.headers["x-user-id"] ? Number(req.headers["x-user-id"]) : null,
    rol: req.headers["x-user-rol"] || null
  };
}

/**
 * POST /api/reservas
 * 1) Llama SINCRONAMENTE al servicio de disponibilidad para bloquear el
 *    inventario. Si no hay disponibilidad, no se crea la reserva.
 * 2) Si el bloqueo fue exitoso, guarda la reserva en la base de datos
 *    propia de este microservicio.
 * 3) Publica un evento ASINCRONO booking.created a RabbitMQ.
 */
async function crearReserva(req, res) {
  const {
    guest_id,
    usuario_id,
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

  const usuario = obtenerUsuarioHeaders(req);
  // Si viene usuario_id en el body lo respetamos, si no, usamos el usuario autenticado.
  const usuarioFinal = usuario_id || usuario.id || null;

  // Buscar o crear huesped para poder integrar con fidelizacion.
  let huespedId = guest_id || null;
  if (!huespedId && email_huesped) {
    const { rows: existente } = await pool.query("SELECT id FROM huespedes WHERE email = $1", [email_huesped]);
    if (existente.length > 0) {
      huespedId = existente[0].id;
    } else {
      const { rows: nuevo } = await pool.query(
        "INSERT INTO huespedes (nombre, email) VALUES ($1, $2) RETURNING id",
        [nombre_huesped, email_huesped]
      );
      huespedId = nuevo[0].id;
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
    const { rows: resultado } = await pool.query(
      `INSERT INTO reservas
        (usuario_id, guest_id, nombre_huesped, email_huesped, hotel_id, tipo_habitacion_id, fecha_checkin, fecha_checkout, canal, monto_total, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmada')
       RETURNING id`,
      [usuarioFinal, huespedId, nombre_huesped, email_huesped, hotel_id, tipo_habitacion_id, fecha_checkin, fecha_checkout, canal, monto_total]
    );

    reserva = { id: resultado[0].id, usuario_id: usuarioFinal, guest_id: huespedId, ...req.body, canal, estado: "confirmada" };
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

  await registrarEvento("booking.created", reserva);

  res.status(201).json(reserva);
}

/** GET /api/reservas — lista todas las reservas. */
async function listarReservas(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM reservas ORDER BY creada_en DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar reservas", detalle: error.message });
  }
}

/** GET /api/mis-reservas — reservas del usuario autenticado. */
async function listarMisReservas(req, res) {
  const usuario = obtenerUsuarioHeaders(req);

  if (!usuario.id) {
    return res.status(401).json({ error: "Se requiere autenticacion para ver tus reservas" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT * FROM reservas WHERE usuario_id = $1 ORDER BY creada_en DESC",
      [usuario.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar tus reservas", detalle: error.message });
  }
}

/** GET /api/reservas/:id */
async function obtenerReserva(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener reserva", detalle: error.message });
  }
}

/**
 * PATCH /api/reservas/:id/cancelar
 * Marca la reserva como cancelada y publica el evento ASINCRONO
 * booking.cancelled a RabbitMQ.
 */
async function cancelarReserva(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const reserva = rows[0];

    if (reserva.estado === "cancelada") {
      return res.status(400).json({ error: "La reserva ya estaba cancelada" });
    }

    await pool.query("UPDATE reservas SET estado = 'cancelada' WHERE id = $1", [reserva.id]);

    await registrarEvento("booking.cancelled", {
      id: reserva.id,
      tipo_habitacion_id: reserva.tipo_habitacion_id,
      fecha_checkin: reserva.fecha_checkin,
      fecha_checkout: reserva.fecha_checkout
    });

    res.json({ ...reserva, estado: "cancelada" });
  } catch (error) {
    res.status(500).json({ error: "Error al cancelar reserva", detalle: error.message });
  }
}

module.exports = { crearReserva, listarReservas, listarMisReservas, obtenerReserva, cancelarReserva };
