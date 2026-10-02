const bcrypt = require("bcryptjs");
const pool = require("../config/baseDeDatos");
const { ROLES_PERMITIDOS, generarToken } = require("../middleware/auth");

// Numero de rondas para el hash de bcrypt. Valor por defecto seguro para dev.
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

/**
 * POST /api/auth/register
 * Registra un usuario nuevo con password hasheado.
 * Campos: nombre, email, password, rol (opcional, default 'cliente').
 */
async function registrar(req, res) {
  const { nombre, email, password, rol = "cliente" } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "nombre, email y password son obligatorios" });
  }

  if (!ROLES_PERMITIDOS.includes(rol)) {
    return res.status(400).json({ error: `Rol invalido. Roles permitidos: ${ROLES_PERMITIDOS.join(", ")}` });
  }

  try {
    // Verificar que el email no exista.
    const { rows: existentes } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existentes.length > 0) {
      return res.status(409).json({ error: "El email ya esta registrado" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { rows: resultado } = await pool.query(
      "INSERT INTO users (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol, creado_en",
      [nombre, email, passwordHash, rol]
    );

    const usuario = resultado[0];
    const token = generarToken(usuario);

    res.status(201).json({ usuario, token });
  } catch (error) {
    console.error("[usuarios] Error en registro:", error.message);
    res.status(500).json({ error: "No se pudo registrar el usuario", detalle: error.message });
  }
}

/**
 * POST /api/auth/login
 * Valida email/password y devuelve un JWT.
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email y password son obligatorios" });
  }

  try {
    const { rows } = await pool.query("SELECT id, nombre, email, rol, password_hash FROM users WHERE email = $1", [email]);

    if (rows.length === 0) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const usuario = rows[0];
    const passwordValido = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValido) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    // No devolver el hash en la respuesta.
    const { password_hash, ...usuarioPublico } = usuario;
    const token = generarToken(usuarioPublico);

    res.json({ usuario: usuarioPublico, token });
  } catch (error) {
    console.error("[usuarios] Error en login:", error.message);
    res.status(500).json({ error: "No se pudo iniciar sesion", detalle: error.message });
  }
}

/**
 * GET /api/auth/perfil
 * Devuelve el perfil del usuario autenticado.
 */
async function perfil(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT id, nombre, email, rol, creado_en FROM users WHERE id = $1",
      [req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener perfil", detalle: error.message });
  }
}

/**
 * GET /api/usuarios/:id
 * Devuelve un usuario por id (cualquier usuario autenticado puede consultar).
 */
async function obtenerUsuario(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT id, nombre, email, rol, creado_en FROM users WHERE id = $1",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuario", detalle: error.message });
  }
}

/**
 * PATCH /api/usuarios/:id/rol
 * Solo admin puede cambiar el rol de un usuario.
 */
async function cambiarRol(req, res) {
  const { rol } = req.body;

  if (!rol || !ROLES_PERMITIDOS.includes(rol)) {
    return res.status(400).json({ error: `Rol invalido. Roles permitidos: ${ROLES_PERMITIDOS.join(", ")}` });
  }

  try {
    const { rows: existe } = await pool.query("SELECT id FROM users WHERE id = $1", [req.params.id]);
    if (existe.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const { rows } = await pool.query(
      "UPDATE users SET rol = $1 WHERE id = $2 RETURNING id, nombre, email, rol, creado_en",
      [rol, req.params.id]
    );

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar rol", detalle: error.message });
  }
}

module.exports = { registrar, login, perfil, obtenerUsuario, cambiarRol };
