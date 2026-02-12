import { Router } from "express";
import type { Repos } from "../../db/repos";
import { upload, getUploadUrl } from "../../utils/fileUpload";

export function makeAdminItemsRoutes(repos: Repos) {
  const router = Router();

  // GET /api/admin/items
  router.get("/", async (_req, res) => {
    const items = await repos.itemsAdminRepo.listItems();
    res.json({ items });
  });

  // GET /api/admin/items/:id
  router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

    const item = await repos.itemsAdminRepo.getItem(id);
    if (!item) return res.status(404).json({ error: "Not found" });

    const images = await repos.itemsAdminRepo.listImages(id);
    res.json({ item, images });
  });

  // POST /api/admin/items
  router.post("/", async (req, res) => {
    const body = req.body ?? {};
    try {
      const item = await repos.itemsAdminRepo.createItem({
        title: body.title,
        description: body.description ?? null,
        priceCents: body.priceCents,
        currency: body.currency ?? "USD",
        quantityAvailable: body.quantityAvailable ?? 0,
        makeTimeMinutes: body.makeTimeMinutes ?? null,
        isActive: body.isActive ?? true,
      });
      res.status(201).json({ item });
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Bad Request" });
    }
  });

  // PATCH /api/admin/items/:id
  router.patch("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

    const body = req.body ?? {};
    try {
      const item = await repos.itemsAdminRepo.updateItem(id, {
        title: body.title,
        description: body.description,
        priceCents: body.priceCents,
        currency: body.currency,
        quantityAvailable: body.quantityAvailable,
        makeTimeMinutes: body.makeTimeMinutes,
        isActive: body.isActive,
      });
      res.json({ item });
    } catch (e: any) {
      const msg = e?.message ?? "Bad Request";
      const code = msg.includes("not found") ? 404 : 400;
      res.status(code).json({ error: msg });
    }
  });

  // DELETE /api/admin/items/:id
  router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

    try {
      await repos.itemsAdminRepo.deleteItem(id);
      res.status(204).send();
    } catch (e: any) {
      const msg = e?.message ?? "Bad Request";
      // If deletion fails due to FK restrict (fulfillment_units), surface as 409 conflict
      const code = msg.toLowerCase().includes("violates foreign key") ? 409 : msg.includes("not found") ? 404 : 400;
      res.status(code).json({ error: msg });
    }
  });

  // ---------- Images ----------

  // GET /api/admin/items/:id/images
  router.get("/:id/images", async (req, res) => {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) return res.status(400).json({ error: "Invalid itemId" });

    const images = await repos.itemsAdminRepo.listImages(itemId);
    res.json({ images });
  });

  // POST /api/admin/items/:id/images
  router.post("/:id/images", async (req, res) => {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) return res.status(400).json({ error: "Invalid itemId" });

    const body = req.body ?? {};
    try {
      const image = await repos.itemsAdminRepo.addImage({
        itemId,
        url: body.url,
        sortOrder: body.sortOrder ?? null,
        altText: body.altText ?? null,
      });
      res.status(201).json({ image });
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Bad Request" });
    }
  });

  // POST /api/admin/items/:id/images/upload (file upload)
  router.post("/:id/images/upload", upload.single("file"), async (req, res) => {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) return res.status(400).json({ error: "Invalid itemId" });

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const url = getUploadUrl(req.file.filename);
      const altText = (req.body?.altText as string) || null;
      const sortOrder = req.body?.sortOrder ? Number(req.body.sortOrder) : null;

      const image = await repos.itemsAdminRepo.addImage({
        itemId,
        url,
        sortOrder: Number.isInteger(sortOrder) ? sortOrder : null,
        altText,
      });
      res.status(201).json({ image });
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Bad Request" });
    }
  });

  // PATCH /api/admin/items/images/:imageId
  router.patch("/images/:imageId", async (req, res) => {
    const imageId = Number(req.params.imageId);
    if (!Number.isInteger(imageId) || imageId <= 0) return res.status(400).json({ error: "Invalid imageId" });

    const body = req.body ?? {};
    try {
      const image = await repos.itemsAdminRepo.updateImage(imageId, {
        url: body.url,
        sortOrder: body.sortOrder,
        altText: body.altText,
      });
      res.json({ image });
    } catch (e: any) {
      const msg = e?.message ?? "Bad Request";
      const code = msg.includes("not found") ? 404 : 400;
      res.status(code).json({ error: msg });
    }
  });

  // DELETE /api/admin/items/images/:imageId
  router.delete("/images/:imageId", async (req, res) => {
    const imageId = Number(req.params.imageId);
    if (!Number.isInteger(imageId) || imageId <= 0) return res.status(400).json({ error: "Invalid imageId" });

    try {
      await repos.itemsAdminRepo.deleteImage(imageId);
      res.status(204).send();
    } catch (e: any) {
      const msg = e?.message ?? "Bad Request";
      const code = msg.includes("not found") ? 404 : 400;
      res.status(code).json({ error: msg });
    }
  });

  return router;
}
