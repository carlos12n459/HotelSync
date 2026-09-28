const pool = require("../config/baseDeDatos");
const reservasClient = require("../clientes/reservasClient");
const { publish, consume } = require("../eventos/rabbitmq");

/** GET /api/channel/mappings */
async function listarMappings(req, res) {
  const { rows } = await pool.query("SELECT * FROM channel_mappings ORDER BY id");
  res.json(rows);
}

/** POST /api/channel/mappings */
async function crearMapping(req, res) {
  const { room_type_id, channel_name, external_room_id, hotel_id } = req.body;
  if (!room_type_id || !channel_name || !external_room_id || !hotel_id) {
    return res.status(400).json({ error: "room_type_id, channel_name, external_room_id y hotel_id son obligatorios" });
  }
  const { rows: resultado } = await pool.query(
    "INSERT INTO channel_mappings (room_type_id, channel_name, external_room_id, hotel_id) VALUES ($1, $2, $3, $4) RETURNING id",
    [room_type_id, channel_name, external_room_id, hotel_id]
  );
  const { rows } = await pool.query("SELECT * FROM channel_mappings WHERE id = $1", [resultado[0].id]);
  res.status(201).json(rows[0]);
}

/**
 * POST /api/channel/webhook/:channel
 * Simula la llegada de una reserva desde una OTA.
 */
async function recibirWebhook(req, res) {
  const channel = req.params.channel;
  const payload = req.body;

  if (!payload.external_id) {
    return res.status(400).json({ error: "external_id es obligatorio" });
  }

  // Idempotencia: no procesar la misma reserva externa dos veces.
  const { rows: existente } = await pool.query(
    "SELECT * FROM reservas_externas WHERE channel_name = $1 AND external_id = $2",
    [channel, payload.external_id]
  );
  if (existente.length > 0) {
    return res.status(200).json({ mensaje: "Reserva externa ya fue recibida", reserva_externa: existente[0] });
  }

  const { rows: resultado } = await pool.query(
    "INSERT INTO reservas_externas (channel_name, external_id, payload) VALUES ($1, $2, $3) RETURNING id",
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
      "UPDATE reservas_externas SET estado = 'procesada', reserva_id = $1, procesado_en = CURRENT_TIMESTAMP WHERE id = $2",
      [reserva.id, resultado[0].id]
    );

    // Requisito: publicar booking.created al recibir webhooks.
    await publish("booking.created", {
      ...reserva,
      canal: channel,
      external_id: payload.external_id
    });

    res.status(201).json({ mensaje: "Reserva externa procesada", reserva });
  } catch (error) {
    await pool.query(
      "UPDATE reservas_externas SET estado = 'rechazada', procesado_en = CURRENT_TIMESTAMP WHERE id = $1",
      [resultado[0].id]
    );
    const detalle = error.response ? error.response.data : error.message;
    res.status(502).json({ error: "No se pudo crear la reserva interna", detalle });
  }
}

/** GET /api/channel/reservas-externas */
async function listarReservasExternas(req, res) {
  const { rows } = await pool.query("SELECT * FROM reservas_externas ORDER BY id DESC");
  res.json(rows);
}

/** GET /api/channel/sync-log */
async function listarSyncLog(req, res) {
  const { rows } = await pool.query("SELECT * FROM sync_log ORDER BY id DESC LIMIT 100");
  res.json(rows);
}

/**
 * Procesa el evento availability.updated de RabbitMQ.
 * Simula la sincronizacion de disponibilidad hacia los canales externos.
 */
async function procesarAvailabilityUpdated(payload) {
  try {
    const { rows: mappings } = await pool.query(
      "SELECT channel_name FROM channel_mappings WHERE room_type_id = $1 AND activo = TRUE",
      [payload.tipo_habitacion_id]
    );

    for (const mapping of mappings) {
      const libres = 5; // simulacion: en un caso real se calcularia con la fecha
      await pool.query(
        "INSERT INTO sync_log (channel_name, room_type_id, fecha, disponible, estado, respuesta) VALUES ($1, $2, $3, $4, $5, $6)",
        [mapping.channel_name, payload.tipo_habitacion_id, payload.checkin, libres, "ok", JSON.stringify(payload)]
      );
      console.log(`[channel-manager] Sincronizado ${mapping.channel_name} para tipo ${payload.tipo_habitacion_id}`);
    }
  } catch (error) {
    console.error("[channel-manager] Error procesando availability.updated:", error.message);
    throw error;
  }
}

module.exports = {
  listarMappings,
  crearMapping,
  recibirWebhook,
  listarReservasExternas,
  listarSyncLog,
  procesarAvailabilityUpdated
};
