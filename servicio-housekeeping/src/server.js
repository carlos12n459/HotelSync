require("dotenv").config();
const express = require("express");
const cors = require("cors");

const housekeepingRoutes = require("./routes/housekeepingRoutes");
const { connect: connectRabbit, consume } = require("./eventos/rabbitmq");
const { generarTareaLimpiezaPorCheckout } = require("./controllers/housekeepingController");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "housekeeping" }));
app.use("/api", housekeepingRoutes);

const PUERTO = process.env.PORT || 3004;

connectRabbit()
  .then(() => {
    consume("checkout.completed", generarTareaLimpiezaPorCheckout);
    app.listen(PUERTO, () => {
      console.log(`[housekeeping] Escuchando en http://localhost:${PUERTO}`);
    });
  })
  .catch((err) => {
    console.error("[housekeeping] Error al iniciar:", err.message);
    process.exit(1);
  });
