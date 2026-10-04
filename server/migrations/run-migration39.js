require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function run() {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, '39_appointment_refund_qr_destination.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Migration 39 applied: appointment refund QR destinations.');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Migration 39 failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
run();
