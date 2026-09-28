const { Pool } = require("pg");

// Base de datos propia de este microservicio (reservas_db). No se comparte
// con el servicio de disponibilidad y tarifas: si este ultimo necesita
// datos de una reserva lo hace a traves de su API, nunca leyendo esta
// base de datos directamente.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10
});

module.exports = pool;
