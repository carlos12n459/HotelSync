require("dotenv").config();
const express = require("express");
const cors = require("cors");

const recepcionRoutes = require("./routes/recepcionRoutes");
const { connect: connectRabbit, consume } = require("./eventos/rabbitmq");
const { procesarBookingCreated } = require("./controllers/recepcionController");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "recepcion" }));
app.use("/api", recepcionRoutes);

const PUERTO = process.env.PORT || 3003;

connectRabbit()
  .then(() => {
    consume("booking.created", procesarBookingCreated);
    app.listen(PUERTO, () => {
      console.log(`[recepcion] Escuchando en http://localhost:${PUERTO}`);
    });
  })
  .catch((err) => {
    console.error("[recepcion] Error al iniciar:", err.message);
    process.exit(1);
  });
