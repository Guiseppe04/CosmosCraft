-- Migration 07: Add refund_requests table for appointment payment refunds
-- Supports refund requests created by customers when cancelling appointments with digital payment methods

-- Add 'refund' notification type
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'refund';

-- Create refund_status_enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status_enum') THEN
    CREATE TYPE refund_status_enum AS ENUM ('pending', 'approved', 'rejected', 'processed');
  END IF;
END $$;

-- Create refund_requests table
CREATE TABLE IF NOT EXISTS refund_requests (
    refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(255),
    amount NUMERIC(12, 2) CHECK (amount >= 0),
    reason TEXT,
    status refund_status_enum NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_appointment ON refund_requests(appointment_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON refund_requests(created_at DESC);
