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
  const [doggyDog, elephant, joint, pigArtist] = await knex("items")
    .insert([
      {
        title: "Doggy Dog",
        description: "Adorable crocheted dog plushie.",
        price_cents: 3500,
        quantity_available: 2,
        make_time_minutes: 180,
        is_active: true,
      },
      {
        title: "Elephant",
        description: "Cute crocheted elephant plushie.",
        price_cents: 4000,
        quantity_available: 1,
        make_time_minutes: 200,
        is_active: true,
      },
      {
        title: "Joint",
        description: "Handmade crocheted joint decoration.",
        price_cents: 1500,
        quantity_available: 5,
        make_time_minutes: 60,
        is_active: true,
      },
      {
        title: "Pig Artist",
        description: "Artistic crocheted pig plushie with accessories.",
        price_cents: 4500,
        quantity_available: 1,
        make_time_minutes: 240,
        is_active: true,
      },
    ])
    .returning("*");

  // Insert item images
  await knex("item_images").insert([
    // Doggy Dog
    {
      item_id: doggyDog.id,
      url: "/uploads/doggy_dog_00.jpg",
      sort_order: 0,
      alt_text: "Crocheted dog plushie",
    },
    {
      item_id: doggyDog.id,
      url: "/uploads/doggy_dog_01.jpg",
      sort_order: 1,
      alt_text: "Crocheted dog plushie - view 2",
    },
    {
      item_id: doggyDog.id,
      url: "/uploads/doggy_dog_02.jpg",
      sort_order: 2,
      alt_text: "Crocheted dog plushie - view 3",
    },

    // Elephant
    {
      item_id: elephant.id,
      url: "/uploads/elephant_00.jpg",
      sort_order: 0,
      alt_text: "Crocheted elephant plushie",
    },

    // Joint
    {
      item_id: joint.id,
      url: "/uploads/joint_00.jpg",
      sort_order: 0,
      alt_text: "Crocheted joint decoration",
    },

    // Pig Artist
    {
      item_id: pigArtist.id,
      url: "/uploads/pig_artist_00.jpg",
      sort_order: 0,
      alt_text: "Crocheted pig artist plushie",
    },
    {
      item_id: pigArtist.id,
      url: "/uploads/pig_artist_01.jpg",
      sort_order: 1,
      alt_text: "Crocheted pig artist - view 2",
    },
    {
      item_id: pigArtist.id,
      url: "/uploads/pig_artist_02.jpg",
      sort_order: 2,
      alt_text: "Crocheted pig artist - view 3",
    },
    {
      item_id: pigArtist.id,
      url: "/uploads/pig_artist_03.jpg",
      sort_order: 3,
      alt_text: "Crocheted pig artist - view 4",
    },
    {
      item_id: pigArtist.id,
      url: "/uploads/pig_artist_04.jpg",
      sort_order: 4,
      alt_text: "Crocheted pig artist - view 5",
    },
  ]);
};
