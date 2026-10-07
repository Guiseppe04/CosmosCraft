require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, '42_order_refund_workflow.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Migration 42 applied: private refund destinations, evidence, and workflow.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 42 failed:', error.message);
    process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
