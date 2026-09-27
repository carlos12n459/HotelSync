const axios = require("axios");
const pool = require("../config/baseDeDatos");
const { consultarReservaPorId } = require("../clientes/reservasClient");
const { acumularPuntosPorReserva } = require("../controllers/fidelizacionController");

const URL_RECEPCION = process.env.URL_SERVICIO_RECEPCION;
const INTERVALO_MS = Number(process.env.INTERVALO_POLLING_MS || 4000);

/**
 * Comunicación ASÍNCRONA sin broker externo: fidelización pregunta cada
 * cierto tiempo (polling) a servicio-recepcion si hay eventos
 * "booking.completed" pendientes, y acumula puntos al huésped según el
 * monto de la reserva y su nivel. servicio-recepcion nunca espera a que
 * esto ocurra: ya respondió al huésped en el momento del checkout.
 */
async function revisarEventosPendientes() {
  try {
    const respuesta = await axios.get(`${URL_RECEPCION}/api/eventos/pendientes`, {
      params: { tipo: "booking.completed" }
    });

    const eventos = respuesta.data;
    if (eventos.length === 0) return;

    console.log(`[fidelizacion] ${eventos.length} evento(s) booking.completed pendiente(s)`);

    for (const evento of eventos) {
      const payload = typeof evento.payload === "string" ? JSON.parse(evento.payload) : evento.payload;

      // Idempotencia: no procesar el mismo evento dos veces.
      const [yaProcesado] = await pool.query("SELECT id FROM eventos_procesados WHERE evento_id = ?", [String(evento.id)]);
      if (yaProcesado.length > 0) {
        console.log(`[fidelizacion] Evento ${evento.id} ya fue procesado; se omite`);
        continue;
      }

      // La reserva es la fuente de verdad para los datos del huésped.
      let reserva;
      try {
        reserva = await consultarReservaPorId(payload.reserva_id);
      } catch (error) {
        console.warn(`[fidelizacion] No se pudo consultar la reserva ${payload.reserva_id}:`, error.message);
        continue;
      }

      if (!reserva.guest_id) {
        console.warn(`[fidelizacion] La reserva ${reserva.id} no tiene guest_id asociado; no se pueden acumular puntos`);
        // Se confirma para evitar que el evento se reprocese indefinidamente.
        await axios.post(`${URL_RECEPCION}/api/eventos/${evento.id}/confirmar`);
        continue;
      }

      const datosAcumulacion = {
        reserva_id: Number(payload.reserva_id),
        guest_id: Number(reserva.guest_id),
        nombre_huesped: reserva.nombre_huesped,
        email_huesped: reserva.email_huesped,
        monto_total: payload.monto_total !== null && payload.monto_total !== undefined
          ? payload.monto_total
          : reserva.monto_total
      };

      try {
        await acumularPuntosPorReserva(datosAcumulacion);

        await pool.query(
          "INSERT INTO eventos_procesados (evento_id, tipo, reserva_id) VALUES (?, 'booking.completed', ?)",
          [String(evento.id), datosAcumulacion.reserva_id]
        );

        await axios.post(`${URL_RECEPCION}/api/eventos/${evento.id}/confirmar`);
        console.log(`[fidelizacion] Evento ${evento.id} procesado y confirmado (reserva #${datosAcumulacion.reserva_id})`);
      } catch (error) {
        console.error(`[fidelizacion] Error procesando evento ${evento.id}:`, error.message);
        // No se confirma el evento; se reintentará en el siguiente ciclo.
      }
    }
  } catch (error) {
    // Es normal que falle si servicio-recepcion todavía no ha arrancado; el
    // poller simplemente lo reintenta en el siguiente ciclo.
    console.warn("[fidelizacion] No se pudo consultar eventos pendientes de recepcion:", error.message);
  }
}

function iniciarPollingBookingCompletado() {
  setInterval(revisarEventosPendientes, INTERVALO_MS);
  console.log(`[fidelizacion] Polling de eventos booking.completed cada ${INTERVALO_MS}ms`);
}

module.exports = { iniciarPollingBookingCompletado };
