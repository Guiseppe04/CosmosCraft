-- ============================================================================
-- MIGRATION 37: Sync Hosting Database Schema with Latest Application Code
--
-- Brings the database backup / hosting database state up to date with all
-- application features, models, and migrations:
--   1. Enum extensions (notification_type_enum, appointment_status_enum)
--   2. Customizations is_locked tracking
--   3. Services slug support & backfill
--   4. Appointment rescheduling, approved payment amount & appointment_refunds table
--   5. Inventory percentage-based low stock threshold (NUMERIC(5,2))
--   6. Fulfillment requests pickup ID verification fields
--   7. Payment settings storage fee, bank transfer QR image & display mode
--   8. Unavailable dates holiday open override flag & index
--   9. Audit logs context, field-level changes, searchable text, indexes & trigger
--
-- All statements are safe and idempotent (can be run multiple times safely).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUM EXTENSIONS
-- ----------------------------------------------------------------------------
-- Note: In PostgreSQL, ALTER TYPE ... ADD VALUE cannot be executed inside a
-- multi-statement transaction in some PG versions, so execute these individually.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type_enum'::regtype AND enumlabel = 'project_update'
  ) THEN
    ALTER TYPE notification_type_enum ADD VALUE 'project_update';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type_enum'::regtype AND enumlabel = 'refund'
  ) THEN
    ALTER TYPE notification_type_enum ADD VALUE 'refund';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'appointment_status_enum'::regtype AND enumlabel = 'rescheduled_by_customer'
  ) THEN
    ALTER TYPE appointment_status_enum ADD VALUE 'rescheduled_by_customer';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. CUSTOMIZATIONS TABLE: IS_LOCKED
-- ----------------------------------------------------------------------------
ALTER TABLE customizations
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- 3. SERVICES TABLE: SLUG SUPPORT & BACKFILL
-- ----------------------------------------------------------------------------
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS slug VARCHAR(150);

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE services
SET slug = lower(
  regexp_replace(
    regexp_replace(
      trim(name),
      '&', ' and ', 'g'
    ),
    '[^a-z0-9]+', '-', 'g'
  )
)
WHERE (slug IS NULL OR slug = '') AND name IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. APPOINTMENTS & APPOINTMENT REFUNDS
-- ----------------------------------------------------------------------------
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS rescheduled_from UUID REFERENCES appointments(appointment_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_payment_amount NUMERIC(12, 2);

CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_successor
  ON appointments(rescheduled_from)
  WHERE rescheduled_from IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_payment_method
  ON appointments(payment_method)
  WHERE payment_method IS NOT NULL;

CREATE TABLE IF NOT EXISTS appointment_refunds (
  refund_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(appointment_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'refunded', 'rejected')),
  amount_requested NUMERIC(12, 2) NOT NULL CHECK(amount_requested > 0),
  original_payment JSONB NOT NULL,
  refund_method VARCHAR(100) NOT NULL,
  account_holder VARCHAR(200) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  reason TEXT,
  refund_reference VARCHAR(255),
  proof_url TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_refunds_status ON appointment_refunds(status);
CREATE INDEX IF NOT EXISTS idx_appointment_refunds_user_id ON appointment_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_refunds_created_at ON appointment_refunds(created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. INVENTORY TABLE: PERCENTAGE LOW STOCK THRESHOLD
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'inventory'
      AND column_name = 'low_stock_threshold'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE inventory
      ALTER COLUMN low_stock_threshold TYPE NUMERIC(5,2) USING low_stock_threshold::NUMERIC(5,2);

    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = current_schema()
        AND table_name = 'inventory'
        AND constraint_name = 'inventory_low_stock_threshold_check'
    ) THEN
      ALTER TABLE inventory DROP CONSTRAINT inventory_low_stock_threshold_check;
    END IF;

    ALTER TABLE inventory
      ADD CONSTRAINT inventory_low_stock_threshold_check
      CHECK (low_stock_threshold >= 0 AND low_stock_threshold <= 100);

    ALTER TABLE inventory
      ALTER COLUMN low_stock_threshold SET DEFAULT 10;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. FULFILLMENT REQUESTS: PICKUP ID VERIFICATION
-- ----------------------------------------------------------------------------
ALTER TABLE fulfillment_requests
  ADD COLUMN IF NOT EXISTS pickup_id_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pickup_id_verified_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_id_verified_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 7. PAYMENT SETTINGS: STORAGE FEE, BANK TRANSFER QR & DISPLAY MODE
-- ----------------------------------------------------------------------------
ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS pickup_storage_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_transfer_qr_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_transfer_display_mode VARCHAR(20) NOT NULL DEFAULT 'details';

-- ----------------------------------------------------------------------------
-- 8. UNAVAILABLE DATES: HOLIDAY OPEN OVERRIDE
-- ----------------------------------------------------------------------------
ALTER TABLE unavailable_dates
  ADD COLUMN IF NOT EXISTS is_open_override BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_unavailable_dates_open_override
  ON unavailable_dates (date)
  WHERE is_open_override = TRUE;

-- ----------------------------------------------------------------------------
-- 9. AUDIT LOGS: CONTEXT, CHANGES, SEARCH TEXT, INDEXES, FUNCTION & TRIGGER
-- ----------------------------------------------------------------------------
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS search_text TEXT;

COMMENT ON COLUMN audit_logs.context IS
  'Normalised business context captured when the event occurred (order/project/appointment/payment/customer/stock identifiers).';
COMMENT ON COLUMN audit_logs.changes IS
  'Field level before/after values, e.g. {"status":{"from":"pending","to":"verified"}}.';
COMMENT ON COLUMN audit_logs.search_text IS
  'Flattened text used by server-side audit search.';

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm extension not available, search will use standard scan';
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_search_text ON audit_logs USING GIN (search_text gin_trgm_ops)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_created ON audit_logs (entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_context_gin ON audit_logs USING GIN (context jsonb_path_ops);

CREATE OR REPLACE FUNCTION audit_search_text(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_previous_status text,
  p_new_status text,
  p_context jsonb,
  p_changes jsonb,
  p_details jsonb
) RETURNS text AS $$
  SELECT left(
    btrim(
      regexp_replace(
        regexp_replace(
          lower(concat_ws(' ',
            coalesce(p_action, ''),
            coalesce(p_entity_type, ''),
            coalesce(p_entity_id::text, ''),
            coalesce(p_previous_status, ''),
            coalesce(p_new_status, ''),
            coalesce(p_context::text, ''),
            coalesce(p_changes::text, ''),
            coalesce(p_details::text, '')
          )),
          '[{}[\]",:]+', ' ', 'g'
        ),
        '\s+', ' ', 'g'
      )
    ),
    8000
  );
$$ LANGUAGE sql IMMUTABLE;

UPDATE audit_logs
SET search_text = audit_search_text(
  action, entity_type, entity_id, previous_status, new_status, context, changes, details
)
WHERE search_text IS NULL
   OR search_text ~ '[{}[\]",:]+';

CREATE OR REPLACE FUNCTION audit_logs_fill_search_text() RETURNS trigger AS $$
BEGIN
  IF NEW.search_text IS NULL THEN
    NEW.search_text := audit_search_text(
      NEW.action, NEW.entity_type, NEW.entity_id,
      NEW.previous_status, NEW.new_status,
      NEW.context, NEW.changes, NEW.details
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_fill_search_text ON audit_logs;
CREATE TRIGGER trg_audit_logs_fill_search_text
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_logs_fill_search_text();
