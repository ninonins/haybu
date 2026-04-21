import express from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  exportRawRecords,
  exportSummaries,
  flushRawRecords,
  getStorageSettings,
  saveStorageSettings
} from "./service.js";

const router = express.Router();

router.get("/settings", requireAuth, requireRole("admin"), async (_req, res) => {
  const settings = await getStorageSettings();
  res.json({ settings });
});

router.patch("/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const settings = await saveStorageSettings(req.body || {});
  res.json({ settings });
});

router.post("/export/raw", requireAuth, requireRole("admin"), async (_req, res) => {
  const payload = await exportRawRecords();
  res.json(payload);
});

router.post("/export/summaries", requireAuth, requireRole("admin"), async (_req, res) => {
  const payload = await exportSummaries();
  res.json(payload);
});

router.post("/flush/raw", requireAuth, requireRole("admin"), async (_req, res) => {
  const result = await flushRawRecords();
  res.json({ ok: true, result });
});

export default router;
