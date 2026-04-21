import dotenv from "dotenv";

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 4000),
  clientOrigins: required("CLIENT_ORIGIN", "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  databaseUrl: required("DATABASE_URL", "postgres://heartbeat:heartbeat@127.0.0.1:55432/heartbeat"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  accessTokenTtl: required("ACCESS_TOKEN_TTL", "15m"),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7),
  pairingCodeTtlMinutes: Number(process.env.PAIRING_CODE_TTL_MINUTES || 10),
  deviceOfflineGraceSeconds: Number(process.env.DEVICE_OFFLINE_GRACE_SECONDS || 180),
  adminEmail: required("ADMIN_EMAIL", "admin@example.com"),
  adminPassword: required("ADMIN_PASSWORD", "ChangeMe123!")
};
