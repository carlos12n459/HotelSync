require("dotenv").config();
const express = require("express");
const cors = require("cors");

const analyticsRoutes = require("./routes/analyticsRoutes");
const { calcularKPIs } = require("./etl/calcularKPIs");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "analytics" }));
app.use("/api", analyticsRoutes);

const PUERTO = process.env.PORT || 3009;
const INTERVALO_ETL_MS = 60000;

async function iniciarETL() {
  console.log("[analytics] Ejecutando ETL inicial...");
  await calcularKPIs();
  setInterval(async () => {
    console.log("[analytics] Ejecutando ETL programado...");
    await calcularKPIs();
  }, INTERVALO_ETL_MS);
}

app.listen(PUERTO, () => {
  console.log(`[analytics] Escuchando en http://localhost:${PUERTO}`);
  iniciarETL();
});
