import { DeviceModule, Device } from "../../db/models.js";

const MODULE_REGISTRY = [
  {
    name: "speedtest",
    version: "1.0.0",
    description: "Internet speed test using speedtest-cli",
    configSchema: {
      intervalSeconds: { type: "number", default: 3600, min: 300, max: 86400, description: "Seconds between automatic runs" },
      serverId: { type: "string", default: "", description: "Optional server ID to pin tests" }
    },
    supportedMetrics: ["download_mbps", "upload_mbps", "ping_ms", "jitter_ms", "server_name"],
    requiresBinary: "speedtest-cli"
  }
];

export async function getModuleRegistry() {
  return MODULE_REGISTRY;
}

export async function getDeviceModules(deviceId) {
  const existing = await DeviceModule.findAll({
    where: { deviceId },
    order: [["moduleName", "ASC"]]
  });

  const existingMap = new Map(existing.map((m) => [m.moduleName, m]));

  return MODULE_REGISTRY.map((registryItem) => {
    const instance = existingMap.get(registryItem.name);
    return {
      name: registryItem.name,
      version: registryItem.version,
      description: registryItem.description,
      configSchema: registryItem.configSchema,
      supportedMetrics: registryItem.supportedMetrics,
      requiresBinary: registryItem.requiresBinary || null,
      enabled: instance?.enabled ?? false,
      config: instance?.config ?? {},
      lastRunAt: instance?.lastRunAt ?? null,
      lastResult: instance?.lastResult ?? {},
    };
  });
}

export async function updateDeviceModule({ deviceId, moduleName, enabled, config }) {
  const registryItem = MODULE_REGISTRY.find((m) => m.name === moduleName);
  if (!registryItem) {
    throw new Error(`Unknown module: ${moduleName}`);
  }

  const [instance] = await DeviceModule.findOrCreate({
    where: { deviceId, moduleName },
    defaults: { deviceId, moduleName, enabled: false, config: {}, lastResult: {} },
  });

  if (typeof enabled === "boolean") {
    instance.enabled = enabled;
  }
  if (config && typeof config === "object") {
    instance.config = { ...(instance.config || {}), ...config };
  }
  await instance.save();
  return instance;
}

const pendingCommands = new Map();

export async function queueModuleCommand({ deviceId, deviceUid, moduleName, action }) {
  const registryItem = MODULE_REGISTRY.find((m) => m.name === moduleName);
  if (!registryItem) {
    throw new Error(`Unknown module: ${moduleName}`);
  }
  const key = deviceUid;
  if (!pendingCommands.has(key)) {
    pendingCommands.set(key, []);
  }
  pendingCommands.get(key).push({ module: moduleName, action, queuedAt: new Date().toISOString() });
  return { module: moduleName, action, queued: true };
}

export function popPendingCommands(deviceUid) {
  const key = deviceUid;
  const commands = pendingCommands.get(key) || [];
  pendingCommands.delete(key);
  return commands;
}

export function hasPendingCommands(deviceUid) {
  return (pendingCommands.get(deviceUid) || []).length > 0;
}

export async function updateModuleLastResult({ deviceId, moduleName, result }) {
  const instance = await DeviceModule.findOne({ where: { deviceId, moduleName } });
  if (!instance) return null;
  instance.lastRunAt = new Date();
  instance.lastResult = result || {};
  await instance.save();
  return instance;
}
