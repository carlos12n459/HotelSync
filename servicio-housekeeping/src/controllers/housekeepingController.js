const pool = require("../config/baseDeDatos");

/** GET /api/housekeeping/habitaciones?hotel_id= */
async function listarHabitaciones(req, res) {
  const { hotel_id } = req.query;
  const condiciones = hotel_id ? "WHERE hotel_id = ?" : "";
  const parametros = hotel_id ? [hotel_id] : [];

  const [filas] = await pool.query(
    `SELECT * FROM estado_habitaciones ${condiciones} ORDER BY numero_habitacion ASC`,
    parametros
  );
  res.json(filas);
}

/**
 * GET /api/housekeeping/habitaciones/:numero/estado
 * Consultada de forma SÍNCRONA por servicio-recepcion antes de un check-in.
 */
async function consultarEstado(req, res) {
  const [filas] = await pool.query(
    "SELECT * FROM estado_habitaciones WHERE numero_habitacion = ?",
    [req.params.numero]
  );

  if (filas.length === 0) {
    return res.status(404).json({ error: "Habitación no registrada en housekeeping" });
  }
  res.json(filas[0]);
}

/**
 * PATCH /api/housekeeping/habitaciones/:numero/estado
 * Actualización manual hecha por el personal de limpieza (ej. marcar
 * "en_limpieza" y luego "lista"), independiente del flujo automático.
 */
async function actualizarEstado(req, res) {
  const { numero } = req.params;
  const { estado, asignado_a } = req.body;

  const estadosValidos = ["sucia", "en_limpieza", "lista", "mantenimiento"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${estadosValidos.join(", ")}` });
  }

  const [existente] = await pool.query("SELECT * FROM estado_habitaciones WHERE numero_habitacion = ?", [numero]);
  const estadoAnterior = existente[0] ? existente[0].estado : null;

  await pool.query(
    `INSERT INTO estado_habitaciones (numero_habitacion, hotel_id, estado, asignado_a)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE estado = VALUES(estado), asignado_a = VALUES(asignado_a)`,
    [numero, req.body.hotel_id || (existente[0] ? existente[0].hotel_id : 1), estado, asignado_a || null]
  );

  await pool.query(
    "INSERT INTO historial_limpieza (numero_habitacion, estado_anterior, estado_nuevo, origen) VALUES (?, ?, ?, 'actualizacion_manual')",
    [numero, estadoAnterior, estado]
  );

  const [filas] = await pool.query("SELECT * FROM estado_habitaciones WHERE numero_habitacion = ?", [numero]);
  res.json(filas[0]);
}

/**
 * Genera automáticamente la tarea de limpieza (estado "sucia") tras un
 * checkout. La usa el poller de eventos, no se expone como ruta HTTP propia.
 */
async function generarTareaLimpiezaPorCheckout({ numero_habitacion, hotel_id }) {
  const [existente] = await pool.query(
    "SELECT * FROM estado_habitaciones WHERE numero_habitacion = ?",
    [numero_habitacion]
  );
  const estadoAnterior = existente[0] ? existente[0].estado : null;

  await pool.query(
    `INSERT INTO estado_habitaciones (numero_habitacion, hotel_id, estado)
     VALUES (?, ?, 'sucia')
     ON DUPLICATE KEY UPDATE estado = 'sucia'`,
    [numero_habitacion, hotel_id || 1]
  );

  await pool.query(
    "INSERT INTO historial_limpieza (numero_habitacion, estado_anterior, estado_nuevo, origen) VALUES (?, ?, 'sucia', 'evento_async')",
    [numero_habitacion, estadoAnterior]
  );
}

module.exports = {
  listarHabitaciones,
  consultarEstado,
  actualizarEstado,
  generarTareaLimpiezaPorCheckout
};
