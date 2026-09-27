const axios = require("axios");
const { liberarInventario } = require("../controllers/disponibilidadController");

const URL_RESERVAS = process.env.URL_SERVICIO_RESERVAS;
const INTERVALO_MS = Number(process.env.INTERVALO_POLLING_MS || 4000);

/**
 * Comunicación ASÍNCRONA sin broker externo: en vez de un consumidor de
 * RabbitMQ, este servicio pregunta cada cierto tiempo (polling) al
 * servicio de reservas si hay eventos "booking.cancelled" pendientes.
 * El servicio de reservas nunca espera a que esto ocurra: respondió al
 * usuario en el momento de la cancelación. Este poller procesa los
 * eventos cuando puede, de forma totalmente desacoplada en el tiempo.
 */
async function revisarEventosPendientes() {
  try {
    const respuesta = await axios.get(`${URL_RESERVAS}/api/eventos/pendientes`, {
      params: { tipo: "booking.cancelled" }
    });

    const eventos = respuesta.data;
    if (eventos.length === 0) return;

    console.log(`[disponibilidad-tarifas] ${eventos.length} evento(s) booking.cancelled pendiente(s)`);

    for (const evento of eventos) {
      const payload = typeof evento.payload === "string" ? JSON.parse(evento.payload) : evento.payload;

      await liberarInventario({
        tipo_habitacion_id: payload.tipo_habitacion_id,
        checkin: payload.fecha_checkin,
        checkout: payload.fecha_checkout,
        cantidad: 1
      });

      await axios.post(`${URL_RESERVAS}/api/eventos/${evento.id}/confirmar`);
      console.log(`[disponibilidad-tarifas] Evento ${evento.id} procesado y confirmado`);
    }
  } catch (error) {
    // Es normal que falle si el servicio de reservas todavía no ha
    // arrancado; el poller simplemente lo vuelve a intentar en el
    // siguiente ciclo, sin tumbar este microservicio.
    console.warn("[disponibilidad-tarifas] No se pudo consultar eventos pendientes:", error.message);
  }
}

function iniciarPollingReservaCancelada() {
  setInterval(revisarEventosPendientes, INTERVALO_MS);
  console.log(`[disponibilidad-tarifas] Polling de eventos booking.cancelled cada ${INTERVALO_MS}ms`);
}

module.exports = { iniciarPollingReservaCancelada };
