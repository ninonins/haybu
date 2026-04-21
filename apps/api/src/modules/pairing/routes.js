import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { completePairing, createPairingSession, getPairingStatus, unpairDevice } from "./service.js";

const router = express.Router();
const pairingLimiter = rateLimit({ windowMs: 60_000, limit: 20 });

const sessionSchema = z.object({
  deviceUid: z.string().min(3),
  deviceName: z.string().min(1),
  fingerprint: z.string().optional(),
  meta: z.record(z.any()).optional()
});

router.post("/session", pairingLimiter, async (req, res, next) => {
  try {
    const payload = sessionSchema.parse(req.body);
    const pairing = await createPairingSession(payload);
    res.status(201).json({
      pairing: {
        code: pairing.pairingCode,
        expiresAt: pairing.expiresAt,
        deviceUid: pairing.deviceUid
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/complete", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }
    const result = await completePairing({ code, adminUserId: req.user.id });
    res.json({
      device: {
        id: result.device.id,
        deviceUid: result.device.deviceUid,
        displayName: result.device.displayName
      },
      credential: result.credential
    });
  } catch (error) {
    error.status = 400;
    next(error);
  }
});

router.get("/status/:code", async (req, res) => {
  const pairing = await getPairingStatus(req.params.code.toUpperCase());
  if (!pairing) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json({
    pairing: {
      code: pairing.pairingCode,
      status: pairing.status,
      expiresAt: pairing.expiresAt,
      consumedAt: pairing.consumedAt,
      deviceUid: pairing.deviceUid
    }
  });
});

router.post("/devices/:deviceId/unpair", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const device = await unpairDevice({ deviceId: req.params.deviceId, adminUserId: req.user.id });
    res.json({ device });
  } catch (error) {
    error.status = 400;
    next(error);
  }
});

export default router;
