const express = require("express");
const controlador = require("../controllers/archivoController");
const { upload } = require("../config/multer");

const router = express.Router();

// Subida de una sola imagen con el campo "archivo".
router.post("/subir", upload.single("archivo"), controlador.subirArchivo);

// Informacion de un archivo por nombre.
router.get("/:nombre", controlador.obtenerArchivo);

module.exports = router;
