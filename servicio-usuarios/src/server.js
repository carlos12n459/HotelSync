require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const usuarioRoutes = require("./routes/usuarioRoutes");
const pool = require("./config/baseDeDatos");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "usuarios" }));
app.use("/api", usuarioRoutes);

const PUERTO = process.env.PORT || 3011;

/**
 * Crea el usuario administrador semilla si no existe.
 * Esto garantiza que siempre haya una cuenta inicial para empezar a probar.
 */
async function crearAdminSemilla() {
  try {
    const email = process.env.ADMIN_EMAIL || "admin@hotelsync.com";
    const password = process.env.ADMIN_PASSWORD || "admin123";
    const nombre = "Administrador HotelSync";

    const hash = bcrypt.hashSync(password, 10);
    const existe = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

    if (existe.rows.length > 0) {
      // Actualiza el password para garantizar que coincida con la configuracion actual.
      await pool.query(
        "UPDATE users SET password_hash = $1, rol = 'admin' WHERE email = $2",
        [hash, email]
      );
      console.log("[usuarios] Admin semilla actualizado correctamente.");
      return;
    }

    await pool.query(
      "INSERT INTO users (nombre, email, password_hash, rol) VALUES ($1, $2, $3, 'admin')",
      [nombre, email, hash]
    );
    console.log("[usuarios] Admin semilla creado correctamente.");
  } catch (err) {
    console.error("[usuarios] Error creando admin semilla:", err.message);
  }
}

app.listen(PUERTO, () => {
  console.log(`[usuarios] Escuchando en http://localhost:${PUERTO}`);
  crearAdminSemilla();
});
