const mysql = require("mysql2/promise");

// Base de datos propia de este microservicio (housekeeping_db). No se
// comparte con servicio-recepcion: cuando housekeeping necesita saber que
// hubo un checkout, lo recibe por evento asíncrono, nunca leyendo la base
// de datos de recepción directamente.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

module.exports = pool;
