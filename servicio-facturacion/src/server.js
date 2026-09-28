require("dotenv").config();
const express = require("express");
const cors = require("cors");

const facturacionRoutes = require("./routes/facturacionRoutes");
const { connect: connectRabbit, consume } = require("./eventos/rabbitmq");
const { procesarCheckoutCompletado } = require("./controllers/facturacionController");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "facturacion" }));
app.use("/api", facturacionRoutes);

const PUERTO = process.env.PORT || 3007;

connectRabbit()
  .then(() => {
    consume("checkout.completed", procesarCheckoutCompletado);
    app.listen(PUERTO, () => {
      console.log(`[facturacion] Escuchando en http://localhost:${PUERTO}`);
    });
  })
  .catch((err) => {
    console.error("[facturacion] Error al iniciar:", err.message);
    process.exit(1);
  });
