require("dotenv").config();
const express = require("express");
const cors = require("cors");

const channelManagerRoutes = require("./routes/channelManagerRoutes");
const { iniciarPollingDisponibilidad } = require("./pollers/disponibilidadPoller");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "channel-manager" }));
app.use("/api", channelManagerRoutes);

const PUERTO = process.env.PORT || 3006;

app.listen(PUERTO, () => {
  console.log(`[channel-manager] Escuchando en http://localhost:${PUERTO}`);
  iniciarPollingDisponibilidad();
});
