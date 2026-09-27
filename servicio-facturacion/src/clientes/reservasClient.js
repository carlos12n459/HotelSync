const axios = require("axios");

const URL_BASE = process.env.URL_SERVICIO_RESERVAS;

/**
 * Comunicacion SINCRONA: consulta una reserva por su ID en el servicio de
 * reservas. Se usa al procesar el evento checkout.completed para obtener el
 * monto_total, hotel_id y huesped_id necesarios para crear el folio.
 */
async function consultarReservaPorId(reserva_id) {
  try {
    const respuesta = await axios.get(`${URL_BASE}/api/reservas/${reserva_id}`);
    return respuesta.data;
  } catch (error) {
    if (error.response && error.response.status === 404) return null;
    throw error;
  }
}

module.exports = { consultarReservaPorId };
