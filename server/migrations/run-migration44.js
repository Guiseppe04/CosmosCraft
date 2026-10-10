require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
(async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, '44_terms_acknowledgments.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Migration 44 applied: versioned Terms and Conditions acknowledgments.');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Migration 44 failed:', error.code || error.name);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
})();
