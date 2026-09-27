const mysql = require("mysql2/promise");

// Pool de conexiones hacia la base de datos propia de este microservicio
// (disponibilidad_tarifas_db). Cada microservicio de HotelSync tiene su
// propia base de datos, así que este pool nunca se comparte con el
// servicio de reservas.
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
