-- Requires migration 42. Reuses existing refund records and private image storage.
ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS original_payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS original_payment_id UUID,
  ADD COLUMN IF NOT EXISTS return_instructions TEXT,
  ADD COLUMN IF NOT EXISTS customer_return_notes TEXT;

ALTER TABLE refund_private_files DROP CONSTRAINT IF EXISTS refund_private_files_kind_check;
ALTER TABLE refund_private_files ADD CONSTRAINT refund_private_files_kind_check
  CHECK (kind IN ('qr','proof','inspection','evidence0','evidence1','evidence2','evidence3','evidence4',
    'return0','return1','return2','return3','return4')
    OR kind ~ '^(evidence|return)_[0-4]$');
