import { Op } from "sequelize";
import { env } from "../../config/env.js";
import { RefreshToken, User } from "../../db/models.js";
import { audit } from "../../lib/audit.js";
import { comparePassword, hashPassword, randomToken, sha256 } from "../../lib/crypto.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/tokens.js";

function refreshExpiry() {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

export async function bootstrapAdmin() {
  const existing = await User.findOne({ where: { email: env.adminEmail } });
  if (existing) {
    return existing;
  }

  const passwordHash = await hashPassword(env.adminPassword);
  return User.create({ email: env.adminEmail, passwordHash, role: "admin", status: "active" });
}

export async function login({ email, password }) {
  const user = await User.findOne({ where: { email } });
  if (!user || user.status !== "active") {
    throw new Error("Invalid credentials");
  }

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) {
    throw new Error("Invalid credentials");
  }

  user.lastLoginAt = new Date();
  await user.save();

  const rawRefreshToken = randomToken(32);
  const refreshRecord = await RefreshToken.create({
    userId: user.id,
    tokenHash: sha256(rawRefreshToken),
    expiresAt: refreshExpiry()
  });

  audit("auth.login", { userId: user.id, email: user.email });

  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user, refreshRecord.id),
    refreshPlaintext: rawRefreshToken
  };
}

export async function refresh(refreshJwt, refreshSecret) {
  const payload = verifyRefreshToken(refreshJwt);
  const tokenRecord = await RefreshToken.findOne({
    where: {
      id: payload.jti,
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() }
    },
    include: [{ model: User }]
  });

  if (!tokenRecord || !tokenRecord.User || tokenRecord.User.status !== "active") {
    throw new Error("Invalid refresh token");
  }

  tokenRecord.revokedAt = new Date();
  await tokenRecord.save();

  const replacementSecret = randomToken(32);
  const replacement = await RefreshToken.create({
    userId: tokenRecord.userId,
    tokenHash: sha256(replacementSecret),
    expiresAt: refreshExpiry()
  });

  audit("auth.refresh", { userId: tokenRecord.userId });

  return {
    user: tokenRecord.User,
    accessToken: signAccessToken(tokenRecord.User),
    refreshToken: signRefreshToken(tokenRecord.User, replacement.id),
    refreshPlaintext: replacementSecret
  };
}

export async function logout(userId) {
  await RefreshToken.update({ revokedAt: new Date() }, { where: { userId, revokedAt: null } });
  audit("auth.logout", { userId });
}
