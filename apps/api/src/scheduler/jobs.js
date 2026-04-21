import { Op } from "sequelize";
import { Heartbeat, ReportSummary, ServiceStatusEvent } from "../db/models.js";
import { getStorageSettings } from "../modules/admin/service.js";
import { markStaleDevicesOffline } from "../modules/heartbeats/service.js";
import { generateMonthlySummaries } from "../modules/reports/service.js";

export function startScheduler() {
  setInterval(() => {
    void markStaleDevicesOffline();
  }, 30_000);

  setInterval(() => {
    void generateMonthlySummaries();
  }, 6 * 60 * 60 * 1000);

  setInterval(async () => {
    const settings = await getStorageSettings();
    const heartbeatCutoff = new Date(
      Date.now() - Number(settings.rawHeartbeatRetentionDays || 14) * 24 * 60 * 60 * 1000
    );
    const serviceEventCutoff = new Date(
      Date.now() - Number(settings.rawServiceEventRetentionDays || 14) * 24 * 60 * 60 * 1000
    );
    await Heartbeat.destroy({ where: { receivedAt: { [Op.lt]: heartbeatCutoff } } });
    await ServiceStatusEvent.destroy({ where: { occurredAt: { [Op.lt]: serviceEventCutoff } } });
  }, 12 * 60 * 60 * 1000);
}
