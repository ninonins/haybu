import express from "express";
import { z } from "zod";
import { User } from "../../db/models.js";
import { hashPassword } from "../../lib/crypto.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = express.Router();
const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "viewer"])
});

router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  const users = await User.findAll({ order: [["email", "ASC"]] });
  res.json({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt
    }))
  });
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const user = await User.create({
      email: body.email,
      passwordHash,
      role: body.role
    });
    res.status(201).json({
      user: { id: user.id, email: user.email, role: user.role, status: user.status }
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.body.role && ["admin", "viewer"].includes(req.body.role)) {
      user.role = req.body.role;
    }
    if (req.body.status && ["active", "disabled"].includes(req.body.status)) {
      user.status = req.body.status;
    }
    await user.save();
    res.json({ user: { id: user.id, email: user.email, role: user.role, status: user.status } });
  } catch (error) {
    next(error);
  }
});

export default router;
