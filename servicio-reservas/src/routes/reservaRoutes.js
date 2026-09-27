const express = require("express");
const controlador = require("../controllers/reservaController");

const router = express.Router();

router.post("/reservas", controlador.crearReserva);
router.get("/reservas", controlador.listarReservas);
router.get("/reservas/:id", controlador.obtenerReserva);
router.patch("/reservas/:id/cancelar", controlador.cancelarReserva);

module.exports = router;
