import { Op } from "sequelize";
import { env } from "../../config/env.js";
import { Device, DeviceCredential, DeviceStatusEvent, Heartbeat, ServiceStatusEvent } from "../../db/models.js";
import { audit } from "../../lib/audit.js";
import { sha256 } from "../../lib/crypto.js";
import { getStorageSettings } from "../admin/service.js";

export async function authenticateDeviceToken(rawToken) {
  const tokenHash = sha256(rawToken);
  const credential = await DeviceCredential.findOne({
    where: { tokenHash, revokedAt: null },
    include: [{ model: Device }]
  });
  if (!credential || !credential.Device) {
    return null;
  }
  credential.lastUsedAt = new Date();
  await credential.save();
  return credential.Device;
}

export async function isDeviceTokenActive(rawToken) {
  const tokenHash = sha256(rawToken);
  const credential = await DeviceCredential.findOne({
    where: { tokenHash, revokedAt: null }
  });
  return Boolean(credential);
}

function deriveStatus(services) {
  const activeServices = services.filter((service) => service.monitorMode !== "ignore");
  if (activeServices.some((service) => service.status === "down")) {
    return "degraded";
  }
  if (activeServices.some((service) => service.status === "degraded")) {
    return "degraded";
  }
  return "online";
}

function simplifyStatusCode(status) {
  if (status === "online") return "o";
  if (status === "offline") return "f";
  return "d";
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function hasChanged(nextValue, currentValue) {
  return JSON.stringify(sortObject(nextValue || null)) !== JSON.stringify(sortObject(currentValue || null));
}

function toCurrentServiceState(services) {
  return services.map((service) => ({
    name: service.name,
    source: service.source,
    type: service.type,
    status: service.status,
    reason: service.reason || "",
    checkedAt: service.checkedAt,
    monitorMode: service.monitorMode || "active"
  }));
}

function compactHeartbeatPayload(payload, services, status) {
  return {
    s: simplifyStatusCode(status),
    m: {
      cpu: payload.system?.cpuPercent ?? null,
      mem: payload.system?.memoryPercent ?? null,
      disk: payload.system?.diskPercent ?? null
    },
    sv: services.map((service) => ({
      n: service.name,
      src: service.source,
      st: service.status === "up" ? "u" : service.status === "down" ? "d" : "g",
      mm: service.monitorMode === "ignore" ? "i" : "a"
    }))
  };
}

export async function ingestHeartbeat(device, payload, remoteIp) {
  const settings = await getStorageSettings();
  const sentAt = payload.sentAt ? new Date(payload.sentAt) : new Date();
  const services = Array.isArray(payload.services) ? payload.services : [];
  const nextStatus = deriveStatus(services);
  const previousStatus = device.status;
  const nextInventory = payload.inventory || null;
  const nextDiscoveredServices = payload.discoveredServices || [];
  const previousInventory = device.metadata?.inventory || null;
  const previousDiscoveredServices = device.metadata?.discoveredServices || [];
  const previousCurrentServices = device.metadata?.currentServices || [];
  const nextCurrentServices = toCurrentServiceState(services);
  const inventoryChanged = nextInventory && hasChanged(nextInventory, previousInventory);
  const discoveredServicesChanged = hasChanged(nextDiscoveredServices, previousDiscoveredServices);
  const currentServicesChanged = hasChanged(nextCurrentServices, previousCurrentServices);
  const lastStoredAt = device.metadata?.storage?.lastRawHeartbeatStoredAt
    ? new Date(device.metadata.storage.lastRawHeartbeatStoredAt).getTime()
    : 0;
  const storeIntervalMs = Number(settings.heartbeatStorageIntervalSeconds || 300) * 1000;
  const shouldStoreRawHeartbeat =
    settings.storeEveryHeartbeat ||
    !lastStoredAt ||
    Date.now() - lastStoredAt >= storeIntervalMs ||
    previousStatus !== nextStatus ||
    currentServicesChanged;

  device.status = nextStatus;
  device.lastSeenAt = new Date();
  device.agentVersion = payload.agentVersion || device.agentVersion;
  device.lastIp = remoteIp;
  device.metadata = {
    ...(device.metadata || {}),
    system: payload.system || {},
    network: payload.network || {},
    inventory: inventoryChanged ? nextInventory : previousInventory,
    discoveredServices: discoveredServicesChanged ? nextDiscoveredServices : previousDiscoveredServices,
    currentServices: nextCurrentServices,
    storage: {
      ...(device.metadata?.storage || {}),
      lastRawHeartbeatStoredAt: shouldStoreRawHeartbeat
        ? new Date().toISOString()
        : device.metadata?.storage?.lastRawHeartbeatStoredAt || null
    }
  };
  await device.save();

  if (shouldStoreRawHeartbeat) {
    await Heartbeat.create({
      deviceId: device.id,
      sentAt,
      receivedAt: new Date(),
      status: nextStatus,
      payload: compactHeartbeatPayload(payload, services, nextStatus)
    });
  }

  if (previousStatus !== nextStatus) {
    await DeviceStatusEvent.create({
      deviceId: device.id,
      status: nextStatus,
      occurredAt: new Date(),
      details: { reason: "heartbeat-transition" }
    });
  }

  for (const service of services) {
    const previous = previousCurrentServices.find(
      (item) => item.name === service.name && item.source === service.source
    );
    if (!previous || previous.status !== service.status || previous.monitorMode !== service.monitorMode) {
      await ServiceStatusEvent.create({
        deviceId: device.id,
        serviceName: service.name,
        status: service.status,
        occurredAt: service.checkedAt ? new Date(service.checkedAt) : new Date(),
        details: service
      });
    }
  }

  audit("heartbeat.ingest", {
    deviceId: device.id,
    deviceUid: device.deviceUid,
    status: nextStatus,
    serviceCount: services.length
  });

  return { status: nextStatus, at: device.lastSeenAt };
}

export async function markStaleDevicesOffline() {
  const devices = await Device.findAll({
    where: { lastSeenAt: { [Op.not]: null } }
  });

  for (const device of devices) {
    const graceMs = (device.gracePeriodSeconds || env.deviceOfflineGraceSeconds) * 1000;
    const delta = Date.now() - new Date(device.lastSeenAt).getTime();
    if (delta > graceMs && device.status !== "offline") {
      device.status = "offline";
      await device.save();
      await DeviceStatusEvent.create({
        deviceId: device.id,
        status: "offline",
        occurredAt: new Date(),
        details: { reason: "stale-heartbeat" }
      });
      audit("device.offline", { deviceId: device.id, deviceUid: device.deviceUid });
    }
  }
}
