import "dotenv/config";
import { isChannel } from "@mypet/core/channels";
import { sendPushBroadcast } from "@mypet/core/push-server";

const [channelArg, title, body, url] = process.argv.slice(2);

if (!channelArg || !title || !body) {
  console.error('Uso: pnpm push:send <channel> "<título>" "<mensagem>" [url]');
  process.exit(1);
}

if (!isChannel(channelArg)) {
  console.error(`Canal inválido: ${channelArg}`);
  process.exit(1);
}

sendPushBroadcast(channelArg, { title, body, url })
  .then(({ sent, removed }) => {
    console.log(`Enviado: ${sent}, removidas (expiradas): ${removed}`);
  })
  .catch((error) => {
    console.error("Falha ao enviar broadcast:", error);
    process.exit(1);
  });
