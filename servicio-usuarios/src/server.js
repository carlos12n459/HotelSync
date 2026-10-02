require("dotenv").config();
const express = require("express");
const cors = require("cors");

const usuarioRoutes = require("./routes/usuarioRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ estado: "ok", servicio: "usuarios" }));
app.use("/api", usuarioRoutes);

const PUERTO = process.env.PORT || 3011;

app.listen(PUERTO, () => {
  console.log(`[usuarios] Escuchando en http://localhost:${PUERTO}`);
});
