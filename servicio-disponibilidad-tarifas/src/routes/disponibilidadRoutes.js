const express = require("express");
const controlador = require("../controllers/disponibilidadController");

const router = express.Router();

router.get("/tipos-habitacion", controlador.listarTiposHabitacion);
router.get("/disponibilidad", controlador.consultarDisponibilidad);
router.post("/disponibilidad/bloquear", controlador.bloquearInventario);
router.post("/disponibilidad/liberar", controlador.liberarInventarioEndpoint);
router.post("/disponibilidad/inicializar", controlador.inicializarInventario);

module.exports = router;
