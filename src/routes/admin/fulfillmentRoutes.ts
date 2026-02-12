import { Router } from "express";
import type { Repos } from "../../db/repos";
import type { FulfillmentStateCode } from "../../db/repos/ordersRepo";

function isFulfillmentStateCode(x: unknown): x is FulfillmentStateCode {
  return x === "NEEDS_CREATED" || x === "NEEDS_SHIPPED" || x === "SHIPPED";
}

export function makeAdminFulfillmentRoutes(repos: Repos) {
  const router = Router();

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
