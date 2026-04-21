const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const dns = require("node:dns");
const { loadEnvFile } = require("./env-loader");

loadEnvFile(".env.server");

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY || "";
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 60_000);
const DEFAULT_GRACE_MS = Number(process.env.DEFAULT_GRACE_MS || 20 * 60_000);
const DNS_RESULT_ORDER = process.env.DNS_RESULT_ORDER || "ipv4first";
const NTFY_BASE_URL = process.env.NTFY_BASE_URL || "https://ntfy.sh";
const NTFY_TOPIC = process.env.NTFY_TOPIC || "";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");

if (!API_KEY) {
  console.error("Missing API_KEY environment variable.");
  process.exit(1);
}

const clients = new Map();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadClients() {
  ensureDataDir();
  if (!fs.existsSync(CLIENTS_FILE)) return;

  const raw = fs.readFileSync(CLIENTS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  for (const client of parsed) {
    clients.set(client.clientId, client);
  }
}

function saveClients() {
  ensureDataDir();
  const output = JSON.stringify(Array.from(clients.values()), null, 2);
  fs.writeFileSync(CLIENTS_FILE, output);
}

async function sendNtfyAlert(title, body, topic) {
  const effectiveTopic = String(topic || "").trim();
  if (!effectiveTopic) {
    throw new Error("No ntfy topic configured");
  }

  const url = `${NTFY_BASE_URL.replace(/\/+$/, "")}/${encodeURIComponent(effectiveTopic)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Title": title,
      "Priority": "high",
      "Tags": "warning,satellite"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ntfy error ${res.status}: ${text}`);
  }
}

function isAuthorized(req) {
  return req.headers["x-api-key"] === API_KEY;
}

function respondJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function nowIso() {
  return new Date().toISOString();
}

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder(DNS_RESULT_ORDER);
}

function getClientTopic(client) {
  return String(client.ntfyTopic || NTFY_TOPIC || "").trim();
}

function checkForMissedHeartbeats() {
  const now = Date.now();

  for (const client of clients.values()) {
    if (!client.lastSeenAt) continue;

    const graceMs = Number(client.graceMs || DEFAULT_GRACE_MS);
    const delta = now - new Date(client.lastSeenAt).getTime();
    const isDown = delta > graceMs;
    const currentState = client.state || "up";

    if (isDown && currentState !== "down") {
      client.state = "down";
      client.lastDownAt = nowIso();
      clients.set(client.clientId, client);
      saveClients();

      const title = `Client DOWN: ${client.clientId}`;
      const body = [
        `Client ${client.clientId} (${client.name || "unnamed"}) is DOWN.`,
        `Last seen: ${client.lastSeenAt}`,
        `Grace: ${Math.round(graceMs / 60000)} minutes`,
        `Server time: ${nowIso()}`
      ].join("\n");

      const topic = getClientTopic(client);
      sendNtfyAlert(title, body, topic)
        .then(() => {
          client.lastAlertSentAt = nowIso();
          clients.set(client.clientId, client);
          saveClients();
          console.log(`[ALERT] ${title} -> topic:${topic}`);
        })
        .catch((err) => {
          const cause = err && err.cause ? ` | cause: ${err.cause.message || err.cause}` : "";
          console.error(`[ALERT ERROR] ${client.clientId}: ${err.message}${cause}`);
        });
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return respondJson(res, 200, { ok: true, time: nowIso() });
  }

  if (req.method === "GET" && req.url === "/clients") {
    if (!isAuthorized(req)) {
      return respondJson(res, 401, { error: "Unauthorized" });
    }
    return respondJson(res, 200, { clients: Array.from(clients.values()) });
  }

  if (req.method === "POST" && req.url === "/register") {
    if (!isAuthorized(req)) {
      return respondJson(res, 401, { error: "Unauthorized" });
    }

    try {
      const body = await parseJsonBody(req);
      const clientId = String(body.clientId || "").trim();
      if (!clientId) {
        return respondJson(res, 400, { error: "clientId is required" });
      }

      const existing = clients.get(clientId) || {};
      const isNewClient = !clients.has(clientId);
      const now = nowIso();
      const graceMs =
        Number(body.graceMs) > 0
          ? Number(body.graceMs)
          : Number(existing.graceMs || DEFAULT_GRACE_MS);
      const providedTopic =
        body.ntfyTopic === undefined ? undefined : String(body.ntfyTopic || "").trim();
      const clientTopic = providedTopic === undefined ? existing.ntfyTopic || "" : providedTopic;

      const client = {
        clientId,
        name: String(body.name || existing.name || ""),
        ntfyTopic: clientTopic,
        graceMs,
        lastSeenAt: now,
        lastAlertSentAt: existing.lastAlertSentAt || null,
        lastDownAt: existing.lastDownAt || null,
        state: "up",
        lastIp:
          req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress ||
          existing.lastIp ||
          ""
      };

      clients.set(clientId, client);
      saveClients();

      if (isNewClient) {
        const title = `Client REGISTERED: ${client.clientId}`;
        const bodyLines = [
          `New client registered: ${client.clientId}`,
          `Name: ${client.name || "unnamed"}`,
          `IP: ${client.lastIp || "unknown"}`,
          `Topic: ${client.ntfyTopic || NTFY_TOPIC || "(none)"}`,
          `Grace: ${Math.round(graceMs / 60000)} minutes`,
          `Registered at: ${now}`
        ];

        const topic = getClientTopic(client);
        console.log(
          `[REGISTERED] ${client.clientId} (${client.name || "unnamed"}) topic:${topic || "(none)"}`
        );
        sendNtfyAlert(title, bodyLines.join("\n"), topic)
          .then(() => {
            console.log(`[ALERT] ${title} -> topic:${topic}`);
          })
          .catch((err) => {
            const cause = err && err.cause ? ` | cause: ${err.cause.message || err.cause}` : "";
            console.error(`[ALERT ERROR] ${client.clientId}: ${err.message}${cause}`);
          });
      }

      return respondJson(res, 200, { ok: true, client });
    } catch (err) {
      return respondJson(res, 400, { error: err.message });
    }
  }

  if (req.method === "POST" && req.url === "/heartbeat") {
    if (!isAuthorized(req)) {
      return respondJson(res, 401, { error: "Unauthorized" });
    }

    try {
      const body = await parseJsonBody(req);
      const clientId = String(body.clientId || "").trim();
      if (!clientId) {
        return respondJson(res, 400, { error: "clientId is required" });
      }

      const client = clients.get(clientId);
      if (!client) {
        return respondJson(res, 404, {
          error: "Client not registered. Call /register first."
        });
      }

      const wasDown = (client.state || "up") === "down";
      client.lastSeenAt = nowIso();
      client.state = "up";
      client.lastIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
      console.log(`[PING] ${client.clientId} at ${client.lastSeenAt}`);

      if (wasDown) {
        const title = `Client RECOVERED: ${client.clientId}`;
        const body = [
          `Client ${client.clientId} (${client.name || "unnamed"}) is back UP.`,
          `Recovered at: ${client.lastSeenAt}`,
          `Server time: ${nowIso()}`
        ].join("\n");

        try {
          const topic = getClientTopic(client);
          await sendNtfyAlert(title, body, topic);
          client.lastAlertSentAt = nowIso();
          console.log(`[ALERT] ${title} -> topic:${topic}`);
        } catch (err) {
          const cause = err && err.cause ? ` | cause: ${err.cause.message || err.cause}` : "";
          console.error(`[ALERT ERROR] ${client.clientId}: ${err.message}${cause}`);
        }
      }

      clients.set(clientId, client);
      saveClients();
      return respondJson(res, 200, {
        ok: true,
        message: "pong",
        clientId: client.clientId,
        at: client.lastSeenAt,
        state: client.state
      });
    } catch (err) {
      return respondJson(res, 400, { error: err.message });
    }
  }

  return respondJson(res, 404, { error: "Not found" });
});

loadClients();

if (!NTFY_TOPIC) {
  console.log(
    "[WARN] NTFY_TOPIC is not set on server; alerts require per-client ntfyTopic from registration."
  );
}

setInterval(checkForMissedHeartbeats, CHECK_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`Heartbeat server listening on :${PORT}`);
  console.log(`Loaded clients: ${clients.size}`);
});
