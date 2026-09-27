require("dotenv").config();
const express = require("express");
const cors = require("cors");

const fidelizacionRoutes = require("./routes/fidelizacionRoutes");
const { iniciarPollingBookingCompletado } = require("./pollers/bookingCompletadoPoller");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "fidelizacion" }));
app.use("/api", fidelizacionRoutes);

const PUERTO = process.env.PORT || 3008;

app.listen(PUERTO, () => {
  console.log(`[fidelizacion] Escuchando en http://localhost:${PUERTO}`);
  iniciarPollingBookingCompletado();
});
