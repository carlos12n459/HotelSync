const axios = require("axios");

const URL_BASE = process.env.URL_SERVICIO_RESERVAS || "http://localhost:3002";

async function listarReservasConfirmadas() {
  const respuesta = await axios.get(`${URL_BASE}/api/reservas`);
  const reservas = respuesta.data || [];
  return reservas.filter((reserva) => reserva.estado === "confirmada");
}

module.exports = { listarReservasConfirmadas };
