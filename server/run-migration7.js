require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create refund_request_counters table (similar to order_number_counters)
    await client.query(`
      CREATE TABLE IF NOT EXISTS refund_request_counters (
        prefix VARCHAR(2) PRIMARY KEY,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        last_number INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ Created refund_request_counters table');

    // Add index for date lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_refund_request_counters_date ON refund_request_counters(date)
    `);
    console.log('✓ Created index on refund_request_counters.date');

    // Seed initial counter row
    await client.query(`
      INSERT INTO refund_request_counters (prefix, date, last_number)
      VALUES ('RF', CURRENT_DATE, 0)
      ON CONFLICT (prefix) DO NOTHING
    `);
    console.log('✓ Seeded refund_request_counters with RF prefix');

    // Add request_number column to refund_requests
    const colRes = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'refund_requests' AND column_name = 'request_number'`
    );
    if (colRes.rows.length === 0) {
      await client.query(`
        ALTER TABLE refund_requests ADD COLUMN request_number VARCHAR(20) UNIQUE
      `);
      console.log('✓ Added request_number column to refund_requests');

      // Backfill existing rows with a generated request_number
      const existing = await client.query(
        `SELECT refund_request_id, created_at FROM refund_requests WHERE request_number IS NULL ORDER BY created_at ASC`
      );
      console.log(`  Backfilling ${existing.rows.length} existing refund request(s)...`);
      let seq = 1;
      for (const row of existing.rows) {
        const date = new Date(row.created_at);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const requestNumber = `RF-${y}${m}${d}-${String(seq).padStart(4, '0')}`;
        await client.query(
          `UPDATE refund_requests SET request_number = $1 WHERE refund_request_id = $2`,
          [requestNumber, row.refund_request_id]
        );
        seq++;
      }
      console.log('  Backfill complete.');
    } else {
      console.log('✓ request_number column already exists');
    }

    // Make request_number NOT NULL after backfill
    await client.query(`
      ALTER TABLE refund_requests ALTER COLUMN request_number SET NOT NULL
    `);
    console.log('✓ Set request_number column to NOT NULL');

    // Add index for lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_refund_requests_request_number ON refund_requests(request_number)
    `);
    console.log('✓ Created index on request_number');

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
