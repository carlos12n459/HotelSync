require("dotenv").config();
const express = require("express");
const cors = require("cors");

const propiedadesRoutes = require("./routes/propiedadesRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "propiedades" }));
app.use("/api", propiedadesRoutes);

const PUERTO = process.env.PORT || 3005;

app.listen(PUERTO, () => {
  console.log(`[propiedades] Escuchando en http://localhost:${PUERTO}`);
});
