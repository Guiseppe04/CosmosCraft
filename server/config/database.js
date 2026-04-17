const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runStartupMigrations(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  await client.query(`
    CREATE TABLE IF NOT EXISTS unavailable_dates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL UNIQUE,
      reason VARCHAR(255),
      is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
      created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_unavailable_dates_date
    ON unavailable_dates(date);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_unavailable_dates_created_by
    ON unavailable_dates(created_by);
  `);

  await client.query(`
    ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(100),
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50) DEFAULT 'service_in_shop',
    ADD COLUMN IF NOT EXISTS order_id UUID,
    ADD COLUMN IF NOT EXISTS confirmation_notes TEXT,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
  `);

  await client.query(`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS fulfillment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS fulfillment_notes TEXT,
    ADD COLUMN IF NOT EXISTS fulfillment_selected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pickup_appointment_id UUID;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_services_gin
    ON appointments USING GIN (services);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_payment_status
    ON appointments(payment_status);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_appointment_type
    ON appointments(appointment_type);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_order_id
    ON appointments(order_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_projects_fulfillment_method
    ON projects(fulfillment_method);
  `);
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const connectDB = async () => {
  let client;
  try {
    client = await pool.connect();
    await runStartupMigrations(client);
    console.log(`PostgreSQL connected: ${client.host || 'local'}`);
    return pool;
  } catch (error) {
    console.error(`PostgreSQL connection error: ${error.message}`);
    process.exit(1);
  } finally {
    if (client) client.release();
  }
};

module.exports = { pool, connectDB };
