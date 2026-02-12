/**
 * 0001_init.js
 * Initial schema for Crochet Inventory Store (PERN) per design doc v6.
 *
 * Tables:
 * - fulfillment_states (lookup)
 * - order_statuses (lookup)
 * - items
 * - item_images
 * - orders
 * - order_line_items
 * - fulfillment_units
 * - custom_requests
 *
 * Notes:
 * - Monetary values stored as integer cents.
 * - Order.status_code is stored but treated as derived in app logic.
 */

/**
 * @param {import("knex").Knex} knex
 */
exports.up = async function up(knex) {
  // Helpful in case you want to wrap everything atomically.
  await knex.transaction(async (trx) => {
    // 1) Lookup tables first
    await trx.schema.createTable("fulfillment_states", (t) => {
      t.text("code").primary(); // NEEDS_CREATED, NEEDS_SHIPPED, SHIPPED
      t.text("description").notNullable();
      t.integer("sort_order").notNullable();
      t.boolean("is_terminal").notNullable().defaultTo(false);
    });

    await trx.schema.createTable("order_statuses", (t) => {
      t.text("code").primary(); // RECEIVED, COMPLETE
      t.text("description").notNullable();
      t.integer("sort_order").notNullable();
      t.boolean("is_terminal").notNullable().defaultTo(false);
    });

    // Seed lookup rows (idempotent-ish via onConflict)
    await trx("fulfillment_states")
      .insert([
        {
          code: "NEEDS_CREATED",
          description: "Unit must be produced",
          sort_order: 1,
          is_terminal: false,
        },
        {
          code: "NEEDS_SHIPPED",
          description: "Unit ready for shipment",
          sort_order: 2,
          is_terminal: false,
        },
        { code: "SHIPPED", description: "Unit has shipped", sort_order: 3, is_terminal: true },
      ])
      .onConflict("code")
      .ignore();

    await trx("order_statuses")
      .insert([
        { code: "RECEIVED", description: "Payment confirmed", sort_order: 1, is_terminal: false },
        { code: "COMPLETE", description: "All units shipped", sort_order: 2, is_terminal: true },
      ])
      .onConflict("code")
      .ignore();

    // 2) Core tables
    await trx.schema.createTable("items", (t) => {
      t.bigIncrements("id").primary(); // BIGSERIAL
      t.text("title").notNullable();
      t.text("description");
      t.integer("price_cents").notNullable(); // stored in cents
      t.text("currency").notNullable().defaultTo("USD");
      t.integer("quantity_available").notNullable().defaultTo(0); // finished units in stock
      t.integer("make_time_minutes"); // optional production estimate
      t.boolean("is_active").notNullable().defaultTo(true);

      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(trx.fn.now());
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(trx.fn.now());

      t.index(["is_active"]);
    });

    await trx.schema.createTable("item_images", (t) => {
      t.bigIncrements("id").primary();
      t
        .bigInteger("item_id")
        .notNullable()
        .references("id")
        .inTable("items")
        .onDelete("CASCADE");

      t.text("url").notNullable();
      t.integer("sort_order");
      t.text("alt_text");

      t.index(["item_id"]);
      t.index(["item_id", "sort_order"]);
    });

    await trx.schema.createTable("orders", (t) => {
      t.bigIncrements("id").primary();
      t
        .text("status_code")
        .notNullable()
        .references("code")
        .inTable("order_statuses")
        .onUpdate("RESTRICT")
        .onDelete("RESTRICT")
        .defaultTo("RECEIVED");

      t.text("email").notNullable();
      t.jsonb("shipping_address");

      t.integer("subtotal_cents").notNullable();
      t.integer("tax_cents").notNullable();
      t.integer("shipping_cents").notNullable();
      t.integer("total_cents").notNullable();

      t.timestamp("estimated_ready_at", { useTz: true }); // optional ETA

      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(trx.fn.now());
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(trx.fn.now());

      t.index(["status_code"]);
      t.index(["email"]);
      t.index(["created_at"]);
    });

    await trx.schema.createTable("order_line_items", (t) => {
      t.bigIncrements("id").primary();

      t
        .bigInteger("order_id")
        .notNullable()
        .references("id")
        .inTable("orders")
        .onDelete("CASCADE");

      // Nullable if item removed later
      t
        .bigInteger("item_id")
        .nullable()
        .references("id")
        .inTable("items")
        .onDelete("SET NULL");

      t.text("title_snapshot").notNullable();
      t.integer("unit_price_cents_snapshot").notNullable();
      t.integer("quantity").notNullable();

      t.index(["order_id"]);
      t.index(["item_id"]);
    });

    await trx.schema.createTable("fulfillment_units", (t) => {
      t.bigIncrements("id").primary();

      t
        .bigInteger("order_id")
        .notNullable()
        .references("id")
        .inTable("orders")
        .onDelete("CASCADE");

      t
        .bigInteger("order_line_item_id")
        .notNullable()
        .references("id")
        .inTable("order_line_items")
        .onDelete("CASCADE");

      t
        .bigInteger("item_id")
        .notNullable()
        .references("id")
        .inTable("items")
        .onDelete("RESTRICT");

      t
        .text("state_code")
        .notNullable()
        .references("code")
        .inTable("fulfillment_states")
        .onUpdate("RESTRICT")
        .onDelete("RESTRICT")
        .defaultTo("NEEDS_CREATED");

      t.timestamp("queued_at", { useTz: true }).notNullable().defaultTo(trx.fn.now()); // FIFO ordering
      t.timestamp("shipped_at", { useTz: true });

      t.text("carrier");
      t.text("tracking_number");

      t.index(["order_id"]);
      t.index(["order_line_item_id"]);
      t.index(["item_id"]);
      t.index(["state_code"]);
      t.index(["queued_at"]);
      t.index(["state_code", "queued_at"]);
    });

    await trx.schema.createTable("custom_requests", (t) => {
      t.bigIncrements("id").primary();

      // Separate workflow (kept simple and flexible here)
      t.text("status").notNullable();
      t.text("email").notNullable();
      t.text("request_text").notNullable();
      t.integer("budget_cents");
      t.date("deadline_date");
      t.text("admin_notes");

      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(trx.fn.now());

      t.index(["status"]);
      t.index(["email"]);
      t.index(["created_at"]);
    });
  });
};

/**
 * @param {import("knex").Knex} knex
 */
exports.down = async function down(knex) {
  await knex.transaction(async (trx) => {
    // Drop in reverse dependency order
    await trx.schema.dropTableIfExists("custom_requests");
    await trx.schema.dropTableIfExists("fulfillment_units");
    await trx.schema.dropTableIfExists("order_line_items");
    await trx.schema.dropTableIfExists("orders");
    await trx.schema.dropTableIfExists("item_images");
    await trx.schema.dropTableIfExists("items");
    await trx.schema.dropTableIfExists("order_statuses");
    await trx.schema.dropTableIfExists("fulfillment_states");
  });
};
