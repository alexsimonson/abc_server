/**
 * 001_initial_data.js
 *
 * Seeds minimal but useful initial data:
 * - Items
 * - Item images
 *
 * Lookup tables (fulfillment_states, order_statuses) are already
 * seeded in the migration itself.
 */

/**
 * @param {import("knex").Knex} knex
 */
exports.seed = async function seed(knex) {
  // Clear in dependency-safe order
  await knex("item_images").del();
  await knex("items").del();

  // Insert items
  const [hat, blanket, plush] = await knex("items")
    .insert([
      {
        title: "Crocheted Beanie",
        description: "Handmade crocheted beanie. Soft, warm, and cozy.",
        price_cents: 2500,
        quantity_available: 3,
        make_time_minutes: 90,
        is_active: true,
      },
      {
        title: "Baby Blanket",
        description: "Crocheted baby blanket made with hypoallergenic yarn.",
        price_cents: 6000,
        quantity_available: 1,
        make_time_minutes: 480,
        is_active: true,
      },
      {
        title: "Plush Octopus",
        description: "Cute crocheted octopus plushie.",
        price_cents: 3500,
        quantity_available: 0, // forces fulfillment_units into NEEDS_CREATED later
        make_time_minutes: 180,
        is_active: true,
      },
    ])
    .returning("*");

  // Insert item images
  await knex("item_images").insert([
    // Beanie
    {
      item_id: hat.id,
      url: "https://placehold.co/600x600?text=Beanie+Front",
      sort_order: 1,
      alt_text: "Crocheted beanie front view",
    },
    {
      item_id: hat.id,
      url: "https://placehold.co/600x600?text=Beanie+Side",
      sort_order: 2,
      alt_text: "Crocheted beanie side view",
    },

    // Blanket
    {
      item_id: blanket.id,
      url: "https://placehold.co/600x600?text=Blanket",
      sort_order: 1,
      alt_text: "Crocheted baby blanket",
    },

    // Plush
    {
      item_id: plush.id,
      url: "https://placehold.co/600x600?text=Octopus",
      sort_order: 1,
      alt_text: "Crocheted octopus plush",
    },
  ]);
};
