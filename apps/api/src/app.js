import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import authRoutes from "./modules/auth/routes.js";
import adminRoutes from "./modules/admin/routes.js";
import deviceRoutes from "./modules/devices/routes.js";
import pairingRoutes from "./modules/pairing/routes.js";
import reportRoutes from "./modules/reports/routes.js";
import userRoutes from "./modules/users/routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.clientOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: false
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, at: new Date().toISOString() });
  });

  app.use("/auth", authRoutes);
  app.use("/admin", adminRoutes);
  app.use("/users", userRoutes);
  app.use("/devices", deviceRoutes);
  app.use("/pairing", pairingRoutes);
  app.use("/reports", reportRoutes);

  app.use(errorHandler);
  return app;
}
