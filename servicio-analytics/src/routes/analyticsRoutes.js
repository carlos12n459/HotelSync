const express = require("express");
const controlador = require("../controllers/analyticsController");

const router = express.Router();

router.get("/analytics/kpis", controlador.listarKPIs);
router.get("/analytics/resumen", controlador.resumenGlobal);
router.post("/analytics/etl", controlador.ejecutarETLManual);
router.get("/analytics/etl-log", controlador.listarLogETL);

module.exports = router;
