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
    DO $$
    BEGIN
      ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'confirmed';
      ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'in_progress';
      ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'ready_for_pickup';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await client.query(`
    UPDATE appointments
    SET status = 'confirmed'
    WHERE status::text = 'approved';
  `);

  await client.query(`
    DO $$
    BEGIN
      ALTER TYPE project_status_enum ADD VALUE IF NOT EXISTS 'cancelled';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
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

  await client.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_reference_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS proof_submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION ensure_payment_for_verification_status()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.status = 'pending'::payment_status_enum AND (
        NULLIF(BTRIM(COALESCE(NEW.reference_number, '')), '') IS NOT NULL OR
        NULLIF(BTRIM(COALESCE(NEW.proof_url, '')), '') IS NOT NULL
      ) THEN
        NEW.status := 'for_verification'::payment_status_enum;
      END IF;

      RETURN NEW;
    END;
    $$;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION sync_order_payment_status_from_payment()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      next_order_status order_payment_status_enum;
      next_reference_number TEXT;
    BEGIN
      next_reference_number := NULLIF(BTRIM(COALESCE(NEW.reference_number, '')), '');

      next_order_status := CASE
        WHEN NEW.status = 'verified'::payment_status_enum THEN 'approved'::order_payment_status_enum
        WHEN NEW.status = 'for_verification'::payment_status_enum THEN 'proof_submitted'::order_payment_status_enum
        WHEN NEW.status = 'rejected'::payment_status_enum THEN 'rejected'::order_payment_status_enum
        WHEN NEW.status = 'cancelled'::payment_status_enum THEN 'pending'::order_payment_status_enum
        WHEN NEW.status = 'refunded'::payment_status_enum THEN 'failed'::order_payment_status_enum
        WHEN NEW.status = 'pending'::payment_status_enum THEN 'pending'::order_payment_status_enum
        ELSE NULL
      END;

      IF next_order_status IS NOT NULL THEN
        UPDATE orders
        SET payment_status = next_order_status,
            payment_reference_number = COALESCE(next_reference_number, payment_reference_number),
            proof_submitted_at = CASE
              WHEN next_order_status = 'proof_submitted'::order_payment_status_enum
                THEN COALESCE(proof_submitted_at, NEW.created_at, now())
              ELSE proof_submitted_at
            END,
            reviewed_at = CASE
              WHEN next_order_status = 'approved'::order_payment_status_enum
                THEN COALESCE(reviewed_at, now())
              ELSE reviewed_at
            END,
            updated_at = now()
        WHERE order_id = NEW.order_id
          AND (
            payment_status IS DISTINCT FROM next_order_status OR
            payment_reference_number IS DISTINCT FROM COALESCE(next_reference_number, payment_reference_number)
          );
      END IF;

      RETURN NEW;
    END;
    $$;
  `);

  await client.query(`
    DROP TRIGGER IF EXISTS trg_payments_force_for_verification ON payments;
    CREATE TRIGGER trg_payments_force_for_verification
    BEFORE INSERT OR UPDATE OF status, reference_number, proof_url ON payments
    FOR EACH ROW
    EXECUTE FUNCTION ensure_payment_for_verification_status();
  `);

  await client.query(`
    DROP TRIGGER IF EXISTS trg_sync_orders_from_payments ON payments;
    CREATE TRIGGER trg_sync_orders_from_payments
    AFTER INSERT OR UPDATE OF status, reference_number, proof_url ON payments
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_payment_status_from_payment();
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
