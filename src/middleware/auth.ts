import type { Request, Response, NextFunction } from "express";
import type { Knex } from "knex";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }
  next();
}

export function makeRequireAdmin(knex: Knex) {
  return async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    const user = await knex("users")
      .select("is_admin")
      .where({ id: userId })
      .first();

    if (!user || !user.is_admin) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    
    next();
  };
}
