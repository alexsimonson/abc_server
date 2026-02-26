import { Router } from "express";
import type { Repos } from "../db/repos";
import type { CreateOrderInput } from "../db/repos/ordersRepo";

// Order limits - must match client-side validation
const MAX_QUANTITY_PER_ITEM = 10;
const MAX_TOTAL_ORDER_ITEMS = 20;

export function makeOrdersRoutes(repos: Repos) {
  const router = Router();

  // POST /api/orders
  router.post("/", async (req, res) => {
    const body = req.body as Partial<CreateOrderInput>;

    if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid body" });
    if (typeof body.email !== "string") return res.status(400).json({ error: "email is required" });
    if (!Array.isArray(body.items) || body.items.length === 0)
      return res.status(400).json({ error: "items must be a non-empty array" });

    // Validate order limits
    const totalItems = body.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (totalItems > MAX_TOTAL_ORDER_ITEMS) {
      return res.status(400).json({ 
        error: `Order is limited to ${MAX_TOTAL_ORDER_ITEMS} total items. For larger orders, please contact us directly.` 
      });
    }

    for (const item of body.items) {
      if (item.quantity > MAX_QUANTITY_PER_ITEM) {
        return res.status(400).json({ 
          error: `Cannot order more than ${MAX_QUANTITY_PER_ITEM} of the same item. For larger orders, please contact us directly.` 
        });
      }
    }

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
