const axios = require("axios");
const pool = require("../config/baseDeDatos");

const URL_RESERVAS = process.env.URL_SERVICIO_RESERVAS;
const INTERVALO_MS = Number(process.env.INTERVALO_POLLING_MS || 4000);

/**
 * Comunicación ASÍNCRONA sin broker externo: recepción pregunta cada
 * cierto tiempo (polling) a servicio-reservas si hay eventos
 * "booking.created" pendientes, y arma con ellos su lista local de
 * llegadas del día. servicio-reservas nunca espera a que esto ocurra:
 * ya le respondió al huésped en el momento de crear la reserva.
 */
async function revisarEventosPendientes() {
  try {
    const respuesta = await axios.get(`${URL_RESERVAS}/api/eventos/pendientes`, {
      params: { tipo: "booking.created" }
    });

    const eventos = respuesta.data;
    if (eventos.length === 0) return;

    console.log(`[recepcion] ${eventos.length} evento(s) booking.created pendiente(s)`);

    for (const evento of eventos) {
      const reserva = typeof evento.payload === "string" ? JSON.parse(evento.payload) : evento.payload;

      await pool.query(
        `INSERT INTO llegadas
          (reserva_id, nombre_huesped, hotel_id, tipo_habitacion_id, fecha_checkin, fecha_checkout, canal, monto_total, estado_reserva, origen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmada', 'evento_async')
         ON DUPLICATE KEY UPDATE estado_reserva = 'confirmada', origen = 'evento_async'`,
        [
          reserva.id, reserva.nombre_huesped, reserva.hotel_id, reserva.tipo_habitacion_id,
          reserva.fecha_checkin, reserva.fecha_checkout, reserva.canal, reserva.monto_total
        ]
      );

      await axios.post(`${URL_RESERVAS}/api/eventos/${evento.id}/confirmar`);
      console.log(`[recepcion] Evento ${evento.id} procesado y confirmado (reserva #${reserva.id})`);
    }
  } catch (error) {
    // Es normal que falle si servicio-reservas todavía no ha arrancado; el
    // poller simplemente lo reintenta en el siguiente ciclo.
    console.warn("[recepcion] No se pudo consultar eventos pendientes de reservas:", error.message);
  }
}

function iniciarPollingReservaCreada() {
  setInterval(revisarEventosPendientes, INTERVALO_MS);
  console.log(`[recepcion] Polling de eventos booking.created cada ${INTERVALO_MS}ms`);
}

module.exports = { iniciarPollingReservaCreada };
