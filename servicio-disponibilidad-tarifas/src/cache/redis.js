const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const client = createClient({ url: REDIS_URL });

client.on("error", (err) => console.error("[redis] Error:", err.message));

async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
    console.log("[redis] Conectado a", REDIS_URL);
  }
}

function cacheKey(tipo_habitacion_id, checkin, checkout) {
  return `disponibilidad:${tipo_habitacion_id}:${checkin}:${checkout}`;
}

module.exports = { client, connectRedis, cacheKey };
