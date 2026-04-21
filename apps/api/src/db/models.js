import { DataTypes } from "sequelize";
import { sequelize } from "./sequelize.js";

export const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM("admin", "viewer"), allowNull: false, defaultValue: "viewer" },
    status: { type: DataTypes.ENUM("active", "disabled"), allowNull: false, defaultValue: "active" },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true }
  },
  { tableName: "users", underscored: true }
);

export const RefreshToken = sequelize.define(
  "RefreshToken",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tokenHash: { type: DataTypes.STRING, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revokedAt: { type: DataTypes.DATE, allowNull: true }
  },
  { tableName: "refresh_tokens", underscored: true }
);

export const Device = sequelize.define(
  "Device",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    deviceUid: { type: DataTypes.STRING, allowNull: false, unique: true },
    displayName: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.ENUM("online", "offline", "degraded"), allowNull: false, defaultValue: "offline" },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true },
    registeredAt: { type: DataTypes.DATE, allowNull: true },
    pairedAt: { type: DataTypes.DATE, allowNull: true },
    agentVersion: { type: DataTypes.STRING, allowNull: true },
    heartbeatIntervalSeconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    gracePeriodSeconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 180 },
    lastIp: { type: DataTypes.STRING, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { tableName: "devices", underscored: true }
);

export const DevicePairing = sequelize.define(
  "DevicePairing",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    deviceUid: { type: DataTypes.STRING, allowNull: false },
    deviceName: { type: DataTypes.STRING, allowNull: false },
    pairingCode: { type: DataTypes.STRING, allowNull: false, unique: true },
    fingerprint: { type: DataTypes.STRING, allowNull: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    consumedAt: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.ENUM("pending", "paired", "expired"), allowNull: false, defaultValue: "pending" },
    requestedMeta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { tableName: "device_pairings", underscored: true }
);

export const DeviceCredential = sequelize.define(
  "DeviceCredential",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tokenHash: { type: DataTypes.STRING, allowNull: false },
    label: { type: DataTypes.STRING, allowNull: false, defaultValue: "default" },
    lastUsedAt: { type: DataTypes.DATE, allowNull: true },
    revokedAt: { type: DataTypes.DATE, allowNull: true }
  },
  { tableName: "device_credentials", underscored: true }
);

export const Heartbeat = sequelize.define(
  "Heartbeat",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    sentAt: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.ENUM("online", "offline", "degraded"), allowNull: false, defaultValue: "online" },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { tableName: "heartbeats", underscored: true }
);

export const DeviceStatusEvent = sequelize.define(
  "DeviceStatusEvent",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    status: { type: DataTypes.ENUM("online", "offline", "degraded"), allowNull: false },
    occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { tableName: "device_status_events", underscored: true }
);

export const ServiceStatusEvent = sequelize.define(
  "ServiceStatusEvent",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    serviceName: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.ENUM("up", "down", "degraded"), allowNull: false },
    occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { tableName: "service_status_events", underscored: true }
);

export const ReportSummary = sequelize.define(
  "ReportSummary",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    periodStart: { type: DataTypes.DATEONLY, allowNull: false },
    periodEnd: { type: DataTypes.DATEONLY, allowNull: false },
    deviceUid: { type: DataTypes.STRING, allowNull: false },
    serviceName: { type: DataTypes.STRING, allowNull: true },
    uptimePercentage: { type: DataTypes.FLOAT, allowNull: false },
    summaryType: { type: DataTypes.ENUM("device", "service"), allowNull: false },
    snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { tableName: "report_summaries", underscored: true }
);

export const SystemSetting = sequelize.define(
  "SystemSetting",
  {
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { tableName: "system_settings", underscored: true }
);

User.hasMany(RefreshToken, { foreignKey: "userId" });
RefreshToken.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Device, { foreignKey: "pairedByUserId" });
Device.belongsTo(User, { foreignKey: "pairedByUserId", as: "pairedBy" });

Device.hasMany(DeviceCredential, { foreignKey: "deviceId" });
DeviceCredential.belongsTo(Device, { foreignKey: "deviceId" });

Device.hasMany(Heartbeat, { foreignKey: "deviceId" });
Heartbeat.belongsTo(Device, { foreignKey: "deviceId" });

Device.hasMany(DeviceStatusEvent, { foreignKey: "deviceId" });
DeviceStatusEvent.belongsTo(Device, { foreignKey: "deviceId" });

Device.hasMany(ServiceStatusEvent, { foreignKey: "deviceId" });
ServiceStatusEvent.belongsTo(Device, { foreignKey: "deviceId" });

Device.hasMany(DevicePairing, { foreignKey: "deviceId" });
DevicePairing.belongsTo(Device, { foreignKey: "deviceId" });

export async function syncSchema() {
  await sequelize.sync();
}
