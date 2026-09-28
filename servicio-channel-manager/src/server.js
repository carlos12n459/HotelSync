require("dotenv").config();
const express = require("express");
const cors = require("cors");

const channelManagerRoutes = require("./routes/channelManagerRoutes");
const { connect: connectRabbit, consume } = require("./eventos/rabbitmq");
const { procesarAvailabilityUpdated } = require("./controllers/channelManagerController");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "channel-manager" }));
app.use("/api", channelManagerRoutes);

const PUERTO = process.env.PORT || 3006;

connectRabbit()
  .then(() => {
    consume("availability.updated", procesarAvailabilityUpdated);
    app.listen(PUERTO, () => {
      console.log(`[channel-manager] Escuchando en http://localhost:${PUERTO}`);
    });
  })
  .catch((err) => {
    console.error("[channel-manager] Error al iniciar:", err.message);
    process.exit(1);
  });
