const express = require("express");
const controlador = require("../controllers/channelManagerController");

const router = express.Router();

router.get("/channel/mappings", controlador.listarMappings);
router.post("/channel/mappings", controlador.crearMapping);
router.post("/channel/webhook/:channel", controlador.recibirWebhook);
router.get("/channel/reservas-externas", controlador.listarReservasExternas);
router.get("/channel/sync-log", controlador.listarSyncLog);

module.exports = router;
