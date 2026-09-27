const mysql = require("mysql2/promise");

// Base de datos propia de este microservicio (facturacion_db). No se comparte
// con otros servicios: cualquier dato que se necesite de reservas o recepcion
// se obtiene a traves de su API, nunca leyendo su base de datos directamente.
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
