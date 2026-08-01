-- Migration: create oauth_codes table to prevent replayed authorization codes
CREATE TABLE IF NOT EXISTS oauth_codes (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Optional index for provider
CREATE INDEX IF NOT EXISTS idx_oauth_codes_provider ON oauth_codes(provider);
