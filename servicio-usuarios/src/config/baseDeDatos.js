const { Pool } = require("pg");

// Pool de conexiones hacia la base de datos de usuarios (usuarios_db).
// Aqui se almacenan los usuarios del sistema con sus roles y passwords hasheados.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10
});

module.exports = pool;
