const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cambiar_en_produccion";

// Roles permitidos en el sistema.
// cliente: huesped que reserva.
// admin: dueño total, administra todo.
// gerente: administra ciertos hoteles (por owner_id en esta version).
// empleado: operacion diaria.
const ROLES_PERMITIDOS = ["admin", "gerente", "empleado", "cliente"];

/**
 * Genera un JWT con la informacion basica del usuario.
 * El payload incluye id, email, nombre y rol.
 */
function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
  );
}

/**
 * Middleware que verifica el token JWT enviado en el header Authorization.
 * Si el token es valido, adjunta req.usuario y continua.
 * Si no hay token o es invalido, responde 401.
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

/**
 * Middleware de autorizacion por rol. Permite uno o varios roles.
 */
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tienes permiso para esta accion" });
    }
    next();
  };
}

module.exports = { ROLES_PERMITIDOS, generarToken, verificarToken, permitirRoles };
