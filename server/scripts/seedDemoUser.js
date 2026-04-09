require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const DEMO_EMAIL = 'demo@cosmoscraft.com';
const DEMO_PASSWORD = 'demo123';
const DEMO_FIRST = 'Demo';
const DEMO_LAST = 'User';

async function seed() {
  const client = await pool.connect();
  try {
    const exists = await client.query(
      'SELECT user_id FROM users WHERE email = $1',
      [DEMO_EMAIL]
    );
    if (exists.rows.length > 0) {
      console.log('Demo user already exists:', DEMO_EMAIL);
      return;
    }

    const hash = await bcrypt.hash(DEMO_PASSWORD, 12);

    const res = await client.query(
      `INSERT INTO users
         (email, password_hash, first_name, last_name, role, is_verified, is_active)
       VALUES ($1, $2, $3, $4, 'customer', true, true)
       RETURNING user_id, email, role`,
      [DEMO_EMAIL, hash, DEMO_FIRST, DEMO_LAST]
    );

    const user = res.rows[0];
    console.log('Demo user created!');
    console.log('  Email:', DEMO_EMAIL);
    console.log('  Password:', DEMO_PASSWORD);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();