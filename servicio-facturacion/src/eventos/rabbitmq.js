const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const EXCHANGE = "hotelsync.events";

let connection = null;
let channel = null;

async function connect() {
  if (channel) return { connection, channel };
  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  console.log(`[rabbitmq] Conectado a ${RABBITMQ_URL}`);
  return { connection, channel };
}

async function publish(routingKey, payload) {
  try {
    const { channel } = await connect();
    const buffer = Buffer.from(JSON.stringify(payload));
    channel.publish(EXCHANGE, routingKey, buffer, { persistent: true });
    console.log(`[rabbitmq] Publicado ${routingKey}`, payload);
  } catch (error) {
    console.error(`[rabbitmq] Error publicando ${routingKey}:`, error.message);
  }
}

async function consume(routingKey, handler) {
  try {
    const { channel } = await connect();
    const { queue } = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(queue, EXCHANGE, routingKey);
    await channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await handler(payload);
        channel.ack(msg);
      } catch (error) {
        console.error(`[rabbitmq] Error procesando ${routingKey}:`, error.message);
        channel.nack(msg, false, false);
      }
    });
    console.log(`[rabbitmq] Consumiendo ${routingKey} en cola ${queue}`);
  } catch (error) {
    console.error(`[rabbitmq] Error suscribiendose a ${routingKey}:`, error.message);
  }
}

module.exports = { connect, publish, consume };
