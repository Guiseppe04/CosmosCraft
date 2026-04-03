-- =============================================
-- PAYMENT MODULE MIGRATION SCRIPT
-- Run this to update an existing database
-- =============================================

-- 1. Create ENUM types if they don't exist
DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM ('gcash', 'bank_transfer', 'cash');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_payment_status_enum AS ENUM ('pending', 'paid', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update orders.payment_status to use the new enum
ALTER TABLE orders ALTER COLUMN payment_status DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN payment_status TYPE VARCHAR(20);
ALTER TABLE orders ALTER COLUMN payment_status TYPE order_payment_status_enum USING 
    CASE 
        WHEN payment_status = 'pending' THEN 'pending'::order_payment_status_enum
        WHEN payment_status = 'paid' THEN 'paid'::order_payment_status_enum
        WHEN payment_status = 'failed' THEN 'failed'::order_payment_status_enum
        ELSE 'pending'::order_payment_status_enum
    END;
ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'pending'::order_payment_status_enum;

-- 3. Add new columns to payments table (if not exists)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS method payment_method_enum;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_instructions JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 4. Add foreign keys
ALTER TABLE payments ADD CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE payments ADD CONSTRAINT fk_payments_verified_by FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- 5. Add indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reference_number ON payments(reference_number);

-- 6. Create payment_config table
CREATE TABLE IF NOT EXISTS payment_config (
    config_id SERIAL PRIMARY KEY,
    payment_method payment_method_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    gcash_number VARCHAR(20),
    gcash_qr_code TEXT,
    bank_name VARCHAR(100),
    bank_account_name VARCHAR(150),
    bank_account_number VARCHAR(50),
    bank_branch VARCHAR(100),
    instructions TEXT,
    display_name VARCHAR(100),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(payment_method)
);

-- 7. Insert default payment configurations (if table is empty)
INSERT INTO payment_config (payment_method, is_active, display_name, instructions, sort_order) 
SELECT 'gcash', true, 'GCash', 'Send payment via GCash to our designated number. Upload your receipt as proof of payment.', 1
WHERE NOT EXISTS (SELECT 1 FROM payment_config WHERE payment_method = 'gcash');

INSERT INTO payment_config (payment_method, is_active, display_name, instructions, sort_order) 
SELECT 'bank_transfer', true, 'Bank Transfer', 'Transfer to our bank account. Keep your transaction reference for verification.', 2
WHERE NOT EXISTS (SELECT 1 FROM payment_config WHERE payment_method = 'bank_transfer');

INSERT INTO payment_config (payment_method, is_active, display_name, instructions, sort_order) 
SELECT 'cash', true, 'Cash', 'Pay directly at our store location.', 3
WHERE NOT EXISTS (SELECT 1 FROM payment_config WHERE payment_method = 'cash');
