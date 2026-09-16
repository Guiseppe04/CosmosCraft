require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sqlPath = path.join(__dirname, '17_add_pos_void_return.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);

    await client.query('COMMIT');
    console.log('Migration 17 (POS Void/Return) completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 17 failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();