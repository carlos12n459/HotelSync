const axios = require("axios");
const { generarTareaLimpiezaPorCheckout } = require("../controllers/housekeepingController");

const URL_RECEPCION = process.env.URL_SERVICIO_RECEPCION;
const INTERVALO_MS = Number(process.env.INTERVALO_POLLING_MS || 4000);

/**
 * Comunicación ASÍNCRONA sin broker externo: housekeeping pregunta cada
 * cierto tiempo (polling) a servicio-recepcion si hay eventos
 * "checkout.completed" pendientes. Tal como pide el documento: "Se
 * suscribe a checkout.completed para generar automáticamente la tarea de
 * limpieza correspondiente". Recepción nunca espera a que esto ocurra.
 */
async function revisarEventosPendientes() {
  try {
    const respuesta = await axios.get(`${URL_RECEPCION}/api/eventos/pendientes`, {
      params: { tipo: "checkout.completed", consumidor: "housekeeping" }
    });

    const eventos = respuesta.data;
    if (eventos.length === 0) return;

    console.log(`[housekeeping] ${eventos.length} evento(s) checkout.completed pendiente(s)`);

    for (const evento of eventos) {
      const payload = typeof evento.payload === "string" ? JSON.parse(evento.payload) : evento.payload;

      await generarTareaLimpiezaPorCheckout(payload);

      await axios.post(`${URL_RECEPCION}/api/eventos/${evento.id}/confirmar`, { consumidor: "housekeeping" });
      console.log(`[housekeeping] Evento ${evento.id} procesado: habitación ${payload.numero_habitacion} marcada "sucia"`);
    }
  } catch (error) {
    // Es normal que falle si servicio-recepcion todavía no ha arrancado; el
    // poller simplemente lo reintenta en el siguiente ciclo.
    console.warn("[housekeeping] No se pudo consultar eventos pendientes de recepción:", error.message);
  }
}

function iniciarPollingCheckoutCompletado() {
  setInterval(revisarEventosPendientes, INTERVALO_MS);
  console.log(`[housekeeping] Polling de eventos checkout.completed cada ${INTERVALO_MS}ms`);
}

module.exports = { iniciarPollingCheckoutCompletado };
