const pool = require("../config/baseDeDatos");
const { registrarEventoSaliente } = require("../eventos/eventosOutbox");

/** Emite el evento availability.updated para un rango de fechas. */
async function notificarCambioDisponibilidad(tipo_habitacion_id, checkin, checkout) {
  const fechas = generarRangoDeFechas(checkin, checkout);
  try {
    await registrarEventoSaliente("availability.updated", {
      tipo_habitacion_id: Number(tipo_habitacion_id),
      checkin,
      checkout,
      fechas,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[disponibilidad-tarifas] No se pudo registrar availability.updated:", error.message);
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

/** GET /api/tipos-habitacion — catálogo simple para poblar el frontend/pruebas. */
async function listarTiposHabitacion(req, res) {
  const [filas] = await pool.query("SELECT * FROM tipos_habitacion");
  res.json(filas);
}

/**
 * GET /api/disponibilidad?tipo_habitacion_id=&checkin=&checkout=
 * Consulta síncrona de solo lectura: cuántas habitaciones quedan libres
 * en TODO el rango de fechas solicitado (el mínimo día a día).
 */
async function consultarDisponibilidad(req, res) {
  const { tipo_habitacion_id, checkin, checkout } = req.query;

  if (!tipo_habitacion_id || !checkin || !checkout) {
    return res.status(400).json({
      error: "Se requieren tipo_habitacion_id, checkin y checkout"
    });
  }

  const fechas = generarRangoDeFechas(checkin, checkout);

  const [filas] = await pool.query(
    `SELECT fecha, (cantidad_disponible - cantidad_bloqueada) AS libres
     FROM inventario
     WHERE tipo_habitacion_id = ? AND fecha IN (?)`,
    [tipo_habitacion_id, fechas]
  );

  if (filas.length < fechas.length) {
    return res.json({ disponible: false, motivo: "No hay inventario cargado para todo el rango" });
  }

  const minimoLibres = Math.min(...filas.map((f) => f.libres));
  res.json({ disponible: minimoLibres > 0, habitaciones_libres: minimoLibres });
}

/**
 * POST /api/disponibilidad/bloquear
 * Llamada SÍNCRONA que hace el servicio de reservas antes de confirmar
 * una reserva. Usa una transacción con bloqueo de filas (FOR UPDATE)
 * para que, si dos reservas llegan casi al mismo tiempo por la misma
 * habitación, solo una de las dos logre bloquear el inventario y la
 * otra reciba un 409 (evitando así la sobreventa).
 */
async function bloquearInventario(req, res) {
  const { tipo_habitacion_id, checkin, checkout, cantidad = 1 } = req.body;

  if (!tipo_habitacion_id || !checkin || !checkout) {
    return res.status(400).json({
      error: "Se requieren tipo_habitacion_id, checkin y checkout"
    });
  }

  const fechas = generarRangoDeFechas(checkin, checkout);
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();

    const [filas] = await conexion.query(
      `SELECT id, fecha, cantidad_disponible, cantidad_bloqueada
       FROM inventario
       WHERE tipo_habitacion_id = ? AND fecha IN (?)
       FOR UPDATE`,
      [tipo_habitacion_id, fechas]
    );

    const hayInventarioIncompleto = filas.length < fechas.length;
    const hayDisponibilidad = filas.every(
      (f) => f.cantidad_disponible - f.cantidad_bloqueada >= cantidad
    );

    if (hayInventarioIncompleto || !hayDisponibilidad) {
      await conexion.rollback();
      return res.status(409).json({
        error: "No hay disponibilidad suficiente para el rango solicitado"
      });
    }

    await conexion.query(
      `UPDATE inventario
       SET cantidad_bloqueada = cantidad_bloqueada + ?
       WHERE tipo_habitacion_id = ? AND fecha IN (?)`,
      [cantidad, tipo_habitacion_id, fechas]
    );

    await conexion.commit();

    // Notificar el cambio de inventario de forma asíncrona.
    await notificarCambioDisponibilidad(tipo_habitacion_id, checkin, checkout);

    res.json({ bloqueado: true });
  } catch (error) {
    await conexion.rollback();
    res.status(500).json({ error: "Error al bloquear el inventario", detalle: error.message });
  } finally {
    conexion.release();
  }
}

/**
 * Libera inventario previamente bloqueado. La usa directamente el
 * consumidor de eventos (booking.cancelled) cuando una reserva se
 * cancela, pero también se expone como endpoint REST por si se
 * necesita liberar manualmente durante las pruebas.
 */
async function liberarInventario({ tipo_habitacion_id, checkin, checkout, cantidad = 1 }) {
  const fechas = generarRangoDeFechas(checkin, checkout);

  await pool.query(
    `UPDATE inventario
     SET cantidad_bloqueada = GREATEST(cantidad_bloqueada - ?, 0)
     WHERE tipo_habitacion_id = ? AND fecha IN (?)`,
    [cantidad, tipo_habitacion_id, fechas]
  );

  await notificarCambioDisponibilidad(tipo_habitacion_id, checkin, checkout);
}

/** POST /api/disponibilidad/liberar — versión REST manual de liberarInventario. */
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
