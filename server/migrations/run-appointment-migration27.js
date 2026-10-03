require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
async function run() {
  let client;
  try {
    client = await pool.connect();
    const sql = fs.readFileSync(path.join(__dirname, '27_appointment_refunds_rescheduling.sql'), 'utf8');
    const split = sql.indexOf(';') + 1;
    // Commit the enum addition separately so subsequent transactions can use it.
    await client.query(sql.slice(0, split));
    await client.query('BEGIN');
    await client.query(sql.slice(split));
    const result = await client.query(`SELECT
      EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='appointment_status_enum' AND e.enumlabel='rescheduled_by_customer') AS status_ready,
      to_regclass('appointment_refunds') IS NOT NULL AS refunds_ready,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='rescheduled_from') AS history_ready,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='approved_payment_amount') AS amount_ready,
      to_regclass('appointments_one_successor') IS NOT NULL AS uniqueness_ready`);
    if (!Object.values(result.rows[0]).every(Boolean)) throw new Error('Schema verification failed');
    await client.query('COMMIT');
    console.log('Appointment migration 27 applied and verified:', result.rows[0]);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Appointment migration 27 failed:', error.code || error.name);
    process.exitCode = 1;
  } finally { if (client) client.release(); await pool.end(); }
}
run();
