const axios = require("axios");

const URL_BASE = process.env.URL_SERVICIO_RESERVAS;

/**
 * Comunicación SÍNCRONA: al iniciar turno, recepción le pregunta a
 * servicio-reservas cuáles son las reservas vigentes, y ESPERA la
 * respuesta antes de mostrar la lista de llegadas al personal. El listado
 * de servicio-reservas no acepta filtros, así que se filtra aquí mismo
 * por hotel y fecha de check-in.
 */
async function consultarReservasDelDia(hotel_id, fecha) {
  const respuesta = await axios.get(`${URL_BASE}/api/reservas`);
  return respuesta.data.filter((reserva) => {
    const coincideHotel = !hotel_id || String(reserva.hotel_id) === String(hotel_id);
    const coincideFecha = !fecha || reserva.fecha_checkin === fecha;
    return coincideHotel && coincideFecha && reserva.estado === "confirmada";
  });
}

/**
 * Comunicación SÍNCRONA: usada antes de un check-in para validar, en el
 * momento, que la reserva exista y siga confirmada en la fuente de verdad.
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

module.exports = { consultarReservasDelDia, consultarReservaPorId };
