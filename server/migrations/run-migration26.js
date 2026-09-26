require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running Migration 26: Partial unique index for normal cart products...');
    const sqlPath = path.join(__dirname, '26_cart_normal_product_unique_index.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('Migration 26 completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 26 failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
