const express = require("express");
const { listarEventosPendientes, confirmarEventoProcesado } = require("../eventos/eventosOutbox");

const router = express.Router();

router.get("/eventos/pendientes", listarEventosPendientes);
router.post("/eventos/:id/confirmar", confirmarEventoProcesado);

module.exports = router;
