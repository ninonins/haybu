import { fn, col, Op } from "sequelize";
import { Device, Heartbeat, ReportSummary, ServiceStatusEvent } from "../../db/models.js";

export async function getDashboardSummary() {
  const devices = await Device.findAll();
  const summary = {
    totalDevices: devices.length,
    onlineDevices: devices.filter((device) => device.status === "online").length,
    offlineDevices: devices.filter((device) => device.status === "offline").length,
    degradedDevices: devices.filter((device) => device.status === "degraded").length
  };

  const serviceStates = await ServiceStatusEvent.findAll({
    attributes: ["status", [fn("COUNT", col("id")), "count"]],
    group: ["status"]
  });

  summary.services = serviceStates.reduce((acc, row) => {
    acc[row.status] = Number(row.get("count"));
    return acc;
  }, {});

  return summary;
}

export async function getDashboardTrend({ range = "12w" } = {}) {
  const configMap = {
    hourly: {
      bucketCount: 24,
      bucketMs: 60 * 60 * 1000,
      formatLabel: (date) =>
        new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(date)
    },
    daily: {
      bucketCount: 14,
      bucketMs: 24 * 60 * 60 * 1000,
      formatLabel: (date) =>
        new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
    },
    weekly: {
      bucketCount: 12,
      bucketMs: 7 * 24 * 60 * 60 * 1000,
      formatLabel: (_date, index) => `W${index + 1}`
    }
  };
  const config = configMap[range] || configMap.weekly;

  const now = Date.now();
  const startMs = now - config.bucketCount * config.bucketMs;
  const heartbeats = await Heartbeat.findAll({
    where: {
      receivedAt: {
        [Op.gte]: new Date(startMs)
      }
    },
    attributes: ["receivedAt", "status"],
    order: [["receivedAt", "ASC"]]
  });

  const buckets = Array.from({ length: config.bucketCount }).map((_, index) => {
    const bucketStart = new Date(startMs + index * config.bucketMs);
    return {
      name: config.formatLabel(bucketStart, index),
      startAt: bucketStart.toISOString(),
      endAt: new Date(startMs + (index + 1) * config.bucketMs).toISOString(),
      online: 0,
      incidents: 0,
      degraded: 0,
      total: 0
    };
  });
  ;

  for (const heartbeat of heartbeats) {
    const receivedAt = new Date(heartbeat.receivedAt).getTime();
    const bucketIndex = Math.min(
      config.bucketCount - 1,
      Math.max(0, Math.floor((receivedAt - startMs) / config.bucketMs))
    );
    const bucket = buckets[bucketIndex];
    bucket.total += 1;
    if (heartbeat.status === "online") {
      bucket.online += 1;
    } else if (heartbeat.status === "degraded") {
      bucket.degraded += 1;
      bucket.incidents += 1;
    } else {
      bucket.incidents += 1;
    }
  }

  return buckets;
}

export async function getUptimeReport({ deviceId }) {
  const where = deviceId ? { deviceId } : {};
  const heartbeats = await Heartbeat.findAll({ where, order: [["receivedAt", "DESC"]], limit: 500 });
  const devices = await Device.findAll(deviceId ? { where: { id: deviceId } } : {});

  const byDevice = new Map();
  for (const heartbeat of heartbeats) {
    const entry = byDevice.get(heartbeat.deviceId) || { total: 0, good: 0 };
    entry.total += 1;
    if (heartbeat.status === "online") {
      entry.good += 1;
    }
    byDevice.set(heartbeat.deviceId, entry);
  }

  return devices.map((device) => {
    const stats = byDevice.get(device.id) || { total: 0, good: 0 };
    return {
      deviceId: device.id,
      deviceUid: device.deviceUid,
      displayName: device.displayName,
      status: device.status,
      uptimePercentage: stats.total ? Number(((stats.good / stats.total) * 100).toFixed(2)) : 0,
      sampleCount: stats.total
    };
  });
}

export async function exportUptimeCsv({ deviceId }) {
  const report = await getUptimeReport({ deviceId });
  const rows = ["device_uid,display_name,status,uptime_percentage,sample_count"];
  for (const row of report) {
    rows.push(
      [row.deviceUid, row.displayName, row.status, row.uptimePercentage, row.sampleCount]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    );
  }
  return rows.join("\n");
}

export async function generateMonthlySummaries() {
  const report = await getUptimeReport({});
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  for (const row of report) {
    const exists = await ReportSummary.findOne({
      where: {
        deviceUid: row.deviceUid,
        serviceName: null,
        summaryType: "device",
        periodStart,
        periodEnd
      }
    });
    if (exists) {
      continue;
    }
    await ReportSummary.create({
      periodStart,
      periodEnd,
      deviceUid: row.deviceUid,
      serviceName: null,
      uptimePercentage: row.uptimePercentage,
      summaryType: "device",
      snapshot: row
    });
  }
}
