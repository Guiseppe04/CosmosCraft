-- Migration: extend oauth_codes with processing fields for idempotent callback handling
ALTER TABLE oauth_codes
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS provider_user_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id INTEGER,
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_oauth_codes_status ON oauth_codes(status);
