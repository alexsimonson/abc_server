/**
 * 0002_add_admin_user.js
 * Seed default admin user for testing
 * 
 * Default credentials:
 * Email: admin@abc.com
 * Password: admin123
 */

const bcrypt = require("bcryptjs");

/**
 * @param {import("knex").Knex} knex
 */
exports.seed = async function seed(knex) {
  // Create default admin user
  const passwordHash = await bcrypt.hash("admin123", 10);
  
  await knex("users")
    .insert([
      {
        email: "admin@abc.com",
        username: "admin",
        password_hash: passwordHash,
        display_name: "Admin User",
        is_admin: true,
      },
    ])
    .onConflict("email")
    .ignore();
};
