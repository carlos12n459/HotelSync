require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const archivoRoutes = require("./routes/archivoRoutes");
const { UPLOAD_DIR } = require("./config/multer");

const app = express();
app.use(cors());
app.use(express.json());

// Servir la carpeta uploads como archivos estaticos bajo /archivos.
// Asi el frontend y otros servicios pueden acceder a las imagenes directamente.
app.use("/archivos", express.static(path.resolve(UPLOAD_DIR)));

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "archivos" }));
app.use("/api", archivoRoutes);

const PUERTO = process.env.PORT || 3012;

app.listen(PUERTO, () => {
  console.log(`[archivos] Escuchando en http://localhost:${PUERTO}`);
});
