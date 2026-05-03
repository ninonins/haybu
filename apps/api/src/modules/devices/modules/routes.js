import express from "express";
import { Device } from "../../../db/models.js";
import { requireAuth, requireRole } from "../../../middleware/auth.js";
import { getModuleRegistry, getDeviceModules, updateDeviceModule, queueModuleCommand } from "./service.js";

const router = express.Router();

router.get("/registry", requireAuth, async (_req, res) => {
  const registry = await getModuleRegistry();
  res.json({ modules: registry });
});

router.get("/:uid/modules", requireAuth, async (req, res) => {
  const device = await Device.findOne({ where: { deviceUid: req.params.uid } });
  if (!device) {
    return res.status(404).json({ error: "Device not found" });
  }
  const modules = await getDeviceModules(device.id);
  res.json({ modules });
});

router.patch("/:uid/modules/:name", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const device = await Device.findOne({ where: { deviceUid: req.params.uid } });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    const updated = await updateDeviceModule({
      deviceId: device.id,
      moduleName: req.params.name,
      enabled: req.body.enabled,
      config: req.body.config,
    });
    res.json({ module: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/:uid/modules/:name/run", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const device = await Device.findOne({ where: { deviceUid: req.params.uid } });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    const queued = await queueModuleCommand({
      deviceId: device.id,
      deviceUid: device.deviceUid,
      moduleName: req.params.name,
      action: req.body.action || "run",
    });
    res.json({ queued });
  } catch (error) {
    next(error);
  }
});

export default router;
