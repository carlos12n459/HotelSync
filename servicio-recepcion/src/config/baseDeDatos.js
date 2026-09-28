const { Pool } = require("pg");

// Pool de conexiones hacia la base de datos propia de este microservicio
// (recepcion_db). Contiene las llegadas, asignaciones e incidencias del
// front desk.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10
});

module.exports = pool;
