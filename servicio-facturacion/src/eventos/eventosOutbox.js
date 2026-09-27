const pool = require("../config/baseDeDatos");

/**
 * Comunicacion ASINCRONA sin broker externo (patron "outbox"): en vez de
 * publicar a RabbitMQ, el evento se guarda en una tabla de esta misma base
 * de datos. Otros servicios lo recogen mas tarde mediante polling HTTP.
 */
async function registrarEventoSaliente(tipo, payload) {
  await pool.query(
    "INSERT INTO eventos_salientes (tipo, payload) VALUES (?, ?)",
    [tipo, JSON.stringify(payload)]
  );
  console.log(`[facturacion] Evento registrado en outbox: ${tipo}`, payload);
}

/** GET /api/eventos/pendientes?tipo=charge.added — lo consultan otros servicios. */
async function listarEventosPendientes(req, res) {
  const { tipo } = req.query;
  const [filas] = await pool.query(
    "SELECT id, tipo, payload, creado_en FROM eventos_salientes WHERE procesado = FALSE AND (? IS NULL OR tipo = ?) ORDER BY id ASC",
    [tipo || null, tipo || null]
  );
  res.json(filas);
}

/** POST /api/eventos/:id/confirmar — lo llama el consumidor tras procesar. */
async function confirmarEventoProcesado(req, res) {
  await pool.query(
    "UPDATE eventos_salientes SET procesado = TRUE, procesado_en = NOW() WHERE id = ?",
    [req.params.id]
  );
  res.json({ confirmado: true });
}

module.exports = { registrarEventoSaliente, listarEventosPendientes, confirmarEventoProcesado };
