-- Customer-facing admin_notes retains its existing meaning and history.
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS internal_notes TEXT;
