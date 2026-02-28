import type { Knex } from "knex";
import type { FulfillmentStateCode, OrderStatusCode } from "./ordersRepo";

export type FulfillmentQueueRow = {
  unitId: number;
  stateCode: FulfillmentStateCode;
  queuedAt: string;
  shippedAt: string | null;

  itemId: number;
  itemTitle: string;

  orderId: number;
  orderEmail: string;
  shippingAddress: unknown | null;

  lineItemId: number;
  lineItemTitleSnapshot: string;
};

export type AdminFulfillmentOrderSummary = {
  orderId: number;
  orderStatus: OrderStatusCode;
  orderEmail: string;
  shippingAddress: unknown | null;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  totalUnits: number;
  needsCreatedUnits: number;
  needsShippedUnits: number;
  shippedUnits: number;
};

export type GetOrderSummariesOptions = {
  status?: OrderStatusCode;
  orderId?: number;
  emailQuery?: string;
  limit?: number;
  offset?: number;
};

export type AdminFulfillmentUnitDetail = {
  unitId: number;
  stateCode: FulfillmentStateCode;
  queuedAt: string;
  shippedAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  itemId: number;
  itemTitle: string;
  lineItemId: number;
  lineItemTitleSnapshot: string;
};

export type AdminOrderLineItemDetail = {
  lineItemId: number;
  itemId: number | null;
  titleSnapshot: string;
  unitPriceCentsSnapshot: number;
  quantity: number;
  units: AdminFulfillmentUnitDetail[];
};

export type AdminFulfillmentOrderDetail = {
  order: AdminFulfillmentOrderSummary;
  lineItems: AdminOrderLineItemDetail[];
};

export type GetQueueOptions = {
  state: FulfillmentStateCode;
  limit?: number;
  offset?: number;
};

export type MarkCreatedDoneInput = {
  unitId: number;
};

export type MarkShippedInput = {
  unitId: number;
  carrier?: string | null;
  trackingNumber?: string | null;
};

type OrderSummaryRow = {
  order_id: string | number;
  status_code: OrderStatusCode;
  order_email: string;
  shipping_address: unknown | null;
  subtotal_cents: string | number;
  tax_cents: string | number;
  shipping_cents: string | number;
  total_cents: string | number;
  created_at: string;
  updated_at: string;
  total_units: string | number;
  needs_created_units: string | number;
  needs_shipped_units: string | number;
  shipped_units: string | number;
};

type OrderLineItemDetailRow = {
  line_item_id: string | number;
  item_id: string | number | null;
  title_snapshot: string;
  unit_price_cents_snapshot: string | number;
  quantity: string | number;
};

type FulfillmentUnitDetailRow = {
  unit_id: string | number;
  state_code: FulfillmentStateCode;
  queued_at: string;
  shipped_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  item_id: string | number;
  item_title: string;
  line_item_id: string | number;
  line_item_title_snapshot: string;
};

type FulfillmentUnitRow = {
  id: string | number;
  order_id: string | number;
  order_line_item_id: string | number;
  item_id: string | number;
  state_code: FulfillmentStateCode;
  queued_at: string;
  shipped_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
};

type OrdersRow = {
  id: string | number;
  status_code: OrderStatusCode;
  updated_at: unknown; // timestamp (we don’t need to fully type it)
};

type OrdersUpdate = Partial<Pick<OrdersRow, "status_code" | "updated_at">>;

export function makeFulfillmentRepo(knex: Knex) {
  function mapOrderSummaryRow(r: OrderSummaryRow): AdminFulfillmentOrderSummary {
    return {
      orderId: Number(r.order_id),
      orderStatus: r.status_code,
      orderEmail: String(r.order_email),
      shippingAddress: r.shipping_address ?? null,
      subtotalCents: Number(r.subtotal_cents),
      taxCents: Number(r.tax_cents),
      shippingCents: Number(r.shipping_cents),
      totalCents: Number(r.total_cents),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      totalUnits: Number(r.total_units),
      needsCreatedUnits: Number(r.needs_created_units),
      needsShippedUnits: Number(r.needs_shipped_units),
      shippedUnits: Number(r.shipped_units),
    };
  }

  async function getOrderSummaries(opts: GetOrderSummariesOptions = {}): Promise<AdminFulfillmentOrderSummary[]> {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const offset = Math.max(opts.offset ?? 0, 0);

    const q = knex("orders as o")
      .leftJoin("fulfillment_units as fu", "fu.order_id", "o.id")
      .select<OrderSummaryRow[]>([
        "o.id as order_id",
        "o.status_code as status_code",
        "o.email as order_email",
        "o.shipping_address as shipping_address",
        "o.subtotal_cents as subtotal_cents",
        "o.tax_cents as tax_cents",
        "o.shipping_cents as shipping_cents",
        "o.total_cents as total_cents",
        "o.created_at as created_at",
        "o.updated_at as updated_at",
        knex.raw("COUNT(fu.id)::int as total_units"),
        knex.raw("SUM(CASE WHEN fu.state_code = 'NEEDS_CREATED' THEN 1 ELSE 0 END)::int as needs_created_units"),
        knex.raw("SUM(CASE WHEN fu.state_code = 'NEEDS_SHIPPED' THEN 1 ELSE 0 END)::int as needs_shipped_units"),
        knex.raw("SUM(CASE WHEN fu.state_code = 'SHIPPED' THEN 1 ELSE 0 END)::int as shipped_units"),
      ])
      .groupBy([
        "o.id",
        "o.status_code",
        "o.email",
        "o.shipping_address",
        "o.subtotal_cents",
        "o.tax_cents",
        "o.shipping_cents",
        "o.total_cents",
        "o.created_at",
        "o.updated_at",
      ])
      .orderBy([{ column: "o.created_at", order: "desc" }, { column: "o.id", order: "desc" }])
      .limit(limit)
      .offset(offset);

    if (opts.status) q.where("o.status_code", opts.status);
    if (opts.orderId != null) q.where("o.id", opts.orderId);
    if (opts.emailQuery) q.whereILike("o.email", `%${opts.emailQuery}%`);

    const rows = await q;
    return rows.map(mapOrderSummaryRow);
  }

  async function getOrderDetail(orderId: number): Promise<AdminFulfillmentOrderDetail | null> {
    if (!Number.isInteger(orderId) || orderId <= 0) throw new Error("Invalid orderId");

    const summaryRows = await getOrderSummaries({ orderId, limit: 1, offset: 0 });
    const order = summaryRows[0];
    if (!order) return null;

    const lineItemRows = await knex("order_line_items as oli")
      .select<OrderLineItemDetailRow[]>([
        "oli.id as line_item_id",
        "oli.item_id as item_id",
        "oli.title_snapshot as title_snapshot",
        "oli.unit_price_cents_snapshot as unit_price_cents_snapshot",
        "oli.quantity as quantity",
      ])
      .where("oli.order_id", orderId)
      .orderBy("oli.id", "asc");

    const unitRows = await knex("fulfillment_units as fu")
      .join("items as i", "i.id", "fu.item_id")
      .join("order_line_items as oli", "oli.id", "fu.order_line_item_id")
      .select<FulfillmentUnitDetailRow[]>([
        "fu.id as unit_id",
        "fu.state_code as state_code",
        "fu.queued_at as queued_at",
        "fu.shipped_at as shipped_at",
        "fu.carrier as carrier",
        "fu.tracking_number as tracking_number",
        "i.id as item_id",
        "i.title as item_title",
        "oli.id as line_item_id",
        "oli.title_snapshot as line_item_title_snapshot",
      ])
      .where("fu.order_id", orderId)
      .orderBy([
        { column: "oli.id", order: "asc" },
        { column: "fu.queued_at", order: "asc" },
        { column: "fu.id", order: "asc" },
      ]);

    const unitsByLineItemId = new Map<number, AdminFulfillmentUnitDetail[]>();
    for (const row of unitRows) {
      const lineItemId = Number(row.line_item_id);
      const list = unitsByLineItemId.get(lineItemId) ?? [];
      list.push({
        unitId: Number(row.unit_id),
        stateCode: row.state_code,
        queuedAt: String(row.queued_at),
        shippedAt: row.shipped_at == null ? null : String(row.shipped_at),
        carrier: row.carrier ?? null,
        trackingNumber: row.tracking_number ?? null,
        itemId: Number(row.item_id),
        itemTitle: String(row.item_title),
        lineItemId,
        lineItemTitleSnapshot: String(row.line_item_title_snapshot),
      });
      unitsByLineItemId.set(lineItemId, list);
    }

    const lineItems: AdminOrderLineItemDetail[] = lineItemRows.map((row) => {
      const lineItemId = Number(row.line_item_id);
      return {
        lineItemId,
        itemId: row.item_id == null ? null : Number(row.item_id),
        titleSnapshot: String(row.title_snapshot),
        unitPriceCentsSnapshot: Number(row.unit_price_cents_snapshot),
        quantity: Number(row.quantity),
        units: unitsByLineItemId.get(lineItemId) ?? [],
      };
    });

    return { order, lineItems };
  }

  async function getQueue(opts: GetQueueOptions): Promise<FulfillmentQueueRow[]> {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const offset = Math.max(opts.offset ?? 0, 0);

    // FIFO by queued_at then id for stability
    const rows = await knex("fulfillment_units as fu")
      .select([
        "fu.id as unit_id",
        "fu.state_code as state_code",
        "fu.queued_at as queued_at",
        "fu.shipped_at as shipped_at",

        "i.id as item_id",
        "i.title as item_title",

        "o.id as order_id",
        "o.email as order_email",
        "o.shipping_address as shipping_address",

        "oli.id as line_item_id",
        "oli.title_snapshot as line_item_title_snapshot",
      ])
      .join("items as i", "i.id", "fu.item_id")
      .join("orders as o", "o.id", "fu.order_id")
      .join("order_line_items as oli", "oli.id", "fu.order_line_item_id")
      .where("fu.state_code", opts.state)
      .orderBy([{ column: "fu.queued_at", order: "asc" }, { column: "fu.id", order: "asc" }])
      .limit(limit)
      .offset(offset);

    return rows.map((r: any) => ({
      unitId: Number(r.unit_id),
      stateCode: r.state_code as FulfillmentStateCode,
      queuedAt: String(r.queued_at),
      shippedAt: r.shipped_at == null ? null : String(r.shipped_at),

      itemId: Number(r.item_id),
      itemTitle: String(r.item_title),

      orderId: Number(r.order_id),
      orderEmail: String(r.order_email),
      shippingAddress: r.shipping_address ?? null,

      lineItemId: Number(r.line_item_id),
      lineItemTitleSnapshot: String(r.line_item_title_snapshot),
    }));
  }

  /**
   * Transition: NEEDS_CREATED -> NEEDS_SHIPPED
   * (represents "item has been created and is now ready to ship")
   */
  async function markCreatedDone(input: MarkCreatedDoneInput): Promise<{ unitId: number; newState: FulfillmentStateCode }> {
    if (!Number.isInteger(input.unitId) || input.unitId <= 0) throw new Error("Invalid unitId");

    return knex.transaction(async (trx) => {
      const unit = await trx<FulfillmentUnitRow>("fulfillment_units").where({ id: input.unitId }).forUpdate().first();
      if (!unit) throw new Error("Unit not found");
      if (unit.state_code !== "NEEDS_CREATED") throw new Error(`Invalid transition from ${unit.state_code}`);

      await trx("fulfillment_units")
        .where({ id: input.unitId })
        .update({
          state_code: "NEEDS_SHIPPED" satisfies FulfillmentStateCode,
        });

      return { unitId: input.unitId, newState: "NEEDS_SHIPPED" };
    });
  }

  /**
   * Transition: NEEDS_SHIPPED -> SHIPPED
   * Sets shipped_at and optional carrier/tracking.
   * Also updates the parent order to COMPLETE when all units for that order are shipped.
   */
  async function markShipped(input: MarkShippedInput): Promise<{
    unitId: number;
    newState: FulfillmentStateCode;
    orderId: number;
    orderStatus: OrderStatusCode;
  }> {
    if (!Number.isInteger(input.unitId) || input.unitId <= 0) throw new Error("Invalid unitId");

    return knex.transaction(async (trx) => {
      const unit = await trx<FulfillmentUnitRow>("fulfillment_units").where({ id: input.unitId }).forUpdate().first();
      if (!unit) throw new Error("Unit not found");
      if (unit.state_code !== "NEEDS_SHIPPED") throw new Error(`Invalid transition from ${unit.state_code}`);

      const now = trx.fn.now();

      await trx("fulfillment_units")
        .where({ id: input.unitId })
        .update({
          state_code: "SHIPPED" satisfies FulfillmentStateCode,
          shipped_at: now,
          carrier: input.carrier ?? unit.carrier ?? null,
          tracking_number: input.trackingNumber ?? unit.tracking_number ?? null,
        });

      const orderId = Number(unit.order_id);

      // If all units are shipped => COMPLETE
        const countRow = await trx("fulfillment_units")
            .where({ order_id: orderId })
            .andWhereNot({ state_code: "SHIPPED" })
            .count<{ unshipped_count: string }>("id as unshipped_count")
            .first();

        const unshippedCount = Number(countRow?.unshipped_count ?? "0");
        const allShipped = unshippedCount === 0;


      if (allShipped) {
        await trx<OrdersRow>("orders").where({ id: orderId }).update({
            status_code: "COMPLETE" satisfies OrderStatusCode,
            updated_at: now,
        } satisfies OrdersUpdate);
      } else {
        await trx<OrdersRow>("orders").where({ id: orderId }).update({
            updated_at: now,
        } satisfies OrdersUpdate);
      }

      const updatedOrder = await trx<OrdersRow>("orders").select(["id", "status_code"]).where({ id: orderId }).first();
      const orderStatus = (updatedOrder?.status_code ?? "RECEIVED") as OrderStatusCode;

      return { unitId: input.unitId, newState: "SHIPPED", orderId, orderStatus };
    });
  }

  return { getQueue, getOrderSummaries, getOrderDetail, markCreatedDone, markShipped };
}

export type FulfillmentRepo = ReturnType<typeof makeFulfillmentRepo>;
