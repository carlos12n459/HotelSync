const express = require("express");
const controlador = require("../controllers/facturacionController");

const router = express.Router();

router.get("/facturacion/folios", controlador.listarFolios);
router.get("/facturacion/folios/:id", controlador.obtenerFolio);
router.post("/facturacion/folios/:folio_id/cargos", controlador.agregarCargo);
router.post("/facturacion/folios/:folio_id/pagos", controlador.registrarPago);
router.post("/facturacion/folios/:folio_id/cerrar", controlador.cerrarFolio);
router.get("/facturacion/facturas", controlador.listarFacturas);

module.exports = router;
