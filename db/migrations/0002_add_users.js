/**
 * 0002_add_users.js
 * Add users table for admin authentication
 */

/**
 * @param {import("knex").Knex} knex
 */
exports.up = async function up(knex) {
  // UUID generation (pgcrypto provides gen_random_uuid())
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // USERS table for admin authentication
  await knex.raw(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX users_email_idx ON users (email);
    CREATE INDEX users_created_at_idx ON users (created_at);
  `);
};

/**
 * @param {import("knex").Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("users");
};
