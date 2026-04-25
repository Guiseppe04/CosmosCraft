-- =============================================
-- PAYMENT STATUS MIGRATION
-- Alters existing types and tables for new payment verification workflow
-- Run this on existing databases
-- =============================================

-- =============================================
-- 1. Update the enum type  
-- =============================================

-- First, remove default (which depends on the enum type)
ALTER TABLE orders ALTER COLUMN payment_status DROP DEFAULT;

-- Convert column to text (this keeps existing values as-is)
ALTER TABLE orders ALTER COLUMN payment_status TYPE TEXT;

-- Update old values to new values while in TEXT mode
UPDATE orders SET payment_status = 'approved' WHERE payment_status::text = 'paid';
UPDATE orders SET payment_status = 'proof_submitted' WHERE payment_status::text = 'awaiting_approval';

-- Drop the old enum type
DROP TYPE IF EXISTS order_payment_status_enum;

-- Create new enum type
CREATE TYPE order_payment_status_enum AS ENUM (
    'pending',
    'proof_submitted',
    'under_review',
    'approved',
    'rejected',
    'failed'
);

-- Set new default and convert back to enum
ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'pending'::order_payment_status_enum;
ALTER TABLE orders ALTER COLUMN payment_status TYPE order_payment_status_enum 
    USING payment_status::order_payment_status_enum;


-- =============================================
-- 2. Add new columns to orders table
-- =============================================

DO $$
BEGIN
    -- Add payment_reference_number column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_reference_number'
    ) THEN
        ALTER TABLE orders ADD COLUMN payment_reference_number VARCHAR(100);
    END IF;
    
    -- Add proof_submitted_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'proof_submitted_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN proof_submitted_at TIMESTAMPTZ;
    END IF;
    
    -- Add reviewed_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE orders ADD COLUMN reviewed_by UUID;
    END IF;
    
    -- Add reviewed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
    
    -- Add rejection_reason column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE orders ADD COLUMN rejection_reason TEXT;
    END IF;
    
    -- Add admin_notes column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'admin_notes'
    ) THEN
        ALTER TABLE orders ADD COLUMN admin_notes TEXT;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION ensure_payment_for_verification_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'pending'::payment_status_enum AND (
    NULLIF(BTRIM(COALESCE(NEW.reference_number, '')), '') IS NOT NULL OR
    NULLIF(BTRIM(COALESCE(NEW.proof_url, '')), '') IS NOT NULL
  ) THEN
    NEW.status := 'for_verification'::payment_status_enum;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION sync_order_payment_status_from_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
$function$;

DROP TRIGGER IF EXISTS trg_payments_force_for_verification ON payments;
CREATE TRIGGER trg_payments_force_for_verification
BEFORE INSERT OR UPDATE OF status, reference_number, proof_url ON payments
FOR EACH ROW
EXECUTE FUNCTION ensure_payment_for_verification_status();

DROP TRIGGER IF EXISTS trg_sync_orders_from_payments ON payments;
CREATE TRIGGER trg_sync_orders_from_payments
AFTER INSERT OR UPDATE OF status, reference_number, proof_url ON payments
FOR EACH ROW
EXECUTE FUNCTION sync_order_payment_status_from_payment();

-- Add foreign key constraint for reviewed_by
ALTER TABLE orders 
    ADD CONSTRAINT fk_orders_reviewed_by 
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL;


-- =============================================
-- 3. Create indexes for new columns
-- =============================================

CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference_number);
CREATE INDEX IF NOT EXISTS idx_orders_proof_submitted_at ON orders(proof_submitted_at) WHERE proof_submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_reviewed_at ON orders(reviewed_at) WHERE reviewed_at IS NOT NULL;


-- =============================================
-- 4. Create payment audit log table
-- =============================================

CREATE TABLE IF NOT EXISTS payment_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    payment_id UUID,
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    admin_name TEXT,
    admin_email TEXT,
    reference_number VARCHAR(100),
    rejection_reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_order_id ON payment_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_created_at ON payment_audit_log(created_at DESC);


-- =============================================
-- 5. Grant permissions (adjust role as needed)
-- =============================================

-- Grant permissions to your app role (replace 'app_user' with your actual role)
-- GRANT SELECT ON payment_audit_log TO app_user;
-- GRANT SELECT, UPDATE ON orders TO app_user;

-- Grant to admin role
-- GRANT ALL ON payment_audit_log TO admin;


-- =============================================
-- VERIFICATION: Check current status values
-- =============================================

-- View current distribution of payment statuses
-- SELECT payment_status, COUNT(*) FROM orders GROUP BY payment_status;

-- View sample orders with new columns
-- SELECT order_id, order_number, payment_status, payment_reference_number, reviewed_at, rejection_reason 
-- FROM orders ORDER BY created_at DESC LIMIT 10;
