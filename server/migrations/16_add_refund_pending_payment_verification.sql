-- =============================================
-- MIGRATION 16: Add pending_payment_verification to refund status enum
-- =============================================

-- 1. Widen the status column so it can hold the longer enum value.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'refund_requests'
          AND column_name = 'status'
          AND character_maximum_length < 50
    ) THEN
        ALTER TABLE refund_requests
            ALTER COLUMN status TYPE VARCHAR(50);
    END IF;
END $$;

-- 2. Update the CHECK constraint to include the new status value.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'refund_requests_status_check'
          AND conrelid = 'refund_requests'::regclass
    ) THEN
        ALTER TABLE refund_requests DROP CONSTRAINT refund_requests_status_check;
    END IF;
END $$;

ALTER TABLE refund_requests
    ADD CONSTRAINT refund_requests_status_check
    CHECK (status IN ('pending', 'approved', 'processing', 'rejected', 'refunded', 'pending_payment_verification'));
