import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { ensureAuthFile, verifyAdminCredentials, updateAdminPassword, loadAuth, verifyPassword } from "./auth-admin";
import { api } from "@shared/routes";
import { z } from "zod";
import { containsProfanity } from "./profanity";

const ADMIN_COOKIE = "admin_session";
const adminTokens = new Set<string>();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token || !adminTokens.has(token)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

function isAdmin(req: Request): boolean {
  const token = req.cookies?.[ADMIN_COOKIE];
  return !!(token && adminTokens.has(token));
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.scores.list.path, async (_req, res) => {
    const scores = await storage.getTopScores();
    res.json(scores);
  });

  app.post(api.scores.create.path, async (req, res) => {
    try {
      const input = api.scores.create.input.parse(req.body);
      if (containsProfanity(input.name)) {
        return res.status(400).json({
          message: "Name contains inappropriate language.",
        });
      }
      const score = await storage.createScore(input);
      res.status(201).json(score);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.errors[0]?.message ?? "Validation failed";
        return res.status(400).json({ message });
      }
      throw err;
    }
  });

  app.post(api.admin.login.path, async (req, res) => {
    try {
      await ensureAuthFile();
      const { username, password } = api.admin.login.input.parse(req.body);
      const valid = await verifyAdminCredentials(username, password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      const token = randomBytes(24).toString("hex");
      adminTokens.add(token);
      res.cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 24 * 60 * 60 * 1000 });
      res.json({ ok: true as const });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(401).json({ message: "Invalid request" });
      }
      throw err;
    }
  });

  app.post(api.admin.changePassword.path, requireAdmin, async (req, res) => {
    try {
      const { currentPassword, newPassword } = api.admin.changePassword.input.parse(req.body);
      const auth = await loadAuth();
      if (!verifyPassword(currentPassword, auth.passwordHash)) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      await updateAdminPassword(newPassword);
      res.json({ ok: true as const });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.errors[0]?.message ?? "Validation failed";
        return res.status(400).json({ message });
      }
      throw err;
    }
  });

  app.get(api.admin.check.path, (req, res) => {
    res.json({ authenticated: isAdmin(req) });
  });

  app.get(api.admin.scores.list.path, requireAdmin, async (_req, res) => {
    const scores = await storage.getAllScores();
    res.json(scores);
  });

  app.patch(api.admin.scores.update.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    try {
      const input = api.admin.scores.update.input.parse(req.body);
      const score = await storage.updateScore(id, input);
      if (!score) {
        return res.status(404).json({ message: "Score not found" });
      }
      res.json(score);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.errors[0]?.message ?? "Validation failed";
        return res.status(400).json({ message });
      }
      throw err;
    }
  });

  app.delete(api.admin.scores.delete.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const deleted = await storage.deleteScore(id);
    if (!deleted) {
      return res.status(404).json({ message: "Score not found" });
    }
    res.status(204).send();
  });

  return httpServer;
}
