const express = require("express");
const controlador = require("../controllers/fidelizacionController");

const router = express.Router();

router.get("/fidelizacion/cuentas", controlador.listarCuentas);
router.get("/fidelizacion/cuentas/:guest_id", controlador.obtenerCuenta);
router.get("/fidelizacion/cuentas/:guest_id/transacciones", controlador.listarTransacciones);
router.post("/fidelizacion/cuentas/:guest_id/canjear", controlador.canjearPuntos);

module.exports = router;
