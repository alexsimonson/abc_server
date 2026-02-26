import { Router } from "express";
import type { Knex } from "knex";
import bcrypt from "bcryptjs";
import { requireAuth } from "../middleware/auth";

function userDto(u: any) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.display_name ?? null,
    isAdmin: u.is_admin ?? false,
  };
}

export function makeAuthRouter(knex: Knex) {
  const router = Router();

  // POST /auth/login
  router.post("/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "BAD_REQUEST" });
    }

    const user = await knex("users")
      .select("id", "email", "username", "display_name", "is_admin", "password_hash")
      .where({ email })
      .first();

    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    req.session.userId = user.id;
    return res.json({ user: userDto(user) });
  });

  // POST /auth/logout
  router.post("/logout", requireAuth, async (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "LOGOUT_FAILED" });
      res.status(204).send();
    });
  });

  // GET /auth/me
  router.get("/me", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const user = await knex("users")
      .select("id", "email", "username", "display_name", "is_admin")
      .where({ id: userId })
      .first();

    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });
    return res.json({ user: userDto(user) });
  });

  // PUT /auth/me - Update own profile
  router.put("/me", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const { username, displayName, email } = req.body ?? {};

    const updates: any = {};
    
    if (typeof username === "string") {
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: "INVALID_USERNAME" });
      }
      // Check if username is taken by another user
      const existing = await knex("users")
        .select("id")
        .where({ username })
        .whereNot({ id: userId })
        .first();
      if (existing) {
        return res.status(409).json({ error: "USERNAME_ALREADY_EXISTS" });
      }
      updates.username = username;
    }

    if (typeof displayName === "string") {
      updates.display_name = displayName.trim() || null;
    }

    if (typeof email === "string") {
      if (email.length < 3 || !email.includes("@")) {
        return res.status(400).json({ error: "INVALID_EMAIL" });
      }
      // Check if email is taken by another user
      const existing = await knex("users")
        .select("id")
        .where({ email })
        .whereNot({ id: userId })
        .first();
      if (existing) {
        return res.status(409).json({ error: "EMAIL_ALREADY_EXISTS" });
      }
      updates.email = email;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "NO_UPDATES_PROVIDED" });
    }

    updates.updated_at = knex.fn.now();

    await knex("users").where({ id: userId }).update(updates);

    const user = await knex("users")
      .select("id", "email", "username", "display_name", "is_admin")
      .where({ id: userId })
      .first();

    return res.json({ user: userDto(user) });
  });

  return router;
}
