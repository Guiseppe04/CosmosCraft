require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running Migration 24: Ratings & Customization Feedback...');
    const sqlPath = path.join(__dirname, '24_add_ratings_and_feedback.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('Migration 24 completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 24 failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
