require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
app.use(cors());
app.use(express.json());

const servicios = {
  "/disponibilidad": process.env.URL_SERVICIO_DISPONIBILIDAD,
  "/reservas": process.env.URL_SERVICIO_RESERVAS,
  "/recepcion": process.env.URL_SERVICIO_RECEPCION,
  "/housekeeping": process.env.URL_SERVICIO_HOUSEKEEPING,
  "/propiedades": process.env.URL_SERVICIO_PROPIEDADES,
  "/channel": process.env.URL_SERVICIO_CHANNEL_MANAGER,
  "/facturacion": process.env.URL_SERVICIO_FACTURACION,
  "/fidelizacion": process.env.URL_SERVICIO_FIDELIZACION,
  "/analytics": process.env.URL_SERVICIO_ANALYTICS
};

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "api-gateway", rutas: Object.keys(servicios) }));

for (const [ruta, target] of Object.entries(servicios)) {
  if (!target) continue;
  app.use(
    ruta,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { [`^${ruta}`]: "/api" },
      onError: (err, req, res) => {
        res.status(502).json({ error: `Servicio ${ruta} no disponible`, detalle: err.message });
      }
    })
  );
}

const PUERTO = process.env.PORT || 3010;

app.listen(PUERTO, () => {
  console.log(`[api-gateway] Escuchando en http://localhost:${PUERTO}`);
});
