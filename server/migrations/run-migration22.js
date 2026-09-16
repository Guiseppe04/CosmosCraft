const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running migration 22...');
    const sql = fs.readFileSync(path.join(__dirname, '22_add_project_cancel_fulfillment.sql'), 'utf8');
    await client.query(sql);
    console.log('Migration 22 applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
