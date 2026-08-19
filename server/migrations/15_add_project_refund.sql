-- =============================================
-- MIGRATION 15: Project Cancellation Snapshot & Project Refunds
-- =============================================

-- 1. Extend refund_requests to support project-scoped refunds (build orders).
--    Missing columns are added idempotently (IF NOT EXISTS) so existing
--    delivered-order refunds continue to work unchanged. project_id and
--    payment_id are nullable so order-based refunds without a project still
--    coexist.
ALTER TABLE refund_requests
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(payment_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS amount_requested NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS build_stage_at_request VARCHAR(255),
    ADD COLUMN IF NOT EXISTS requested_amount_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add 'processing' to the refund status CHECK constraint.
--    PostgreSQL cannot alter a CHECK constraint in place, so we drop and re-add it.
--    The full allowed set: pending, approved, processing, rejected, refunded.
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
    CHECK (status IN ('pending', 'approved', 'processing', 'rejected', 'refunded'));

-- Indexes for the new lookups
CREATE INDEX IF NOT EXISTS idx_refund_requests_project_id ON refund_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payment_id ON refund_requests(payment_id);

-- 3. Project build-stage snapshot columns.
--    last_completed_stage / last_completed_stage_at record the latest fully-completed
--    milestone whenever tasks are updated.
--    cancelled_stage_snapshot is written by the admin cancel approval so the stage a
--    customer is entitled to receive survives the status change to cancelled.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS last_completed_stage VARCHAR(255),
    ADD COLUMN IF NOT EXISTS last_completed_stage_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_stage_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS cancelled_stage_snapshot_at TIMESTAMPTZ;
