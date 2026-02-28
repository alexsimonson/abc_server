import { Router } from "express";
import type { Repos } from "../../db/repos";
import type { FulfillmentStateCode, OrderStatusCode } from "../../db/repos/ordersRepo";

function isFulfillmentStateCode(x: unknown): x is FulfillmentStateCode {
  return x === "NEEDS_CREATED" || x === "NEEDS_SHIPPED" || x === "SHIPPED";
}

function isOrderStatusCode(x: unknown): x is OrderStatusCode {
  return x === "RECEIVED" || x === "COMPLETE";
}

export function makeAdminFulfillmentRoutes(repos: Repos) {
  const router = Router();

  // GET /api/admin/fulfillment/orders?status=RECEIVED|COMPLETE&orderId=123&email=foo&limit=100&offset=0
  router.get("/orders", async (req, res) => {
    const status = req.query.status;
    if (status != null && !isOrderStatusCode(status)) {
      return res.status(400).json({ error: "status must be one of RECEIVED | COMPLETE" });
    }

    const orderId = req.query.orderId == null ? undefined : Number(req.query.orderId);
    if (orderId != null && (!Number.isInteger(orderId) || orderId <= 0)) {
      return res.status(400).json({ error: "orderId must be a positive integer" });
    }

    const email = req.query.email;
    if (email != null && typeof email !== "string") {
      return res.status(400).json({ error: "email must be a string" });
    }

    const limit = req.query.limit == null ? undefined : Number(req.query.limit);
    const offset = req.query.offset == null ? undefined : Number(req.query.offset);

    const orders = await repos.fulfillmentRepo.getOrderSummaries({
      status,
      orderId,
      emailQuery: email?.trim() || undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });

    res.json({ count: orders.length, orders });
  });

  // GET /api/admin/fulfillment/orders/:id
  router.get("/orders/:id", async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: "Invalid id" });

    const detail = await repos.fulfillmentRepo.getOrderDetail(orderId);
    if (!detail) return res.status(404).json({ error: "Order not found" });

    res.json(detail);
  });

  // GET /api/admin/fulfillment/queue?state=NEEDS_CREATED|NEEDS_SHIPPED|SHIPPED&limit=100&offset=0
  router.get("/queue", async (req, res) => {
    const state = req.query.state;
    if (!isFulfillmentStateCode(state)) {
      return res.status(400).json({ error: "state must be one of NEEDS_CREATED | NEEDS_SHIPPED | SHIPPED" });
    }

    const limit = req.query.limit == null ? undefined : Number(req.query.limit);
    const offset = req.query.offset == null ? undefined : Number(req.query.offset);

    const rows = await repos.fulfillmentRepo.getQueue({
      state,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });

    res.json({ state, count: rows.length, rows });
  });

  // PATCH /api/admin/fulfillment/units/:id/created-done
  // Transition NEEDS_CREATED -> NEEDS_SHIPPED
  router.patch("/units/:id/created-done", async (req, res) => {
    const unitId = Number(req.params.id);
    if (!Number.isInteger(unitId) || unitId <= 0) return res.status(400).json({ error: "Invalid id" });

    const result = await repos.fulfillmentRepo.markCreatedDone({ unitId });
    res.json(result);
  });

  // PATCH /api/admin/fulfillment/units/:id/ship
  // Transition NEEDS_SHIPPED -> SHIPPED with optional tracking details
  router.patch("/units/:id/ship", async (req, res) => {
    const unitId = Number(req.params.id);
    if (!Number.isInteger(unitId) || unitId <= 0) return res.status(400).json({ error: "Invalid id" });

    const carrier = req.body?.carrier;
    const trackingNumber = req.body?.trackingNumber;

    if (carrier != null && typeof carrier !== "string") return res.status(400).json({ error: "carrier must be a string" });
    if (trackingNumber != null && typeof trackingNumber !== "string")
      return res.status(400).json({ error: "trackingNumber must be a string" });

    const result = await repos.fulfillmentRepo.markShipped({
      unitId,
      carrier: carrier ?? null,
      trackingNumber: trackingNumber ?? null,
    });

    res.json(result);
  });

  return router;
}
