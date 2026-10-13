require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../config/database');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, '47_audit_filter_indexes.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Migration 47 applied: audit filter pagination indexes.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration 47 failed:', error.code || error.name, error.message);
    process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
})();
