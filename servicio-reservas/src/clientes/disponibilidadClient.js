const axios = require("axios");

const URL_BASE = process.env.URL_SERVICIO_DISPONIBILIDAD;

/**
 * Comunicación SÍNCRONA entre microservicios: el servicio de reservas
 * llama por REST al servicio de disponibilidad y ESPERA la respuesta
 * antes de decidir si puede confirmar la reserva. Esto es intencional:
 * bloquear el inventario no puede ser asíncrono, porque de lo contrario
 * dos huéspedes podrían terminar con la misma habitación (sobreventa).
 *
 * Devuelve { bloqueado: true } si se logró reservar el inventario, o
 * lanza un error con status 409 si no había disponibilidad.
 */
async function bloquearInventarioSincrono({ tipo_habitacion_id, checkin, checkout, cantidad = 1 }) {
  const respuesta = await axios.post(`${URL_BASE}/api/disponibilidad/bloquear`, {
    tipo_habitacion_id,
    checkin,
    checkout,
    cantidad
  });
  return respuesta.data;
}

/**
 * Libera inventario previamente bloqueado. Se usa para compensar un
 * bloqueo si la reserva no pudo guardarse (por ejemplo, error de base
 * de datos), evitando dejar inventario bloqueado permanentemente.
 */
async function liberarInventarioSincrono({ tipo_habitacion_id, checkin, checkout, cantidad = 1 }) {
  const respuesta = await axios.post(`${URL_BASE}/api/disponibilidad/liberar`, {
    tipo_habitacion_id,
    checkin,
    checkout,
    cantidad
  });
  return respuesta.data;
}

module.exports = { bloquearInventarioSincrono, liberarInventarioSincrono };
