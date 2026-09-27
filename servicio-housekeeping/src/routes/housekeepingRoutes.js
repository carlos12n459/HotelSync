const express = require("express");
const controlador = require("../controllers/housekeepingController");

const router = express.Router();

router.get("/housekeeping/habitaciones", controlador.listarHabitaciones);
router.get("/housekeeping/habitaciones/:numero/estado", controlador.consultarEstado);
router.patch("/housekeeping/habitaciones/:numero/estado", controlador.actualizarEstado);

module.exports = router;
