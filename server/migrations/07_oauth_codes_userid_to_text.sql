-- Migration: convert oauth_codes.user_id from INTEGER to TEXT to support UUID user ids
-- This migration is safe: it converts existing integer values to text.
BEGIN;

ALTER TABLE oauth_codes
  ALTER COLUMN user_id TYPE TEXT USING (user_id::text);

COMMIT;

-- Note: Run this migration on the production DB before retrying OAuth flows.