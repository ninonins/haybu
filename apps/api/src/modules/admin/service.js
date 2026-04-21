import { Op } from "sequelize";
import { Heartbeat, ReportSummary, ServiceStatusEvent, SystemSetting } from "../../db/models.js";

const SETTINGS_KEY = "storage_policy";

export const defaultStorageSettings = {
  rawHeartbeatRetentionDays: 14,
  rawServiceEventRetentionDays: 14,
  heartbeatStorageIntervalSeconds: 300,
  summaryGenerationIntervalHours: 6,
  storeEveryHeartbeat: false
};

export async function getStorageSettings() {
  const setting = await SystemSetting.findByPk(SETTINGS_KEY);
  return {
    ...defaultStorageSettings,
    ...(setting?.value || {})
  };
}

export async function saveStorageSettings(patch) {
  const existing = await getStorageSettings();
  const merged = {
    ...existing,
    ...patch
  };

  await SystemSetting.upsert({
    key: SETTINGS_KEY,
    value: merged
  });

  return merged;
}

export async function exportRawRecords() {
  const [heartbeats, serviceEvents] = await Promise.all([
    Heartbeat.findAll({ order: [["receivedAt", "DESC"]], limit: 5000 }),
    ServiceStatusEvent.findAll({ order: [["occurredAt", "DESC"]], limit: 5000 })
  ]);

  return {
    exportedAt: new Date().toISOString(),
    heartbeats,
    serviceEvents
  };
}

export async function exportSummaries() {
  const summaries = await ReportSummary.findAll({ order: [["periodStart", "DESC"]], limit: 5000 });
  return {
    exportedAt: new Date().toISOString(),
    summaries
  };
}

export async function flushRawRecords() {
  const [heartbeatCount, serviceEventCount] = await Promise.all([
    Heartbeat.count(),
    ServiceStatusEvent.count()
  ]);

  await Heartbeat.destroy({ where: { id: { [Op.not]: null } } });
  await ServiceStatusEvent.destroy({ where: { id: { [Op.not]: null } } });

  return {
    heartbeatsDeleted: heartbeatCount,
    serviceEventsDeleted: serviceEventCount
  };
}
