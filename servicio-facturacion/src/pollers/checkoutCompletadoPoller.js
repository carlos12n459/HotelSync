const axios = require("axios");
const { procesarCheckoutCompletado } = require("../controllers/facturacionController");

const URL_RECEPCION = process.env.URL_SERVICIO_RECEPCION;
const INTERVALO_MS = Number(process.env.INTERVALO_POLLING_MS || 4000);

/**
 * Comunicacion ASINCRONA sin broker externo: facturacion consulta cada
 * cierto tiempo (polling) el outbox de recepcion buscando eventos
 * checkout.completed. Cuando encuentra uno, crea el folio con el cargo por
 * hospedaje, lo cierra y emite la factura.
 */
async function revisarEventosPendientes() {
  try {
    const respuesta = await axios.get(`${URL_RECEPCION}/api/eventos/pendientes`, {
      params: { tipo: "checkout.completed", consumidor: "facturacion" }
    });

    const eventos = respuesta.data;
    if (eventos.length === 0) return;

    console.log(`[facturacion] ${eventos.length} evento(s) checkout.completed pendiente(s)`);

    for (const evento of eventos) {
      const procesado = await procesarCheckoutCompletado(evento);
      if (procesado) {
        const payload = typeof evento.payload === "string" ? JSON.parse(evento.payload) : evento.payload;
        await axios.post(`${URL_RECEPCION}/api/eventos/${evento.id}/confirmar`, { consumidor: "facturacion" });
        console.log(`[facturacion] Evento ${evento.id} procesado y confirmado (reserva #${payload.reserva_id})`);
      }
    }
  } catch (error) {
    // Es normal que falle si servicio-recepcion todavia no ha arrancado; el
    // poller simplemente lo reintenta en el siguiente ciclo.
    console.warn("[facturacion] No se pudieron consultar eventos pendientes de recepcion:", error.message);
  }
}

function iniciarPollingCheckoutCompletado() {
  setInterval(revisarEventosPendientes, INTERVALO_MS);
  console.log(`[facturacion] Polling de eventos checkout.completed cada ${INTERVALO_MS}ms`);
}

module.exports = { iniciarPollingCheckoutCompletado };
