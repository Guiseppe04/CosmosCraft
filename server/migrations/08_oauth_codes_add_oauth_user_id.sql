-- Migration: add oauth_user_id as a text field to oauth_codes so UUID login ids are supported
ALTER TABLE oauth_codes
  ADD COLUMN IF NOT EXISTS oauth_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_oauth_codes_oauth_user_id ON oauth_codes(oauth_user_id);
