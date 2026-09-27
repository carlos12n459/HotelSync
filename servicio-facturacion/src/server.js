require("dotenv").config();
const express = require("express");
const cors = require("cors");

const facturacionRoutes = require("./routes/facturacionRoutes");
const eventoRoutes = require("./routes/eventoRoutes");
const { iniciarPollingCheckoutCompletado } = require("./pollers/checkoutCompletadoPoller");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "facturacion" }));
app.use("/api", facturacionRoutes);
app.use("/api", eventoRoutes);

const PUERTO = process.env.PORT || 3007;

app.listen(PUERTO, () => {
  console.log(`[facturacion] Escuchando en http://localhost:${PUERTO}`);
  iniciarPollingCheckoutCompletado();
});
