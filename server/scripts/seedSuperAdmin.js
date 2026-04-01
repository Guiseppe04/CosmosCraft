/**
 * Super Admin Seeder
 * Run once: node server/scripts/seedSuperAdmin.js
 *
 * Creates a super_admin user with a hashed password.
 * Customize SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD below before running.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SUPER_ADMIN_EMAIL    = 'superadmin@cosmoscraft.com';
const SUPER_ADMIN_PASSWORD = 'CosmosAdmin@2025!';
const SUPER_ADMIN_FIRST    = 'Cosmos';
const SUPER_ADMIN_LAST     = 'Admin';

async function seed() {
  const client = await pool.connect();
  try {
    // Check if already exists
    const exists = await client.query(
      'SELECT user_id FROM users WHERE email = $1',
      [SUPER_ADMIN_EMAIL]
    );
    if (exists.rows.length > 0) {
      console.log('✅  Super admin already exists:', SUPER_ADMIN_EMAIL);
      return;
    }

    const hash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

    const res = await client.query(
      `INSERT INTO users
         (email, password_hash, first_name, last_name, role, is_verified, is_active)
       VALUES ($1, $2, $3, $4, 'super_admin', true, true)
       RETURNING user_id, email, role`,
      [SUPER_ADMIN_EMAIL, hash, SUPER_ADMIN_FIRST, SUPER_ADMIN_LAST]
    );

    const admin = res.rows[0];
    console.log('🚀  Super admin created!');
    console.log('    ID   :', admin.user_id);
    console.log('    Email:', admin.email);
    console.log('    Role :', admin.role);
    console.log('    Pass :', SUPER_ADMIN_PASSWORD);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
