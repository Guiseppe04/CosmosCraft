require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

(async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, '48_admin_refund_usability.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Migration 48 applied: private internal refund notes.');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Migration 48 failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
