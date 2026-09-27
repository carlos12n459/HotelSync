const axios = require("axios");

const URL_BASE = process.env.URL_SERVICIO_PROPIEDADES || "http://localhost:3005";

async function listarHoteles() {
  const respuesta = await axios.get(`${URL_BASE}/api/hoteles`);
  return respuesta.data || [];
}

async function listarHabitaciones(hotelId) {
  const respuesta = await axios.get(`${URL_BASE}/api/hoteles/${hotelId}/habitaciones`);
  return respuesta.data || [];
}

module.exports = { listarHoteles, listarHabitaciones };
