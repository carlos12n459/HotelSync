const pool = require("../config/baseDeDatos");
const { publish } = require("../eventos/rabbitmq");
const { connectRedis, client, cacheKey } = require("../cache/redis");

/** Emite el evento availability.updated para un rango de fechas. */
async function notificarCambioDisponibilidad(tipo_habitacion_id, checkin, checkout) {
  const fechas = generarRangoDeFechas(checkin, checkout);
  try {
    await publish("availability.updated", {
      tipo_habitacion_id: Number(tipo_habitacion_id),
      checkin,
      checkout,
      fechas,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[disponibilidad-tarifas] No se pudo publicar availability.updated:", error.message);
  }
}

/** Invalida la cache de disponibilidad para un rango de fechas. */
async function invalidarCache(tipo_habitacion_id, checkin, checkout) {
  try {
    await connectRedis();
    await client.del(cacheKey(tipo_habitacion_id, checkin, checkout));
  } catch (error) {
    console.warn("[disponibilidad-tarifas] No se pudo invalidar cache:", error.message);
  }
}

/** Genera un arreglo de fechas [checkin, checkout) en formato YYYY-MM-DD. */
function generarRangoDeFechas(checkin, checkout) {
  const fechas = [];
  const actual = new Date(checkin);
  const fin = new Date(checkout);
  while (actual < fin) {
    fechas.push(actual.toISOString().slice(0, 10));
    actual.setDate(actual.getDate() + 1);
  }
  return fechas;
}

/** GET /api/tipos-habitacion — catalogo simple para poblar el frontend/pruebas. */
async function listarTiposHabitacion(req, res) {
  const { rows } = await pool.query("SELECT * FROM tipos_habitacion");
  res.json(rows);
}

/**
 * GET /api/disponibilidad?tipo_habitacion_id=&checkin=&checkout=
 * Consulta sincrona de solo lectura: cuantas habitaciones quedan libres
 * en TODO el rango de fechas solicitado (el minimo dia a dia).
 * Usa Redis como cache de lectura.
 */
async function consultarDisponibilidad(req, res) {
  const { tipo_habitacion_id, checkin, checkout } = req.query;

  if (!tipo_habitacion_id || !checkin || !checkout) {
    return res.status(400).json({
      error: "Se requieren tipo_habitacion_id, checkin y checkout"
    });
  }

  const fechas = generarRangoDeFechas(checkin, checkout);
  const key = cacheKey(tipo_habitacion_id, checkin, checkout);

  try {
    await connectRedis();
    const cached = await client.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (error) {
    console.warn("[disponibilidad-tarifas] Cache no disponible:", error.message);
  }

  const { rows: filas } = await pool.query(
    `SELECT fecha, (cantidad_disponible - cantidad_bloqueada) AS libres
     FROM inventario
     WHERE tipo_habitacion_id = $1 AND fecha = ANY($2::date[])`,
    [tipo_habitacion_id, fechas]
  );

  if (filas.length < fechas.length) {
    return res.json({ disponible: false, motivo: "No hay inventario cargado para todo el rango" });
  }

  const minimoLibres = Math.min(...filas.map((f) => f.libres));
  const resultado = { disponible: minimoLibres > 0, habitaciones_libres: minimoLibres };

  try {
    await client.setEx(key, 60, JSON.stringify(resultado));
  } catch (error) {
    console.warn("[disponibilidad-tarifas] No se pudo guardar cache:", error.message);
  }

  res.json(resultado);
}

/**
 * POST /api/disponibilidad/bloquear
 * Llamada SINCRONA que hace el servicio de reservas antes de confirmar
 * una reserva. Usa una transaccion con bloqueo de filas (FOR UPDATE)
 * para evitar sobreventa.
 */
async function bloquearInventario(req, res) {
  const { tipo_habitacion_id, checkin, checkout, cantidad = 1 } = req.body;

  if (!tipo_habitacion_id || !checkin || !checkout) {
    return res.status(400).json({
      error: "Se requieren tipo_habitacion_id, checkin y checkout"
    });
  }

  const fechas = generarRangoDeFechas(checkin, checkout);
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const { rows: filas } = await cliente.query(
      `SELECT id, fecha, cantidad_disponible, cantidad_bloqueada
       FROM inventario
       WHERE tipo_habitacion_id = $1 AND fecha = ANY($2::date[])
       FOR UPDATE`,
      [tipo_habitacion_id, fechas]
    );

    const hayInventarioIncompleto = filas.length < fechas.length;
    const hayDisponibilidad = filas.every(
      (f) => f.cantidad_disponible - f.cantidad_bloqueada >= cantidad
    );

    if (hayInventarioIncompleto || !hayDisponibilidad) {
      await cliente.query("ROLLBACK");
      return res.status(409).json({
        error: "No hay disponibilidad suficiente para el rango solicitado"
      });
    }

    await cliente.query(
      `UPDATE inventario
       SET cantidad_bloqueada = cantidad_bloqueada + $1
       WHERE tipo_habitacion_id = $2 AND fecha = ANY($3::date[])`,
      [cantidad, tipo_habitacion_id, fechas]
    );

    await cliente.query("COMMIT");

    await invalidarCache(tipo_habitacion_id, checkin, checkout);
    await notificarCambioDisponibilidad(tipo_habitacion_id, checkin, checkout);

    res.json({ bloqueado: true });
  } catch (error) {
    await cliente.query("ROLLBACK");
    res.status(500).json({ error: "Error al bloquear el inventario", detalle: error.message });
  } finally {
    cliente.release();
  }
}

/**
 * Libera inventario previamente bloqueado. La usa directamente el
 * consumidor de eventos (booking.cancelled) cuando una reserva se
 * cancela, pero tambien se expone como endpoint REST por si se
 * necesita liberar manualmente durante las pruebas.
 */
async function liberarInventario({ tipo_habitacion_id, checkin, checkout, cantidad = 1 }) {
  const fechas = generarRangoDeFechas(checkin, checkout);

  await pool.query(
    `UPDATE inventario
     SET cantidad_bloqueada = GREATEST(cantidad_bloqueada - $1, 0)
     WHERE tipo_habitacion_id = $2 AND fecha = ANY($3::date[])`,
    [cantidad, tipo_habitacion_id, fechas]
  );

  await invalidarCache(tipo_habitacion_id, checkin, checkout);
  await notificarCambioDisponibilidad(tipo_habitacion_id, checkin, checkout);
}

/** POST /api/disponibilidad/liberar — version REST manual de liberarInventario. */
async function liberarInventarioEndpoint(req, res) {
  try {
    await liberarInventario(req.body);
    res.json({ liberado: true });
  } catch (error) {
    res.status(500).json({ error: "Error al liberar el inventario", detalle: error.message });
  }
}

module.exports = {
  listarTiposHabitacion,
  consultarDisponibilidad,
  bloquearInventario,
  liberarInventario,
  liberarInventarioEndpoint
};
