require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

(async () => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(fs.readFileSync(path.join(__dirname, '52_oauth_transactions.sql'), 'utf8'));
    await db.query('COMMIT');
    console.log('Migration 52 applied: old callback results invalidated; browser transactions enabled.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Migration 52 failed:', error.code || error.name);
    process.exitCode = 1;
  } finally {
    db.release();
    await pool.end();
  }
})().catch(error => { console.error('Migration 52 connection failed:', error.code || error.name); process.exitCode = 1; });
