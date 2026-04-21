const os = require("node:os");
const { loadEnvFile } = require("./env-loader");

loadEnvFile(".env.client");

const SERVER_URL = (process.env.SERVER_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY || "";
const CLIENT_ID = process.env.CLIENT_ID || os.hostname();
const CLIENT_NAME = process.env.CLIENT_NAME || "";
const NTFY_TOPIC = process.env.NTFY_TOPIC || "";
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 10 * 60_000);
const GRACE_MS = Number(process.env.GRACE_MS || 20 * 60_000);

if (!SERVER_URL) {
  console.error("Missing SERVER_URL environment variable.");
  process.exit(1);
}

if (!API_KEY) {
  console.error("Missing API_KEY environment variable.");
  process.exit(1);
}

async function post(path, payload) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY
    },
    body: JSON.stringify(payload)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} failed ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function register() {
  await post("/register", {
    clientId: CLIENT_ID,
    name: CLIENT_NAME,
    ntfyTopic: NTFY_TOPIC,
    graceMs: GRACE_MS
  });
  console.log(`[REGISTERED] ${CLIENT_ID}`);
}

async function sendHeartbeat() {
  const result = await post("/heartbeat", { clientId: CLIENT_ID });
  const pongAt = result.at || new Date().toISOString();
  console.log(`[PONG] ${pongAt} (${CLIENT_ID})`);
}

async function start() {
  await register();
  await sendHeartbeat();

  setInterval(async () => {
    try {
      await sendHeartbeat();
    } catch (err) {
      console.error(`[HEARTBEAT ERROR] ${err.message}`);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

start().catch((err) => {
  console.error(`[STARTUP ERROR] ${err.message}`);
  process.exit(1);
});
