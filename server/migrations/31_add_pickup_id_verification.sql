ALTER TABLE fulfillment_requests
  ADD COLUMN IF NOT EXISTS pickup_id_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pickup_id_verified_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_id_verified_at TIMESTAMPTZ;