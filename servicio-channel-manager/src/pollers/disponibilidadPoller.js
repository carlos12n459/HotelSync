const { consultarEventosDisponibilidad, confirmarEvento } = require("../clientes/disponibilidadClient");
const pool = require("../config/baseDeDatos");

const INTERVALO_MS = Number(process.env.INTERVALO_POLLING_MS || 4000);

/**
 * Se suscribe a availability.updated del servicio de disponibilidad y
 * simula la sincronización con los canales externos, guardando un log.
 */
async function revisarEventosPendientes() {
  try {
    const eventos = await consultarEventosDisponibilidad();
    if (eventos.length === 0) return;

    console.log(`[channel-manager] ${eventos.length} evento(s) availability.updated pendiente(s)`);

    for (const evento of eventos) {
      const payload = typeof evento.payload === "string" ? JSON.parse(evento.payload) : evento.payload;

      const [mappings] = await pool.query(
        "SELECT channel_name FROM channel_mappings WHERE room_type_id = ? AND activo = TRUE",
        [payload.tipo_habitacion_id]
      );

      for (const mapping of mappings) {
        const libres = 5; // simulación: en un caso real se calcularía con la fecha
        await pool.query(
          "INSERT INTO sync_log (channel_name, room_type_id, fecha, disponible, estado, respuesta) VALUES (?, ?, ?, ?, ?, ?)",
          [mapping.channel_name, payload.tipo_habitacion_id, payload.checkin, libres, "ok", JSON.stringify(payload)]
        );
        console.log(`[channel-manager] Sincronizado ${mapping.channel_name} para tipo ${payload.tipo_habitacion_id}`);
      }

      await confirmarEvento(evento.id);
    }
  } catch (error) {
    console.warn("[channel-manager] No se pudo sincronizar disponibilidad:", error.message);
  }
}

function iniciarPollingDisponibilidad() {
  setInterval(revisarEventosPendientes, INTERVALO_MS);
  console.log(`[channel-manager] Polling de availability.updated cada ${INTERVALO_MS}ms`);
}

module.exports = { iniciarPollingDisponibilidad };
