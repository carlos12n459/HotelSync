const pool = require("../config/baseDeDatos");

/** GET /api/housekeeping/habitaciones?hotel_id= */
async function listarHabitaciones(req, res) {
  const { hotel_id } = req.query;
  const condiciones = hotel_id ? "WHERE hotel_id = $1" : "";
  const parametros = hotel_id ? [hotel_id] : [];

  const { rows } = await pool.query(
    `SELECT * FROM estado_habitaciones ${condiciones} ORDER BY numero_habitacion ASC`,
    parametros
  );
  res.json(rows);
}

/**
 * GET /api/housekeeping/habitaciones/:numero/estado
 * Consultada de forma SINCRONA por servicio-recepcion antes de un check-in.
 */
async function consultarEstado(req, res) {
  const { rows } = await pool.query(
    "SELECT * FROM estado_habitaciones WHERE numero_habitacion = $1",
    [req.params.numero]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "Habitacion no registrada en housekeeping" });
  }
  res.json(rows[0]);
}

/**
 * PATCH /api/housekeeping/habitaciones/:numero/estado
 */
async function actualizarEstado(req, res) {
  const { numero } = req.params;
  const { estado, asignado_a } = req.body;

  const estadosValidos = ["sucia", "en_limpieza", "lista", "mantenimiento"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${estadosValidos.join(", ")}` });
  }

  const { rows: existente } = await pool.query("SELECT * FROM estado_habitaciones WHERE numero_habitacion = $1", [numero]);
  const estadoAnterior = existente[0] ? existente[0].estado : null;

  await pool.query(
    `INSERT INTO estado_habitaciones (numero_habitacion, hotel_id, estado, asignado_a)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (numero_habitacion) DO UPDATE SET
       estado = EXCLUDED.estado,
       asignado_a = EXCLUDED.asignado_a,
       actualizado_en = CURRENT_TIMESTAMP`,
    [numero, req.body.hotel_id || (existente[0] ? existente[0].hotel_id : 1), estado, asignado_a || null]
  );

  await pool.query(
    "INSERT INTO historial_limpieza (numero_habitacion, estado_anterior, estado_nuevo, origen) VALUES ($1, $2, $3, 'actualizacion_manual')",
    [numero, estadoAnterior, estado]
  );

  const { rows } = await pool.query("SELECT * FROM estado_habitaciones WHERE numero_habitacion = $1", [numero]);
  res.json(rows[0]);
}

/**
 * Genera automaticamente la tarea de limpieza (estado "sucia") tras un
 * checkout. La usa el consumidor de eventos.
 */
async function generarTareaLimpiezaPorCheckout({ numero_habitacion, hotel_id }) {
  const { rows: existente } = await pool.query(
    "SELECT * FROM estado_habitaciones WHERE numero_habitacion = $1",
    [numero_habitacion]
  );
  const estadoAnterior = existente[0] ? existente[0].estado : null;

  await pool.query(
    `INSERT INTO estado_habitaciones (numero_habitacion, hotel_id, estado)
     VALUES ($1, $2, 'sucia')
     ON CONFLICT (numero_habitacion) DO UPDATE SET
       estado = 'sucia',
       actualizado_en = CURRENT_TIMESTAMP`,
    [numero_habitacion, hotel_id || 1]
  );

  await pool.query(
    "INSERT INTO historial_limpieza (numero_habitacion, estado_anterior, estado_nuevo, origen) VALUES ($1, $2, 'sucia', 'evento_async')",
    [numero_habitacion, estadoAnterior]
  );
}

module.exports = {
  listarHabitaciones,
  consultarEstado,
  actualizarEstado,
  generarTareaLimpiezaPorCheckout
};
