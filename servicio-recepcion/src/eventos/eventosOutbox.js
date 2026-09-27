const pool = require("../config/baseDeDatos");

/**
 * Comunicación ASÍNCRONA sin broker externo (mismo patrón "outbox" que usa
 * servicio-reservas): en vez de publicar a RabbitMQ, el evento se guarda en
 * una tabla de esta misma base de datos. Recepción responde al huésped de
 * inmediato al hacer checkout, SIN esperar a que housekeeping lo procese.
 * housekeeping lo recoge más tarde mediante polling HTTP.
 */
async function registrarEventoSaliente(tipo, payload) {
  await pool.query(
    "INSERT INTO eventos_salientes (tipo, payload) VALUES (?, ?)",
    [tipo, JSON.stringify(payload)]
  );
  console.log(`[recepcion] Evento registrado en outbox: ${tipo}`, payload);
}

/** GET /api/eventos/pendientes?tipo=checkout.completed — lo consulta housekeeping. */
async function listarEventosPendientes(req, res) {
  const { tipo } = req.query;
  const [filas] = await pool.query(
    "SELECT id, tipo, payload, creado_en FROM eventos_salientes WHERE procesado = FALSE AND (? IS NULL OR tipo = ?) ORDER BY id ASC",
    [tipo || null, tipo || null]
  );
  res.json(filas);
}

/** POST /api/eventos/:id/confirmar — housekeeping lo llama tras procesar el evento. */
async function confirmarEventoProcesado(req, res) {
  await pool.query(
    "UPDATE eventos_salientes SET procesado = TRUE, procesado_en = NOW() WHERE id = ?",
    [req.params.id]
  );
  res.json({ confirmado: true });
}

module.exports = { registrarEventoSaliente, listarEventosPendientes, confirmarEventoProcesado };
