-- Requires migrations 20, 42 and 46. Existing records keep their workflow.
ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS no_return_reason TEXT,
  ADD COLUMN IF NOT EXISTS item_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
  ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS resale_suitable BOOLEAN,
  ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

ALTER TABLE refund_requests DROP CONSTRAINT IF EXISTS refund_requests_status_check;
ALTER TABLE refund_requests ADD CONSTRAINT refund_requests_status_check CHECK (status IN (
  'pending','under_review','return_required','return_in_transit','item_received','under_inspection',
  'approved','processing','refund_sent','completed','rejected','refunded','withdrawn',
  'pending_payment_verification','return_pending','returned','return_confirmed'
));
DROP INDEX IF EXISTS uq_refund_requests_active_order;
CREATE UNIQUE INDEX uq_refund_requests_active_order ON refund_requests(order_id)
  WHERE deleted_at IS NULL AND status IN ('pending','under_review','return_required','return_in_transit',
    'item_received','under_inspection','approved','processing','refund_sent','pending_payment_verification',
    'return_pending','returned','return_confirmed');

-- A manual repayment reference may not be reused by another new refund.
CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_original_channel_reference
  ON refund_requests (lower(btrim(refund_reference)))
  WHERE deleted_at IS NULL AND original_payment_method IS NOT NULL
    AND refund_reference IS NOT NULL AND status IN ('refund_sent','completed');
