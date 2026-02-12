// server/src/db/repos/ordersRepo.ts
//
// Creates an order and expands each line item into 1 row per unit in fulfillment_units.
// Allocation rule:
// - If item.quantity_available > 0, allocate up to that amount as NEEDS_SHIPPED (and decrement stock).
// - Remainder becomes NEEDS_CREATED (no stock decrement).
//
// Postgres + Knex: uses row locks to avoid overselling.

import type { Knex } from "knex";

const DEFAULT_CURRENCY = "USD";

export type FulfillmentStateCode = "NEEDS_CREATED" | "NEEDS_SHIPPED" | "SHIPPED";
export type OrderStatusCode = "RECEIVED" | "COMPLETE";

export type ShippingAddress = Record<string, unknown> | null;

export type CreateOrderInput = {
  email: string;
  shippingAddress?: ShippingAddress;
  items: Array<{ itemId: number; quantity: number }>;
  taxCents?: number;
  shippingCents?: number;
  currency?: string;
};

export type CreateOrderResult = {
  orderId: number;
  totals: {
    subtotalCents: number;
    taxCents: number;
    shippingCents: number;
    totalCents: number;
    currency: string;
  };
  lineItems: Array<{
    id: number;
    itemId: number | null;
    quantity: number;
    unitPriceCents: number;
    title: string;
  }>;
  fulfillment: { needsCreated: number; needsShipped: number };
};

// ---------- DB row/insert types (minimal, but fixes Knex typing errors) ----------

type ItemRow = {
  id: string | number;
  title: string;
  price_cents: string | number;
  currency: string;
  quantity_available: string | number;
  is_active: boolean;
};

type OrdersRow = {
  id: string | number;
  status_code: OrderStatusCode;
  email: string;
  shipping_address: unknown | null;
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  total_cents: number;
  estimated_ready_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
};

type OrdersInsert = Omit<OrdersRow, "id" | "created_at" | "updated_at">;

type OrderLineItemsRow = {
  id: string | number;
  order_id: number;
  item_id: number | null;
  title_snapshot: string;
  unit_price_cents_snapshot: number;
  quantity: number;
};

type OrderLineItemsInsert = Omit<OrderLineItemsRow, "id">;

type InsertedOrderRow = { id: string | number };

type InsertedLineItemRow = Pick<
  OrderLineItemsRow,
  "id" | "item_id" | "quantity" | "unit_price_cents_snapshot" | "title_snapshot"
>;

type FulfillmentUnitsInsert = {
  order_id: number;
  order_line_item_id: number;
  item_id: number;
  state_code: FulfillmentStateCode;
  queued_at: any; // trx.fn.now() is a knex Raw-like value
};

// ---------- Repo ----------

export function makeOrdersRepo(knex: Knex) {
  async function createOrderWithFulfillmentUnits(input: CreateOrderInput): Promise<CreateOrderResult> {
    const currency = input.currency ?? DEFAULT_CURRENCY;
    const taxCents = input.taxCents ?? 0;
    const shippingCents = input.shippingCents ?? 0;

    if (!input.email || typeof input.email !== "string") throw new Error("email is required");
    if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("items must be a non-empty array");

    for (const li of input.items) {
      if (!Number.isInteger(li.itemId) || li.itemId <= 0) throw new Error("Invalid itemId");
      if (!Number.isInteger(li.quantity) || li.quantity <= 0) throw new Error("Invalid quantity");
    }

    return knex.transaction(async (trx) => {
      const itemIds = [...new Set(input.items.map((x) => x.itemId))];

      // Lock item rows to prevent concurrent oversell
      const items = await trx<ItemRow>("items")
        .select(["id", "title", "price_cents", "currency", "quantity_available", "is_active"])
        .whereIn("id", itemIds)
        .forUpdate();

      const itemById = new Map<number, ItemRow>(items.map((it) => [Number(it.id), it]));

      for (const { itemId } of input.items) {
        const it = itemById.get(itemId);
        if (!it) throw new Error(`Item not found: ${itemId}`);
        if (!it.is_active) throw new Error(`Item is not active: ${itemId}`);
      }

      // Compute totals from snapshots
      let subtotalCents = 0;
      const normalizedLines = input.items.map(({ itemId, quantity }) => {
        const it = itemById.get(itemId)!;
        const unitPriceCents = Number(it.price_cents);

        subtotalCents += unitPriceCents * quantity;

        return {
          itemId,
          quantity,
          titleSnapshot: String(it.title),
          unitPriceCentsSnapshot: unitPriceCents,
        };
      });

      const totalCents = subtotalCents + taxCents + shippingCents;

      // Create order
      const [orderRow] = await trx<OrdersRow>("orders")
        .insert<InsertedOrderRow[]>([
          {
            status_code: "RECEIVED",
            email: input.email,
            shipping_address: input.shippingAddress ?? null,
            subtotal_cents: subtotalCents,
            tax_cents: taxCents,
            shipping_cents: shippingCents,
            total_cents: totalCents,
          } satisfies OrdersInsert,
        ])
        .returning(["id"]);

      const orderId = Number(orderRow.id);

      // Create order_line_items
      const lineRowsToInsert: OrderLineItemsInsert[] = normalizedLines.map((l) => ({
        order_id: orderId,
        item_id: l.itemId,
        title_snapshot: l.titleSnapshot,
        unit_price_cents_snapshot: l.unitPriceCentsSnapshot,
        quantity: l.quantity,
      }));

      const insertedLineItems = await trx<OrderLineItemsRow>("order_line_items")
        .insert<InsertedLineItemRow[]>(lineRowsToInsert)
        .returning(["id", "item_id", "quantity", "unit_price_cents_snapshot", "title_snapshot"]);

      // Build fulfillment units (1 per unit)
      const now = trx.fn.now();
      let needsCreated = 0;
      let needsShipped = 0;

      const fulfillmentRows: FulfillmentUnitsInsert[] = [];
      const stockDecrements = new Map<number, number>(); // itemId -> decrement count (stock allocation)

      for (const liRow of insertedLineItems) {
        const lineItemId = Number(liRow.id);
        const itemId = liRow.item_id == null ? null : Number(liRow.item_id);
        const qty = Number(liRow.quantity);

        if (itemId == null) {
          // Should not happen for normal flow; safety guard.
          throw new Error(`Line item ${lineItemId} has no item_id; cannot create fulfillment units.`);
        }

        const item = itemById.get(itemId);
        if (!item) throw new Error(`Item not found while allocating fulfillment: ${itemId}`);

        const available = Number(item.quantity_available);
        const alreadyAllocated = stockDecrements.get(itemId) ?? 0;
        const effectiveAvailable = Math.max(0, available - alreadyAllocated);

        const allocateFromStock = Math.min(effectiveAvailable, qty);
        const remainder = qty - allocateFromStock;

        if (allocateFromStock > 0) stockDecrements.set(itemId, alreadyAllocated + allocateFromStock);

        // Units from stock => NEEDS_SHIPPED
        for (let i = 0; i < allocateFromStock; i += 1) {
          fulfillmentRows.push({
            order_id: orderId,
            order_line_item_id: lineItemId,
            item_id: itemId,
            state_code: "NEEDS_SHIPPED",
            queued_at: now,
          });
        }
        needsShipped += allocateFromStock;

        // Remaining => NEEDS_CREATED
        for (let i = 0; i < remainder; i += 1) {
          fulfillmentRows.push({
            order_id: orderId,
            order_line_item_id: lineItemId,
            item_id: itemId,
            state_code: "NEEDS_CREATED",
            queued_at: now,
          });
        }
        needsCreated += remainder;
      }

      // Apply stock decrements atomically (guard against going negative)
      for (const [itemId, dec] of stockDecrements.entries()) {
        const updatedCount = await trx("items")
          .where({ id: itemId })
          .where("quantity_available", ">=", dec)
          .update({
            quantity_available: trx.raw("quantity_available - ?", [dec]),
            updated_at: now,
          });

        if (updatedCount !== 1) {
          // Should be impossible due to row lock + effectiveAvailable logic, but keep as a hard safety net.
          throw new Error(`Insufficient stock while allocating item ${itemId}`);
        }
      }

      // Insert fulfillment units in chunks
      if (fulfillmentRows.length > 0) {
        const CHUNK = 500;
        for (let i = 0; i < fulfillmentRows.length; i += CHUNK) {
          await trx("fulfillment_units").insert(fulfillmentRows.slice(i, i + CHUNK));
        }
      }

      return {
        orderId,
        totals: {
          subtotalCents,
          taxCents,
          shippingCents,
          totalCents,
          currency,
        },
        lineItems: insertedLineItems.map((r) => ({
          id: Number(r.id),
          itemId: r.item_id == null ? null : Number(r.item_id),
          quantity: Number(r.quantity),
          unitPriceCents: Number(r.unit_price_cents_snapshot),
          title: String(r.title_snapshot),
        })),
        fulfillment: { needsCreated, needsShipped },
      };
    });
  }

  return { createOrderWithFulfillmentUnits };
}

export type OrdersRepo = ReturnType<typeof makeOrdersRepo>;
