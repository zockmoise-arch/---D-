import config from "../config.js"

export default async function pingCommand(message, client) {
  const remoteJid = message.key.remoteJid;
  const start = Date.now();

  await client.sendMessage(remoteJid, { text: "_🏓 *Pong!*_" });
  const latency = Date.now() - start;

  await client.sendMessage(remoteJid, {
    text: 
`╭───────────────╮
│   𝐋𝐀𝐓𝐄𝐍𝐂𝐄 : ${𝐥𝐚𝐭𝐞𝐧𝐜𝐲} 𝐦𝐬_
╰───────────────╯
> 🌒 ${config.BotName}`,
  });
}
