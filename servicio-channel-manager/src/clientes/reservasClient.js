const axios = require("axios");

const URL_BASE = process.env.URL_SERVICIO_RESERVAS;

/**
 * Traduce una reserva entrante de un canal externo al formato interno
 * y la crea en el servicio de reservas.
 */
async function crearReservaInterna(datos) {
  const respuesta = await axios.post(`${URL_BASE}/api/reservas`, datos);
  return respuesta.data;
}

module.exports = { crearReservaInterna };
