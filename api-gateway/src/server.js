require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
app.use(cors());

// Mismo secreto que usa servicio-usuarios.
const JWT_SECRET = process.env.JWT_SECRET || "cambiar_en_produccion";

// Rutas publicas que no requieren token.
const RUTAS_PUBLICAS = [
  "/usuarios/auth/register",
  "/usuarios/auth/login"
];

// Mapa de rutas del gateway hacia cada microservicio.
const servicios = {
  "/disponibilidad": process.env.URL_SERVICIO_DISPONIBILIDAD,
  "/reservas": process.env.URL_SERVICIO_RESERVAS,
  "/recepcion": process.env.URL_SERVICIO_RECEPCION,
  "/housekeeping": process.env.URL_SERVICIO_HOUSEKEEPING,
  "/propiedades": process.env.URL_SERVICIO_PROPIEDADES,
  "/channel": process.env.URL_SERVICIO_CHANNEL_MANAGER,
  "/facturacion": process.env.URL_SERVICIO_FACTURACION,
  "/fidelizacion": process.env.URL_SERVICIO_FIDELIZACION,
  "/analytics": process.env.URL_SERVICIO_ANALYTICS,
  "/usuarios": process.env.URL_SERVICIO_USUARIOS,
  "/archivos": process.env.URL_SERVICIO_ARCHIVOS
};

/**
 * Determina si una ruta esta en la lista blanca de rutas publicas.
 */
function esRutaPublica(path) {
  return RUTAS_PUBLICAS.some((publica) => path === publica || path.startsWith(publica + "/"));
}

/**
 * Middleware opcional de verificacion JWT.
 * - Si el header Authorization tiene un token valido, adjunta req.user.
 * - Si no hay token o es invalido, permite continuar con req.user = null.
 * Esto evita romper el flujo de demo mientras se integra el frontend.
 */
function verificarJwtOpcional(req, res, next) {
  if (esRutaPublica(req.path)) {
    req.user = null;
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    req.user = null;
  }

  next();
}

app.use(verificarJwtOpcional);

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "api-gateway", rutas: Object.keys(servicios) }));

// Proxy hacia cada microservicio. Se reescribe el path agregando /api internamente.
for (const [ruta, target] of Object.entries(servicios)) {
  if (!target) continue;

  app.use(
    ruta,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: (path) => `/api${path}`,
      on: {
        error: (err, req, res) => {
          res.status(502).json({ error: `Servicio ${ruta} no disponible`, detalle: err.message });
        },
        proxyReq: (proxyReq, req) => {
          // Reenviamos la informacion del usuario autenticado a los servicios.
          // Esto permite que propiedades/reservas filtren por owner_id / usuario_id.
          if (req.user) {
            proxyReq.setHeader("x-user-id", String(req.user.id || ""));
            proxyReq.setHeader("x-user-rol", String(req.user.rol || ""));
            proxyReq.setHeader("x-user-email", String(req.user.email || ""));
          }
        }
      }
    })
  );
}

const PUERTO = process.env.PORT || 3010;

app.listen(PUERTO, () => {
  console.log(`[api-gateway] Escuchando en http://localhost:${PUERTO}`);
});
