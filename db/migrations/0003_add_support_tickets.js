/**
 * @param {import("knex").Knex} knex
 */
exports.up = async function up(knex) {
  // Ticket statuses lookup table
  await knex.schema.createTable("ticket_statuses", (t) => {
    t.string("code", 32).primary();
    t.string("label", 64).notNullable();
    t.integer("sort_order").notNullable().defaultTo(0);
  });

  await knex("ticket_statuses").insert([
    { code: "NEW", label: "New", sort_order: 1 },
    { code: "IN_PROGRESS", label: "In Progress", sort_order: 2 },
    { code: "RESOLVED", label: "Resolved", sort_order: 3 },
    { code: "CLOSED", label: "Closed", sort_order: 4 },
  ]);

  // Support tickets table
  await knex.schema.createTable("support_tickets", (t) => {
    t.increments("id").primary();
    t.string("email", 255).notNullable();
    t.string("subject", 255).notNullable();
    t.text("message").notNullable();
    t.string("status_code", 32).notNullable().defaultTo("NEW");
    t.text("admin_notes").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("status_code").references("ticket_statuses.code");
    t.index(["status_code"]);
    t.index(["created_at"]);
  });
};

/**
 * @param {import("knex").Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("support_tickets");
  await knex.schema.dropTableIfExists("ticket_statuses");
};
