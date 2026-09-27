const pool = require("../config/baseDeDatos");

/**
 * Patrón "outbox": en vez de publicar directamente a un broker, los
 * eventos se guardan en la base de datos de este microservicio. Otros
 * servicios (Channel Manager, Analytics) los recogen mediante polling HTTP.
 */
async function registrarEventoSaliente(tipo, payload) {
  await pool.query(
    "INSERT INTO eventos_salientes (tipo, payload) VALUES (?, ?)",
    [tipo, JSON.stringify(payload)]
  );
  console.log(`[disponibilidad-tarifas] Evento registrado en outbox: ${tipo}`, payload);
}

/** GET /api/eventos/pendientes?tipo=availability.updated */
async function listarEventosPendientes(req, res) {
  const { tipo } = req.query;
  const [filas] = await pool.query(
    "SELECT id, tipo, payload, creado_en FROM eventos_salientes WHERE procesado = FALSE AND (? IS NULL OR tipo = ?) ORDER BY id ASC",
    [tipo || null, tipo || null]
  );
  res.json(filas);
}

/** POST /api/eventos/:id/confirmar */
async function confirmarEventoProcesado(req, res) {
  await pool.query(
    "UPDATE eventos_salientes SET procesado = TRUE, procesado_en = NOW() WHERE id = ?",
    [req.params.id]
  );
  res.json({ confirmado: true });
}

module.exports = { registrarEventoSaliente, listarEventosPendientes, confirmarEventoProcesado };
