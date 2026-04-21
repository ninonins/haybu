import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

export async function hashPassword(value) {
  return bcrypt.hash(value, 12);
}

export async function comparePassword(value, hash) {
  return bcrypt.compare(value, hash);
}

export function randomToken(size = 32) {
  return randomBytes(size).toString("hex");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function generatePairingCode() {
  return randomBytes(3).toString("hex").toUpperCase();
}
