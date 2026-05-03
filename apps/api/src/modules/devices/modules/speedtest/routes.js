import express from "express";
import { Device } from "../../../../db/models.js";
import { requireAuth, requireRole } from "../../../../middleware/auth.js";
import {
  exportSpeedtestResults,
  flushSpeedtestResults,
  getSpeedtestResults,
  getSpeedtestSummary
} from "./service.js";

const router = express.Router();

async function findDevice(req, res) {
  const device = await Device.findOne({ where: { deviceUid: req.params.uid } });
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return null;
  }
  return device;
}

router.get("/devices/:uid/modules/speedtest/results", requireAuth, async (req, res, next) => {
  try {
    const device = await findDevice(req, res);
    if (!device) return;

    const payload = await getSpeedtestResults({
      deviceId: device.id,
      deviceUid: device.deviceUid,
      limit: req.query.limit,
      offset: req.query.offset,
      startDate: req.query.start,
      endDate: req.query.end
    });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/devices/:uid/modules/speedtest/summary", requireAuth, async (req, res, next) => {
  try {
    const device = await findDevice(req, res);
    if (!device) return;

    const summary = await getSpeedtestSummary({
      deviceUid: device.deviceUid,
      days: req.query.days
    });
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

router.post("/devices/:uid/modules/speedtest/export", requireAuth, async (req, res, next) => {
  try {
    const device = await findDevice(req, res);
    if (!device) return;

    const format = req.body?.format || "json";
    if (!["csv", "json"].includes(format)) {
      return res.status(400).json({ error: "format must be csv or json" });
    }

    const payload = await exportSpeedtestResults({
      deviceUid: device.deviceUid,
      format
    });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/admin/modules/speedtest/flush", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await flushSpeedtestResults({
      deviceUid: req.body?.deviceUid || null,
      before: req.body?.before
    });
    res.json({ ok: true, result });
  } catch (error) {
    if (error.message === "Valid before date is required") {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
