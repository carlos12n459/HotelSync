const path = require("path");
const { UPLOAD_DIR } = require("../config/multer");

/**
 * POST /api/subir
 * Sube una imagen al servidor y devuelve la URL publica.
 * El campo del formulario debe llamarse "archivo".
 */
async function subirArchivo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se envio ningun archivo o el tipo no es valido" });
    }

    // URL publica servida estaticamente.
    const url = `/archivos/${req.file.filename}`;

    res.status(201).json({
      nombre_original: req.file.originalname,
      nombre_guardado: req.file.filename,
      mimetype: req.file.mimetype,
      tamano: req.file.size,
      url
    });
  } catch (error) {
    res.status(500).json({ error: "Error al subir archivo", detalle: error.message });
  }
}

/**
 * GET /api/:nombre
 * Devuelve la informacion del archivo (para validar existencia).
 * El archivo en si se sirve estaticamente desde Express.
 */
async function obtenerArchivo(req, res) {
  const { nombre } = req.params;
  const ruta = path.join(UPLOAD_DIR, nombre);

  try {
    // eslint-disable-next-line no-undef
    const fs = require("fs");
    if (!fs.existsSync(ruta)) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    const stats = fs.statSync(ruta);
    res.json({ nombre, tamano: stats.size, url: `/archivos/${nombre}` });
  } catch (error) {
    res.status(500).json({ error: "Error al consultar archivo", detalle: error.message });
  }
}

module.exports = { subirArchivo, obtenerArchivo };
