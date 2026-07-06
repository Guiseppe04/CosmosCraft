/**
 * Admin and Super Admin Seeder
 * Run once: node server/scripts/seedSuperAdmin.js
 *
 * Creates a super_admin and an admin account with RBAC-based permissions.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const isHostedDatabase = (url = '') => /render\.com|neon\.tech|supabase|railway\.app|amazonaws\.com/i.test(url);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isHostedDatabase(process.env.DATABASE_URL || '') ? { rejectUnauthorized: false } : false,
});

const ACCOUNTS = [
  {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@cosmoscraft.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'CosmosAdmin@2025!',
    firstName: process.env.SUPER_ADMIN_FIRST || 'Cosmos',
    lastName: process.env.SUPER_ADMIN_LAST || 'Admin',
    roleName: 'super_admin',
  },
  {
    email: process.env.ADMIN_EMAIL || 'admin@cosmoscraft.com',
    password: process.env.ADMIN_PASSWORD || 'CosmosAdmin@2025!',
    firstName: process.env.ADMIN_FIRST || 'Cosmos',
    lastName: process.env.ADMIN_LAST || 'Manager',
    roleName: 'admin',
  },
];

async function ensureAccount(client, account) {
  const hash = await bcrypt.hash(account.password, 12);
  const userRes = await client.query(
    `INSERT INTO users
       (email, password_hash, first_name, last_name, role, is_verified, is_active)
     VALUES ($1, $2, $3, $4, $5, true, true)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       role = EXCLUDED.role,
       is_verified = true,
       is_active = true
     RETURNING user_id, email, role`,
    [account.email, hash, account.firstName, account.lastName, account.roleName]
  );

  const user = userRes.rows[0];
  const roleRes = await client.query('SELECT role_id FROM roles WHERE LOWER(name) = LOWER($1)', [account.roleName]);
  if (roleRes.rows.length === 0) {
    throw new Error(`RBAC role not found: ${account.roleName}`);
  }

  await client.query(
    `INSERT INTO user_roles (user_id, role_id, assigned_by, is_active)
     VALUES ($1, $2, $1, true)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [user.user_id, roleRes.rows[0].role_id]
  );

  return user;
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const account of ACCOUNTS) {
      const user = await ensureAccount(client, account);
      console.log('✅ Account ready');
      console.log('   Email:', user.email);
      console.log('   Role :', account.roleName);
      console.log('   Pass :', account.password);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
