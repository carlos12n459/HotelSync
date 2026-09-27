require("dotenv").config();
const express = require("express");
const cors = require("cors");

const recepcionRoutes = require("./routes/recepcionRoutes");
const eventoRoutes = require("./routes/eventoRoutes");
const { iniciarPollingReservaCreada } = require("./pollers/reservaCreadaPoller");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "recepcion" }));
app.use("/api", recepcionRoutes);
app.use("/api", eventoRoutes);

const PUERTO = process.env.PORT || 3003;

app.listen(PUERTO, () => {
  console.log(`[recepcion] Escuchando en http://localhost:${PUERTO}`);
  iniciarPollingReservaCreada();
});
