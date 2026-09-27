require("dotenv").config();
const express = require("express");
const cors = require("cors");

const disponibilidadRoutes = require("./routes/disponibilidadRoutes");
const eventoRoutes = require("./routes/eventoRoutes");
const { iniciarPollingReservaCancelada } = require("./pollers/reservaCanceladaPoller");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "disponibilidad-tarifas" }));
app.use("/api", disponibilidadRoutes);
app.use("/api", eventoRoutes);

const PUERTO = process.env.PORT || 3001;

app.listen(PUERTO, () => {
  console.log(`[disponibilidad-tarifas] Escuchando en http://localhost:${PUERTO}`);
  iniciarPollingReservaCancelada();
});
