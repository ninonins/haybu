import express from "express";
import { Device, DeviceStatusEvent, Heartbeat, ServiceStatusEvent } from "../../db/models.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { deleteDevice, unpairDevice } from "../pairing/service.js";

const router = express.Router();

router.get("/", requireAuth, async (_req, res) => {
  const devices = await Device.findAll({ order: [["displayName", "ASC"]] });
  res.json({ devices });
});

router.get("/:id", requireAuth, async (req, res) => {
  const device = await Device.findByPk(req.params.id);
  if (!device) {
    return res.status(404).json({ error: "Device not found" });
  }

  const [heartbeats, statusEvents, serviceEvents] = await Promise.all([
    Heartbeat.findAll({ where: { deviceId: device.id }, order: [["receivedAt", "DESC"]], limit: 20 }),
    DeviceStatusEvent.findAll({
      where: { deviceId: device.id },
      order: [["occurredAt", "DESC"]],
      limit: 20
    }),
    ServiceStatusEvent.findAll({
      where: { deviceId: device.id },
      order: [["occurredAt", "DESC"]],
      limit: 50
    })
  ]);

  res.json({ device, heartbeats, statusEvents, serviceEvents });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const device = await Device.findByPk(req.params.id);
  if (!device) {
    return res.status(404).json({ error: "Device not found" });
  }
  if (req.body.displayName) {
    device.displayName = String(req.body.displayName);
  }
  if (req.body.gracePeriodSeconds) {
    device.gracePeriodSeconds = Number(req.body.gracePeriodSeconds);
  }
  if (req.body.heartbeatIntervalSeconds) {
    device.heartbeatIntervalSeconds = Number(req.body.heartbeatIntervalSeconds);
  }
  if (req.body.monitoring && Object.hasOwn(req.body.monitoring, "services")) {
    device.metadata = {
      ...(device.metadata || {}),
      monitoring: {
        ...(device.metadata?.monitoring || {}),
        services: req.body.monitoring.services,
        groups: req.body.monitoring.groups || device.metadata?.monitoring?.groups || {}
      }
    };
  }
  await device.save();
  res.json({ device });
});

router.post("/:id/unpair", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const device = await unpairDevice({ deviceId: req.params.id, adminUserId: req.user.id });
    res.json({ device });
  } catch (error) {
    error.status = 400;
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const deleted = await deleteDevice({ deviceId: req.params.id, adminUserId: req.user.id });
    res.json({ deleted, ok: true });
  } catch (error) {
    error.status = 400;
    next(error);
  }
});

export default router;
