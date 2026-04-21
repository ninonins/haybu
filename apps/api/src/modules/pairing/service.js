import { Op } from "sequelize";
import { env } from "../../config/env.js";
import {
  Device,
  DeviceCredential,
  DevicePairing,
  DeviceStatusEvent,
  Heartbeat,
  ReportSummary,
  ServiceStatusEvent
} from "../../db/models.js";
import { audit } from "../../lib/audit.js";
import { generatePairingCode, randomToken, sha256 } from "../../lib/crypto.js";

function pairingExpiryDate() {
  return new Date(Date.now() + env.pairingCodeTtlMinutes * 60 * 1000);
}

export async function createPairingSession({ deviceUid, deviceName, fingerprint, meta }) {
  await DevicePairing.update(
    { status: "expired" },
    { where: { deviceUid, status: "pending", expiresAt: { [Op.lt]: new Date() } } }
  );

  const pairing = await DevicePairing.create({
    deviceUid,
    deviceName,
    fingerprint,
    requestedMeta: meta ?? {},
    pairingCode: generatePairingCode(),
    expiresAt: pairingExpiryDate()
  });

  return pairing;
}

export async function completePairing({ code, adminUserId }) {
  const pairing = await DevicePairing.findOne({
    where: {
      pairingCode: code,
      status: "pending",
      consumedAt: null,
      expiresAt: { [Op.gt]: new Date() }
    }
  });

  if (!pairing) {
    throw new Error("Pairing code is invalid or expired");
  }

  const [device] = await Device.findOrCreate({
    where: { deviceUid: pairing.deviceUid },
    defaults: {
      deviceUid: pairing.deviceUid,
      displayName: pairing.deviceName,
      registeredAt: new Date(),
      pairedAt: new Date(),
      pairedByUserId: adminUserId,
      metadata: pairing.requestedMeta
    }
  });

  device.displayName = pairing.deviceName || device.displayName;
  device.metadata = {
    ...(device.metadata || {}),
    ...(pairing.requestedMeta || {})
  };
  device.pairedAt = new Date();
  device.registeredAt = device.registeredAt || new Date();
  device.pairedByUserId = adminUserId;
  await device.save();

  const rawCredential = randomToken(32);
  await DeviceCredential.create({
    deviceId: device.id,
    tokenHash: sha256(rawCredential)
  });

  pairing.consumedAt = new Date();
  pairing.status = "paired";
  pairing.deviceId = device.id;
  await pairing.save();

  audit("pairing.complete", { code, deviceUid: device.deviceUid, adminUserId });

  return { device, credential: rawCredential, expiresAt: pairing.expiresAt };
}

export async function getPairingStatus(code) {
  const pairing = await DevicePairing.findOne({ where: { pairingCode: code } });
  if (!pairing) {
    return null;
  }
  return pairing;
}

export async function unpairDevice({ deviceId, adminUserId }) {
  const device = await Device.findByPk(deviceId);
  if (!device) {
    throw new Error("Device not found");
  }

  await DeviceCredential.update(
    { revokedAt: new Date() },
    { where: { deviceId: device.id, revokedAt: null } }
  );

  await DevicePairing.update(
    { status: "expired" },
    { where: { deviceId: device.id, status: "pending" } }
  );

  device.status = "offline";
  device.pairedAt = null;
  device.lastSeenAt = null;
  device.lastIp = null;
  device.metadata = {
    ...(device.metadata || {}),
    pairing: {
      ...(device.metadata?.pairing || {}),
      unpairedAt: new Date().toISOString(),
      unpairedByUserId: adminUserId
    }
  };
  await device.save();

  audit("device.unpair", { deviceId: device.id, deviceUid: device.deviceUid, adminUserId });
  return device;
}

export async function deleteDevice({ deviceId, adminUserId }) {
  const device = await Device.findByPk(deviceId);
  if (!device) {
    throw new Error("Device not found");
  }

  const deviceUid = device.deviceUid;

  await DeviceCredential.destroy({ where: { deviceId: device.id } });
  await DevicePairing.destroy({ where: { [Op.or]: [{ deviceId: device.id }, { deviceUid }] } });
  await Heartbeat.destroy({ where: { deviceId: device.id } });
  await DeviceStatusEvent.destroy({ where: { deviceId: device.id } });
  await ServiceStatusEvent.destroy({ where: { deviceId: device.id } });
  await ReportSummary.destroy({ where: { deviceUid } });
  await device.destroy();

  audit("device.delete", { deviceId, deviceUid, adminUserId });
  return { id: deviceId, deviceUid };
}
