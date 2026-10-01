require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, '28_flatten_categories.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration 28 completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 28 failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();