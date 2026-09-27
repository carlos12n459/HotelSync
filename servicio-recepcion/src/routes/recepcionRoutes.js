const express = require("express");
const controlador = require("../controllers/recepcionController");

const router = express.Router();

router.post("/recepcion/iniciar-turno", controlador.iniciarTurno);
router.get("/recepcion/llegadas", controlador.listarLlegadas);
router.post("/recepcion/checkin", controlador.checkin);
router.post("/recepcion/checkout", controlador.checkout);
router.get("/recepcion/asignaciones", controlador.listarAsignaciones);
router.post("/recepcion/incidencias", controlador.registrarIncidencia);

module.exports = router;
