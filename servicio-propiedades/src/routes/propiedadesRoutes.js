const express = require("express");
const controlador = require("../controllers/propiedadesController");

const router = express.Router();

router.get("/hoteles", controlador.listarHoteles);
router.get("/hoteles/mios", controlador.listarHotelesMios);
router.get("/hoteles/:id", controlador.obtenerHotel);
router.post("/hoteles", controlador.crearHotel);
router.patch("/hoteles/:id", controlador.actualizarHotel);

router.get("/hoteles/:hotel_id/tipos-habitacion", controlador.listarTiposHabitacion);
router.post("/hoteles/:hotel_id/tipos-habitacion", controlador.crearTipoHabitacion);

router.get("/tipos-habitacion/:id", controlador.obtenerTipoHabitacion);

router.get("/hoteles/:hotel_id/habitaciones", controlador.listarHabitaciones);
router.post("/hoteles/:hotel_id/habitaciones", controlador.crearHabitacion);

module.exports = router;
