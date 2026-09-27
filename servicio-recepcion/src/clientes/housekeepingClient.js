const axios = require("axios");

const URL_BASE = process.env.URL_SERVICIO_HOUSEKEEPING;

/**
 * Comunicación SÍNCRONA entre los dos microservicios nuevos: antes de
 * asignarle una habitación física a un huésped, recepción le pregunta a
 * housekeeping si esa habitación ya está lista, y ESPERA la respuesta.
 * No tendría sentido hacerlo asíncrono: el check-in no puede completarse
 * sin saber en el momento si la habitación está en condiciones.
 *
 * Si la habitación nunca ha sido registrada en housekeeping (primera vez
 * que se usa), se asume disponible por defecto.
 */
async function consultarEstadoHabitacion(numero_habitacion) {
  try {
    const respuesta = await axios.get(`${URL_BASE}/api/housekeeping/habitaciones/${numero_habitacion}/estado`);
    return respuesta.data.estado;
  } catch (error) {
    if (error.response && error.response.status === 404) return "lista";
    throw error;
  }
}

module.exports = { consultarEstadoHabitacion };
