import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getDashboardSummary, getDashboardTrend, getUptimeReport, exportUptimeCsv } from "./service.js";

const router = express.Router();

router.get("/dashboard", requireAuth, async (_req, res) => {
  const summary = await getDashboardSummary();
  const trend = await getDashboardTrend({ range: _req.query.range || "12w" });
  res.json({ summary, trend });
});

router.get("/uptime", requireAuth, async (req, res) => {
  const report = await getUptimeReport({ deviceId: req.query.deviceId });
  res.json({ report });
});

router.get("/export", requireAuth, async (req, res) => {
  const csv = await exportUptimeCsv({ deviceId: req.query.deviceId });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=uptime-report.csv");
  res.send(csv);
});

export default router;
