const express = require("express");
const controlador = require("../controllers/usuarioController");
const { verificarToken, permitirRoles } = require("../middleware/auth");

const router = express.Router();

// Rutas publicas de autenticacion.
router.post("/auth/register", controlador.registrar);
router.post("/auth/login", controlador.login);

// Rutas protegidas.
router.get("/auth/perfil", verificarToken, controlador.perfil);
router.get("/usuarios/:id", verificarToken, controlador.obtenerUsuario);
router.patch("/usuarios/:id/rol", verificarToken, permitirRoles("admin"), controlador.cambiarRol);

module.exports = router;
