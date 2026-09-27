require("dotenv").config();
const express = require("express");
const cors = require("cors");

const reservaRoutes = require("./routes/reservaRoutes");
const eventoRoutes = require("./routes/eventoRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "reservas" }));
app.use("/api", reservaRoutes);
app.use("/api", eventoRoutes);

const PUERTO = process.env.PORT || 3002;

app.listen(PUERTO, () => {
  console.log(`[reservas] Escuchando en http://localhost:${PUERTO}`);
});
