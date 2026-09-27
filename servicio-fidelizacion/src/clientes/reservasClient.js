const axios = require("axios");

const URL_RESERVAS = process.env.URL_SERVICIO_RESERVAS;

/**
 * Consulta a servicio-reservas la información completa de una reserva.
 * Se usa cuando fidelización recibe un booking.completed de recepción y
 * necesita obtener los datos del huésped (guest_id, nombre, email) para
 * crear o actualizar su cuenta de fidelización.
 */
async function consultarReservaPorId(reserva_id) {
  const respuesta = await axios.get(`${URL_RESERVAS}/api/reservas/${reserva_id}`);
  return respuesta.data;
}

module.exports = { consultarReservaPorId };
