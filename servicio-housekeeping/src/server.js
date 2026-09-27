require("dotenv").config();
const express = require("express");
const cors = require("cors");

const housekeepingRoutes = require("./routes/housekeepingRoutes");
const { iniciarPollingCheckoutCompletado } = require("./pollers/checkoutCompletadoPoller");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "housekeeping" }));
app.use("/api", housekeepingRoutes);

const PUERTO = process.env.PORT || 3004;

app.listen(PUERTO, () => {
  console.log(`[housekeeping] Escuchando en http://localhost:${PUERTO}`);
  iniciarPollingCheckoutCompletado();
});
