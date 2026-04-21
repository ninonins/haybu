import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { login, logout, refresh } from "./service.js";

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 60_000, limit: 10 });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await login(payload);
    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      refreshSecret: result.refreshPlaintext,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role
      }
    });
  } catch (error) {
    error.status = 401;
    next(error);
  }
});

router.post("/refresh", authLimiter, async (req, res, next) => {
  try {
    const refreshToken = String(req.body.refreshToken || "");
    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken is required" });
    }
    const result = await refresh(refreshToken);
    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      refreshSecret: result.refreshPlaintext,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role
      }
    });
  } catch (error) {
    error.status = 401;
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await logout(req.user.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status
    }
  });
});

export default router;
