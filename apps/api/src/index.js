import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { sequelize } from "./db/sequelize.js";
import { syncSchema } from "./db/models.js";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { bootstrapAdmin } from "./modules/auth/service.js";
import {
  authenticateDeviceToken,
  ingestHeartbeat,
  isDeviceTokenActive
} from "./modules/heartbeats/service.js";
import { startScheduler } from "./scheduler/jobs.js";

const app = createApp();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/devices" });

wss.on("connection", async (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token") || "";
  const device = await authenticateDeviceToken(token);

  if (!device) {
    socket.send(JSON.stringify({ type: "error", message: "unauthorized" }));
    socket.close();
    return;
  }

  socket.send(
    JSON.stringify({
      type: "ack",
      message: "connected",
      deviceUid: device.deviceUid,
      config: device.metadata?.monitoring || { services: [] }
    })
  );

  socket.on("message", async (raw) => {
    try {
      const stillAuthorized = await isDeviceTokenActive(token);
      if (!stillAuthorized) {
        socket.send(JSON.stringify({ type: "error", message: "device credential revoked" }));
        socket.close();
        return;
      }

      const message = JSON.parse(raw.toString());
      if (message.type !== "heartbeat") {
        return;
      }
      const result = await ingestHeartbeat(
        device,
        message.payload || {},
        req.socket.remoteAddress || ""
      );
      await device.reload();
      socket.send(
        JSON.stringify({
          type: "ack",
          at: result.at,
          status: result.status,
          config: device.metadata?.monitoring || { services: [] }
        })
      );
    } catch (error) {
      socket.send(JSON.stringify({ type: "error", message: error.message }));
    }
  });
});

await sequelize.authenticate();
await syncSchema();
await bootstrapAdmin();
startScheduler();

server.listen(env.port, () => {
  console.log(`API listening on ${env.port}`);
});
