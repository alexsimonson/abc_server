import { Router } from "express";
import type { Repos } from "../db/repos";

export function makeItemsRoutes(repos: Repos) {
  const router = Router();

  // GET /api/items
  router.get("/", async (_req, res) => {
    const items = await repos.itemsRepo.getActiveItemsWithImages();
    res.json({ items });
  });

  // GET /api/items/:id
  router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

    const item = await repos.itemsRepo.getItemByIdWithImages(id);
    if (!item) return res.status(404).json({ error: "Not found" });

    res.json({ item });
  });

  return router;
}
