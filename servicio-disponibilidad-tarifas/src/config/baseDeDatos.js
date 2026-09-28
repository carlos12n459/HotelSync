const { Pool } = require("pg");

// Pool de conexiones hacia la base de datos propia de este microservicio
// (disponibilidad_tarifas_db). Cada microservicio de HotelSync tiene su
// propia base de datos, asi que este pool nunca se comparte con el
// servicio de reservas.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10
});

module.exports = pool;
