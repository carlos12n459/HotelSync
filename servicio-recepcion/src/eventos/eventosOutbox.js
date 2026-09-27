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

/** GET /api/eventos/pendientes?tipo=checkout.completed&consumidor=housekeeping */
async function listarEventosPendientes(req, res) {
  const { tipo, consumidor } = req.query;
  const [filas] = await pool.query(
    `SELECT e.id, e.tipo, e.payload, e.creado_en
     FROM eventos_salientes e
     WHERE e.procesado = FALSE
       AND (? IS NULL OR e.tipo = ?)
       AND (? IS NULL OR NOT EXISTS (
         SELECT 1 FROM confirmaciones_eventos c
         WHERE c.evento_id = e.id AND c.consumidor = ?
       ))
     ORDER BY e.id ASC`,
    [tipo || null, tipo || null, consumidor || null, consumidor || null]
  );
  res.json(filas);
}

/**
 * POST /api/eventos/:id/confirmar
 * Body opcional: { consumidor: "housekeeping" }
 * Registra la confirmación de un consumidor. El evento se marca como
 * procesado solo cuando todos los consumidores interesados lo hayan
 * confirmado. Para simplificar, asumimos que hay 2 consumidores de
 * checkout.completed: facturacion y housekeeping.
 */
async function confirmarEventoProcesado(req, res) {
  const { consumidor } = req.body || {};
  const eventoId = req.params.id;

  if (consumidor) {
    await pool.query(
      "INSERT INTO confirmaciones_eventos (evento_id, consumidor) VALUES (?, ?) ON DUPLICATE KEY UPDATE confirmado_en = NOW()",
      [eventoId, consumidor]
    );

    const [confirmaciones] = await pool.query(
      "SELECT DISTINCT consumidor FROM confirmaciones_eventos WHERE evento_id = ?",
      [eventoId]
    );

    // Para checkout.completed se esperan confirmaciones de facturacion y housekeeping.
    // Para booking.completed se espera confirmación de fidelizacion.
    const consumidoresConfirmados = confirmaciones.map((c) => c.consumidor);
    const completamenteProcesado =
      consumidoresConfirmados.includes("facturacion") &&
      consumidoresConfirmados.includes("housekeeping");

    if (completamenteProcesado) {
      await pool.query(
        "UPDATE eventos_salientes SET procesado = TRUE, procesado_en = NOW() WHERE id = ?",
        [eventoId]
      );
    }
  } else {
    // Comportamiento legacy: marcar directamente como procesado.
    await pool.query(
      "UPDATE eventos_salientes SET procesado = TRUE, procesado_en = NOW() WHERE id = ?",
      [eventoId]
    );
  }

  res.json({ confirmado: true });
}

module.exports = { registrarEventoSaliente, listarEventosPendientes, confirmarEventoProcesado };
