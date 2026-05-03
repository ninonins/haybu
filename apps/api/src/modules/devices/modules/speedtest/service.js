import { Op, col, fn } from "sequelize";
import { SpeedtestResult } from "../../../../db/models.js";

const EXPORT_COLUMNS = [
  "id",
  "deviceId",
  "deviceUid",
  "downloadMbps",
  "uploadMbps",
  "pingMs",
  "jitterMs",
  "packetLossPercent",
  "serverName",
  "serverId",
  "serverLocation",
  "isp",
  "backend",
  "error",
  "testedAt",
  "createdAt",
  "updatedAt"
];

function pick(result, ...keys) {
  for (const key of keys) {
    if (result?.[key] !== undefined && result[key] !== "") {
      return result[key];
    }
  }
  return null;
}

function toNullableFloat(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableString(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function toDate(value) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeBackend(value) {
  return value === "ookla" ? "ookla" : "speedtest-cli";
}

function normalizeSpeedtestResult({ deviceId, deviceUid, result }) {
  return {
    deviceId,
    deviceUid,
    downloadMbps: toNullableFloat(pick(result, "downloadMbps", "download_mbps", "download")),
    uploadMbps: toNullableFloat(pick(result, "uploadMbps", "upload_mbps", "upload")),
    pingMs: toNullableFloat(pick(result, "pingMs", "ping_ms", "ping")),
    jitterMs: toNullableFloat(pick(result, "jitterMs", "jitter_ms", "jitter")),
    packetLossPercent: toNullableFloat(pick(result, "packetLossPercent", "packet_loss_percent", "packetLoss", "packet_loss")),
    serverName: toNullableString(pick(result, "serverName", "server_name")),
    serverId: toNullableString(pick(result, "serverId", "server_id")),
    serverLocation: toNullableString(pick(result, "serverLocation", "server_location")),
    isp: toNullableString(pick(result, "isp")),
    backend: normalizeBackend(pick(result, "backend")),
    error: toNullableString(pick(result, "error", "message")),
    testedAt: toDate(pick(result, "testedAt", "tested_at", "timestamp", "at"))
  };
}

function buildWhere({ deviceId, deviceUid, startDate, endDate }) {
  const where = {};
  if (deviceId) where.deviceId = deviceId;
  if (deviceUid) where.deviceUid = deviceUid;

  const testedAt = {};
  if (startDate) testedAt[Op.gte] = new Date(startDate);
  if (endDate) testedAt[Op.lte] = new Date(endDate);
  if (Object.keys(testedAt).length > 0) where.testedAt = testedAt;

  return where;
}

function safeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 500);
}

function safeOffset(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function serializeRecord(record) {
  const plain = typeof record.toJSON === "function" ? record.toJSON() : record;
  return {
    ...plain,
    testedAt: plain.testedAt instanceof Date ? plain.testedAt.toISOString() : plain.testedAt,
    createdAt: plain.createdAt instanceof Date ? plain.createdAt.toISOString() : plain.createdAt,
    updatedAt: plain.updatedAt instanceof Date ? plain.updatedAt.toISOString() : plain.updatedAt
  };
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export async function createSpeedtestResult({ deviceId, deviceUid, result }) {
  return SpeedtestResult.create(normalizeSpeedtestResult({ deviceId, deviceUid, result: result || {} }));
}

export async function getSpeedtestResults({ deviceId, deviceUid, limit, offset, startDate, endDate }) {
  const pageLimit = safeLimit(limit);
  const pageOffset = safeOffset(offset);

  const { count, rows } = await SpeedtestResult.findAndCountAll({
    where: buildWhere({ deviceId, deviceUid, startDate, endDate }),
    order: [["testedAt", "DESC"], ["createdAt", "DESC"]],
    limit: pageLimit,
    offset: pageOffset
  });

  return {
    results: rows.map(serializeRecord),
    pagination: {
      total: count,
      limit: pageLimit,
      offset: pageOffset
    }
  };
}

export async function getSpeedtestSummary({ deviceUid, days = 7 }) {
  const parsedDays = Number.parseInt(days, 10);
  const summaryDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7;
  const since = new Date(Date.now() - summaryDays * 24 * 60 * 60 * 1000);

  const row = await SpeedtestResult.findOne({
    where: {
      deviceUid,
      error: null,
      testedAt: { [Op.gte]: since }
    },
    attributes: [
      [fn("COUNT", col("id")), "count"],
      [fn("AVG", col("download_mbps")), "downloadAvgMbps"],
      [fn("MIN", col("download_mbps")), "downloadMinMbps"],
      [fn("MAX", col("download_mbps")), "downloadMaxMbps"],
      [fn("AVG", col("upload_mbps")), "uploadAvgMbps"],
      [fn("MIN", col("upload_mbps")), "uploadMinMbps"],
      [fn("MAX", col("upload_mbps")), "uploadMaxMbps"],
      [fn("AVG", col("ping_ms")), "pingAvgMs"],
      [fn("MIN", col("ping_ms")), "pingMinMs"],
      [fn("MAX", col("ping_ms")), "pingMaxMs"]
    ],
    raw: true
  });

  const numberOrNull = (value) => (value === null || value === undefined ? null : Number(value));

  return {
    deviceUid,
    days: summaryDays,
    since: since.toISOString(),
    count: Number(row?.count || 0),
    downloadMbps: {
      avg: numberOrNull(row?.downloadAvgMbps),
      min: numberOrNull(row?.downloadMinMbps),
      max: numberOrNull(row?.downloadMaxMbps)
    },
    uploadMbps: {
      avg: numberOrNull(row?.uploadAvgMbps),
      min: numberOrNull(row?.uploadMinMbps),
      max: numberOrNull(row?.uploadMaxMbps)
    },
    pingMs: {
      avg: numberOrNull(row?.pingAvgMs),
      min: numberOrNull(row?.pingMinMs),
      max: numberOrNull(row?.pingMaxMs)
    }
  };
}

export async function exportSpeedtestResults({ deviceUid, format = "json" }) {
  const rows = await SpeedtestResult.findAll({
    where: buildWhere({ deviceUid }),
    order: [["testedAt", "DESC"], ["createdAt", "DESC"]]
  });
  const results = rows.map(serializeRecord);

  if (format === "csv") {
    const lines = [
      EXPORT_COLUMNS.join(","),
      ...results.map((record) => EXPORT_COLUMNS.map((column) => csvCell(record[column])).join(","))
    ];
    return { format: "csv", data: lines.join("\n") };
  }

  return { format: "json", data: results };
}

export async function flushSpeedtestResults({ deviceUid, before }) {
  const beforeDate = new Date(before);
  if (!before || Number.isNaN(beforeDate.getTime())) {
    throw new Error("Valid before date is required");
  }

  const where = {
    testedAt: { [Op.lt]: beforeDate }
  };
  if (deviceUid) where.deviceUid = deviceUid;

  const deleted = await SpeedtestResult.destroy({ where });
  return { deleted, before: beforeDate.toISOString(), deviceUid: deviceUid || null };
}
