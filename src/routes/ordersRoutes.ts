import { Router } from "express";
import type { Repos } from "../db/repos";
import type { CreateOrderInput } from "../db/repos/ordersRepo";

export function makeOrdersRoutes(repos: Repos) {
  const router = Router();

  // POST /api/orders
  router.post("/", async (req, res) => {
    const body = req.body as Partial<CreateOrderInput>;

    if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid body" });
    if (typeof body.email !== "string") return res.status(400).json({ error: "email is required" });
    if (!Array.isArray(body.items) || body.items.length === 0)
      return res.status(400).json({ error: "items must be a non-empty array" });

    const result = await repos.ordersRepo.createOrderWithFulfillmentUnits({
      email: body.email,
      shippingAddress: body.shippingAddress ?? null,
      items: body.items,
      taxCents: body.taxCents ?? 0,
      shippingCents: body.shippingCents ?? 0,
      currency: body.currency ?? "USD",
    });

    res.status(201).json(result);
  });

  return router;
}
