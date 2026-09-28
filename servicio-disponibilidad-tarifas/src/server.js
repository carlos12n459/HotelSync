require("dotenv").config();
const express = require("express");
const cors = require("cors");

const disponibilidadRoutes = require("./routes/disponibilidadRoutes");
const { connectRedis } = require("./cache/redis");
const { connect: connectRabbit } = require("./eventos/rabbitmq");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "disponibilidad-tarifas" }));
app.use("/api", disponibilidadRoutes);

const PUERTO = process.env.PORT || 3001;

connectRedis()
  .then(() => connectRabbit())
  .then(() => {
    app.listen(PUERTO, () => {
      console.log(`[disponibilidad-tarifas] Escuchando en http://localhost:${PUERTO}`);
    });
  })
  .catch((err) => {
    console.error("[disponibilidad-tarifas] Error al iniciar:", err.message);
    process.exit(1);
  });
