import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "config.json");

// Charger la config (ou créer une par défaut)
//change '2250712668494', leave owner:"empty"
let CONFIG = { owner: "", creator: "224567××", mode: "public" };
if (fs.existsSync(configPath)) {
  CONFIG = JSON.parse(fs.readFileSync(configPath, "utf-8"));
} else {
  fs.writeFileSync(configPath, JSON.stringify(CONFIG, null, 2));
}

// --- Chargement des commandes ---
const commands = new Map();
const commandsPath = path.join(__dirname, "commands");
const files = fs.readdirSync(commandsPath);
for (const file of files) {
  if (file.endsWith(".js")) {
    const commandName = file.replace(".js", "");
    const module = await import(`./commands/${file}`);
    commands.set(commandName, module.default || module[`${commandName}Command`]);
  }
}

// --- Import du module react ---
const reactModule = await import("./commands/react.js");
const react = reactModule.default || reactModule.reactCommand;

// --- Définir automatiquement l'owner ---
export async function setOwnerOnConnect(client) {
  if (!CONFIG.owner) {
    const me = client.user?.id || client.user?.jid;
    if (me) {
      CONFIG.owner = me.replace(/[^0-9]/g, "");
      fs.writeFileSync(configPath, JSON.stringify(CONFIG, null, 2));
      console.log(`✅ Owner défini automatiquement : ${CONFIG.owner}`);
    }
  }
}

// --- Récupérer le numéro d’un message ---
function getSenderNumber(message) {
  let senderJid = "";

  if (message.key.fromMe) {
    senderJid = CONFIG.owner + "@s.whatsapp.net";
  } else if (message.key.participant) {
    senderJid = message.key.participant;
  } else {
    senderJid = message.key.remoteJid;
  }

  return senderJid.replace(/[^0-9]/g, ""); // normalisation
}

// --- Récupérer le user cible (reply, mention, numéro) ---
function getTargetUser(message, args) {
  const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  if (quoted) return message.message.extendedTextMessage.contextInfo.participant.replace(/[^0-9]/g, "");
  if (mentions.length > 0) return mentions[0].replace(/[^0-9]/g, "");
  if (args[0]) return args[0].replace(/[^0-9]/g, "");
  return null;
}

// --- Logs clairs ---
function logMessage(message, type = "IN") {
  const remoteJid = message.key.remoteJid;
  const isGroup = remoteJid.endsWith("@g.us");
  const isChannel = remoteJid.endsWith("@broadcast");
  const sender = getSenderNumber(message);
  const senderName = message.pushName || "Unknown";
  const text =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    "";

  let logText = `[${type}] `;

  if (isGroup) {
    logText += `GROUPE (${remoteJid}) | ${senderName} (${sender}) → ${text}`;
  } else if (isChannel) {
    logText += `CHAÎNE | ${senderName} → ${text}`;
  } else {
    logText += `DM | ${senderName} (${sender}) → ${text}`;
  }

  console.log(logText);
}

// --- Handler principal ---
export async function handleCommand(message, client) {
  try {
    logMessage(message, "IN");

    const text =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      "";
    const prefix = ".";
    if (!text.startsWith(prefix)) return;

    const args = text.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const sender = getSenderNumber(message);

    // Détection Owner et Creator
    const isOwner = sender === CONFIG.owner;
    const isCreator = sender === CONFIG.creator;

    // Mode Private : seul l'owner peut exécuter
    if (CONFIG.mode === "private" && !isOwner) return;

    // --- Exécution de la commande ---
    if (commands.has(command)) {
      // Reaction avant exécution
      if (react) {
        try {
          await react(message, client);
        } catch (err) {
          console.error("Erreur react.js:", err);
        }
      }

      const cmd = commands.get(command);
      const target = getTargetUser(message, args);

      await cmd(message, client, {
        sender,
        target,
        args,
        isOwner,
        isCreator,
        config: CONFIG,
        updateConfig: (newConfig) => {
          CONFIG = { ...CONFIG, ...newConfig };
          fs.writeFileSync(configPath, JSON.stringify(CONFIG, null, 2));
          console.log("⚙️ Config mise à jour :", CONFIG);
        },
      });

      logMessage(
        {
          key: message.key,
          message: { conversation: `Commande ${command} exécutée` },
          pushName: message.pushName,
        },
        "OUT"
      );
    }
  } catch (e) {
    console.error("Erreur handleCommand:", e);
  }
}
