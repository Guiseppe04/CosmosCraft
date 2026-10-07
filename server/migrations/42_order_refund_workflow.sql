-- Additive: existing refund records keep their original workflow and values.
ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS workflow_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS preferred_method VARCHAR(20) CHECK (preferred_method IN ('e_wallet', 'e_bank')),
  ADD COLUMN IF NOT EXISTS refund_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES users(user_id);

ALTER TABLE refund_requests DROP CONSTRAINT IF EXISTS refund_requests_status_check;
ALTER TABLE refund_requests DROP CONSTRAINT IF EXISTS refund_requests_refund_method_check;
ALTER TABLE refund_requests ADD CONSTRAINT refund_requests_refund_method_check CHECK (
  refund_method IS NULL OR refund_method IN ('gcash','bank_transfer','cash','store_credit','e_wallet','e_bank')
);
ALTER TABLE refund_requests ADD CONSTRAINT refund_requests_status_check CHECK (status IN (
  'pending', 'under_review', 'approved', 'processing', 'refund_sent', 'completed',
  'rejected', 'refunded', 'pending_payment_verification', 'withdrawn',
  'return_pending', 'returned', 'return_confirmed'
));
DROP INDEX IF EXISTS uq_refund_requests_active_order;
CREATE UNIQUE INDEX uq_refund_requests_active_order ON refund_requests(order_id)
  WHERE deleted_at IS NULL AND status IN ('pending', 'under_review', 'approved', 'processing',
    'refund_sent', 'return_pending', 'returned', 'pending_payment_verification');

CREATE TABLE IF NOT EXISTS refund_private_files (
  refund_request_id UUID NOT NULL REFERENCES refund_requests(refund_request_id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('qr', 'proof')),
  mime_type VARCHAR(30) NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  file_data BYTEA NOT NULL CHECK (octet_length(file_data) BETWEEN 1 AND 5242880),
  uploaded_by UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (refund_request_id, kind)
);
CREATE TABLE IF NOT EXISTS refund_private_destinations (
  refund_request_id UUID PRIMARY KEY REFERENCES refund_requests(refund_request_id) ON DELETE CASCADE,
  payment_destination JSONB NOT NULL
);
ALTER TABLE refund_private_destinations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON refund_private_destinations FROM PUBLIC;
ALTER TABLE refund_private_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON refund_private_files FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON refund_private_files FROM anon;
    REVOKE ALL ON refund_private_destinations FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON refund_private_files FROM authenticated;
    REVOKE ALL ON refund_private_destinations FROM authenticated;
  END IF;
END $$;
