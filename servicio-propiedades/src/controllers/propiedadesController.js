const pool = require("../config/baseDeDatos");

/** GET /api/hoteles */
async function listarHoteles(req, res) {
  const { rows } = await pool.query("SELECT * FROM hoteles ORDER BY id");
  res.json(rows);
}

/** GET /api/hoteles/:id */
async function obtenerHotel(req, res) {
  const { rows } = await pool.query("SELECT * FROM hoteles WHERE id = $1", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Hotel no encontrado" });
  res.json(rows[0]);
}

/** POST /api/hoteles */
async function crearHotel(req, res) {
  const { nombre, ciudad, pais, timezone, direccion } = req.body;
  if (!nombre || !ciudad || !pais) {
    return res.status(400).json({ error: "nombre, ciudad y pais son obligatorios" });
  }
  const { rows: resultado } = await pool.query(
    "INSERT INTO hoteles (nombre, ciudad, pais, timezone, direccion) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [nombre, ciudad, pais, timezone || "America/Bogota", direccion || null]
  );
  const { rows } = await pool.query("SELECT * FROM hoteles WHERE id = $1", [resultado[0].id]);
  res.status(201).json(rows[0]);
}

/** GET /api/hoteles/:hotel_id/tipos-habitacion */
async function listarTiposHabitacion(req, res) {
  const { rows } = await pool.query(
    "SELECT * FROM tipos_habitacion WHERE hotel_id = $1 ORDER BY id",
    [req.params.hotel_id]
  );
  res.json(rows);
}

/** GET /api/tipos-habitacion/:id */
async function obtenerTipoHabitacion(req, res) {
  const { rows } = await pool.query("SELECT * FROM tipos_habitacion WHERE id = $1", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Tipo de habitacion no encontrado" });
  res.json(rows[0]);
}

/** POST /api/hoteles/:hotel_id/tipos-habitacion */
async function crearTipoHabitacion(req, res) {
  const { hotel_id } = req.params;
  const { nombre, capacidad, tarifa_base, amenities, politica_cancelacion } = req.body;
  if (!nombre || tarifa_base === undefined) {
    return res.status(400).json({ error: "nombre y tarifa_base son obligatorios" });
  }
  const { rows: resultado } = await pool.query(
    "INSERT INTO tipos_habitacion (hotel_id, nombre, capacidad, tarifa_base, amenities, politica_cancelacion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [hotel_id, nombre, capacidad || 2, tarifa_base, amenities ? JSON.stringify(amenities) : null, politica_cancelacion || null]
  );
  const { rows } = await pool.query("SELECT * FROM tipos_habitacion WHERE id = $1", [resultado[0].id]);
  res.status(201).json(rows[0]);
}

/** GET /api/hoteles/:hotel_id/habitaciones */
async function listarHabitaciones(req, res) {
  const { rows } = await pool.query(
    "SELECT * FROM habitaciones WHERE hotel_id = $1 ORDER BY numero",
    [req.params.hotel_id]
  );
  res.json(rows);
}

/** POST /api/hoteles/:hotel_id/habitaciones */
async function crearHabitacion(req, res) {
  const { hotel_id } = req.params;
  const { numero, tipo_habitacion_id, piso } = req.body;
  if (!numero || !tipo_habitacion_id) {
    return res.status(400).json({ error: "numero y tipo_habitacion_id son obligatorios" });
  }
  const { rows: resultado } = await pool.query(
    "INSERT INTO habitaciones (hotel_id, numero, tipo_habitacion_id, piso) VALUES ($1, $2, $3, $4) RETURNING id",
    [hotel_id, numero, tipo_habitacion_id, piso || null]
  );
  const { rows } = await pool.query("SELECT * FROM habitaciones WHERE id = $1", [resultado[0].id]);
  res.status(201).json(rows[0]);
}

module.exports = {
  listarHoteles,
  obtenerHotel,
  crearHotel,
  listarTiposHabitacion,
  obtenerTipoHabitacion,
  crearTipoHabitacion,
  listarHabitaciones,
  crearHabitacion
};
