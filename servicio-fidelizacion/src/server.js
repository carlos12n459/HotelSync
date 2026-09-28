require("dotenv").config();
const express = require("express");
const cors = require("cors");

const fidelizacionRoutes = require("./routes/fidelizacionRoutes");
const { connect: connectRabbit, consume } = require("./eventos/rabbitmq");
const { procesarBookingCompleted } = require("./controllers/fidelizacionController");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "fidelizacion" }));
app.use("/api", fidelizacionRoutes);

const PUERTO = process.env.PORT || 3008;

connectRabbit()
  .then(() => {
    consume("booking.completed", procesarBookingCompleted);
    app.listen(PUERTO, () => {
      console.log(`[fidelizacion] Escuchando en http://localhost:${PUERTO}`);
    });
  })
  .catch((err) => {
    console.error("[fidelizacion] Error al iniciar:", err.message);
    process.exit(1);
  });
