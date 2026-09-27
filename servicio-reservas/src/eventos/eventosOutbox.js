const pool = require("../config/baseDeDatos");

/**
 * Comunicación ASÍNCRONA sin broker externo (patrón "outbox"):
 * en vez de publicar el evento a RabbitMQ, se guarda en una tabla de
 * esta misma base de datos. El servicio de reservas responde al usuario
 * de inmediato, SIN esperar a que nadie procese el evento. El servicio
 * de disponibilidad lo recoge más tarde mediante polling HTTP
 * (ver GET /api/eventos/pendientes) y lo marca como procesado.
 */
async function registrarEventoSaliente(tipo, payload) {
  await pool.query(
    "INSERT INTO eventos_salientes (tipo, payload) VALUES (?, ?)",
    [tipo, JSON.stringify(payload)]
  );
  console.log(`[reservas] Evento registrado en outbox: ${tipo}`, payload);
}

/** GET /api/eventos/pendientes?tipo=booking.cancelled — los consulta el otro microservicio. */
async function listarEventosPendientes(req, res) {
  const { tipo } = req.query;
  const [filas] = await pool.query(
    "SELECT id, tipo, payload, creado_en FROM eventos_salientes WHERE procesado = FALSE AND (? IS NULL OR tipo = ?) ORDER BY id ASC",
    [tipo || null, tipo || null]
  );
  res.json(filas);
}

/** POST /api/eventos/:id/confirmar — el otro microservicio lo llama tras procesar el evento. */
async function confirmarEventoProcesado(req, res) {
  await pool.query(
    "UPDATE eventos_salientes SET procesado = TRUE, procesado_en = NOW() WHERE id = ?",
    [req.params.id]
  );
  res.json({ confirmado: true });
}

module.exports = { registrarEventoSaliente, listarEventosPendientes, confirmarEventoProcesado };
