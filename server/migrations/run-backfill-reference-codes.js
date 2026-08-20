require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./config/database');

/**
 * One-time backfill script for appointments created before the reference_code
 * feature was added. Assigns reference codes retroactively based on created_at
 * order within each scheduled_at date group.
 *
 * Format: APT-{YYYYMMDD}-{0001}
 * Sequence resets per scheduled_at date and includes ALL statuses.
 */
async function backfillReferenceCodes() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all appointments without a reference_code, ordered by scheduled_at date and created_at
    const result = await client.query(
      `SELECT appointment_id, scheduled_at, created_at
       FROM appointments
       WHERE reference_code IS NULL
       ORDER BY scheduled_at::date ASC, created_at ASC`
    );

    if (result.rows.length === 0) {
      console.log('No appointments need backfilling.');
      await client.query('COMMIT');
      return;
    }

    console.log(`Found ${result.rows.length} appointments to backfill...`);

    // Group by date and assign sequential numbers
    const dateGroups = new Map();

    for (const apt of result.rows) {
      const date = new Date(apt.scheduled_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}${month}${day}`;

      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, 0);
      }

      const nextSequence = dateGroups.get(dateKey) + 1;
      dateGroups.set(dateKey, nextSequence);

      const referenceCode = `APT-${dateKey}-${String(nextSequence).padStart(4, '0')}`;

      await client.query(
        `UPDATE appointments SET reference_code = $1, updated_at = now() WHERE appointment_id = $2`,
        [referenceCode, apt.appointment_id]
      );

      console.log(`  ✓ ${apt.appointment_id} → ${referenceCode}`);
    }

    await client.query('COMMIT');
    console.log(`Backfill completed successfully! ${result.rows.length} appointments updated.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Backfill failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

backfillReferenceCodes();