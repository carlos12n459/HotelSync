const pool = require("../config/baseDeDatos");
const reservasClient = require("../clientes/reservasClient");

/** GET /api/channel/mappings */
async function listarMappings(req, res) {
  const [filas] = await pool.query("SELECT * FROM channel_mappings ORDER BY id");
  res.json(filas);
}

/** POST /api/channel/mappings */
async function crearMapping(req, res) {
  const { room_type_id, channel_name, external_room_id, hotel_id } = req.body;
  if (!room_type_id || !channel_name || !external_room_id || !hotel_id) {
    return res.status(400).json({ error: "room_type_id, channel_name, external_room_id y hotel_id son obligatorios" });
  }
  const [resultado] = await pool.query(
    "INSERT INTO channel_mappings (room_type_id, channel_name, external_room_id, hotel_id) VALUES (?, ?, ?, ?)",
    [room_type_id, channel_name, external_room_id, hotel_id]
  );
  const [filas] = await pool.query("SELECT * FROM channel_mappings WHERE id = ?", [resultado.insertId]);
  res.status(201).json(filas[0]);
}

/**
 * POST /api/channel/webhook/:channel
 * Simula la llegada de una reserva desde una OTA.
 * El payload debe incluir: external_id, nombre_huesped, email_huesped,
 * hotel_id, tipo_habitacion_id, fecha_checkin, fecha_checkout, monto_total.
 */
async function recibirWebhook(req, res) {
  const channel = req.params.channel;
  const payload = req.body;

  if (!payload.external_id) {
    return res.status(400).json({ error: "external_id es obligatorio" });
  }

  // Idempotencia: no procesar la misma reserva externa dos veces.
  const [existente] = await pool.query(
    "SELECT * FROM reservas_externas WHERE channel_name = ? AND external_id = ?",
    [channel, payload.external_id]
  );
  if (existente.length > 0) {
    return res.status(200).json({ mensaje: "Reserva externa ya fue recibida", reserva_externa: existente[0] });
  }

  const [resultado] = await pool.query(
    "INSERT INTO reservas_externas (channel_name, external_id, payload) VALUES (?, ?, ?)",
    [channel, payload.external_id, JSON.stringify(payload)]
  );

  try {
    const reserva = await reservasClient.crearReservaInterna({
      nombre_huesped: payload.nombre_huesped,
      email_huesped: payload.email_huesped,
      hotel_id: payload.hotel_id,
      tipo_habitacion_id: payload.tipo_habitacion_id,
      fecha_checkin: payload.fecha_checkin,
      fecha_checkout: payload.fecha_checkout,
      canal: channel,
      monto_total: payload.monto_total
    });

    await pool.query(
      "UPDATE reservas_externas SET estado = 'procesada', reserva_id = ?, procesado_en = NOW() WHERE id = ?",
      [reserva.id, resultado.insertId]
    );

    res.status(201).json({ mensaje: "Reserva externa procesada", reserva });
  } catch (error) {
    await pool.query(
      "UPDATE reservas_externas SET estado = 'rechazada', procesado_en = NOW() WHERE id = ?",
      [resultado.insertId]
    );
    const detalle = error.response ? error.response.data : error.message;
    res.status(502).json({ error: "No se pudo crear la reserva interna", detalle });
  }
}

/** GET /api/channel/reservas-externas */
async function listarReservasExternas(req, res) {
  const [filas] = await pool.query("SELECT * FROM reservas_externas ORDER BY id DESC");
  res.json(filas);
}

/** GET /api/channel/sync-log */
async function listarSyncLog(req, res) {
  const [filas] = await pool.query("SELECT * FROM sync_log ORDER BY id DESC LIMIT 100");
  res.json(filas);
}

module.exports = {
  listarMappings,
  crearMapping,
  recibirWebhook,
  listarReservasExternas,
  listarSyncLog
};
