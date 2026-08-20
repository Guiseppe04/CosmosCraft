require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add reference_code column to appointments table
    await client.query(
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reference_code VARCHAR(20)`
    );
    console.log('✓ Added reference_code column to appointments');

    // Add unique constraint as a safeguard against race conditions
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_reference_code ON appointments(reference_code)`
    );
    console.log('✓ Added unique index on reference_code');

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();