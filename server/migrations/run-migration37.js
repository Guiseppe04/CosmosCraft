require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, '37_sync_hosting_db_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Running Migration 37: Sync Hosting Database Schema...');
    
    // Execute the migration script
    await client.query(sql);

    console.log('Migration 37 completed successfully.');
  } catch (error) {
    console.error('Migration 37 failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
