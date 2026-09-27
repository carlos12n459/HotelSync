const mysql = require("mysql2/promise");

// Base de datos propia de este microservicio (reservas_db). No se comparte
// con el servicio de disponibilidad y tarifas: si este último necesita
// datos de una reserva lo hace a través de su API, nunca leyendo esta
// base de datos directamente.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
