const axios = require("axios");

const URL_BASE = process.env.URL_SERVICIO_DISPONIBILIDAD;

/**
 * Consulta eventos availability.updated pendientes en el servicio de
 * disponibilidad y tarifas para simular sincronización con OTAs.
 */
async function consultarEventosDisponibilidad() {
  const respuesta = await axios.get(`${URL_BASE}/api/eventos/pendientes`, {
    params: { tipo: "availability.updated" }
  });
  return respuesta.data;
}

async function confirmarEvento(eventoId) {
  await axios.post(`${URL_BASE}/api/eventos/${eventoId}/confirmar`);
}

module.exports = { consultarEventosDisponibilidad, confirmarEvento };
