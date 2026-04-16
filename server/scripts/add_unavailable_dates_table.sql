-- =============================================
-- Add Unavailable Dates Table for Appointments
-- =============================================

-- Create the unavailable_dates table
CREATE TABLE IF NOT EXISTS unavailable_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    reason VARCHAR(255),
    is_recurring BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient date lookups
CREATE INDEX idx_unavailable_dates_date ON unavailable_dates(date);

-- Create index for created_by lookups
CREATE INDEX idx_unavailable_dates_created_by ON unavailable_dates(created_by);

-- Add payment_status to appointments table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE appointments ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
    END IF;
END $$;

-- Add payment_method to appointments table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE appointments ADD COLUMN payment_method VARCHAR(50);
    END IF;
END $$;

-- Add payment_proof_url to appointments table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'payment_proof_url'
    ) THEN
        ALTER TABLE appointments ADD COLUMN payment_proof_url TEXT;
    END IF;
END $$;

-- Add customer info fields to appointments table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'customer_name'
    ) THEN
        ALTER TABLE appointments ADD COLUMN customer_name VARCHAR(100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'customer_email'
    ) THEN
        ALTER TABLE appointments ADD COLUMN customer_email VARCHAR(100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE appointments ADD COLUMN customer_phone VARCHAR(20);
    END IF;
END $$;