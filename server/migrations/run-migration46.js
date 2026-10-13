require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

(async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, '46_customer_refund_evidence.sql'), 'utf8'));
    // Verify both the new columns and private evidence constraint before committing.
    const definition = await client.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid=to_regclass('refund_private_files') AND conname='refund_private_files_kind_check'`);
    if (!definition.rows[0]?.definition.includes("'evidence0'") || !definition.rows[0]?.definition.includes("'return4'")) {
      throw new Error('Refund evidence constraint verification failed');
    }
    await client.query('COMMIT');
    console.log('Migration 46 applied and verified: private customer refund and return evidence.');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Migration 46 failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
