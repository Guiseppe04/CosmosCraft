-- Deploy with old OAuth workers stopped: the legacy guard must never run again.
-- Keep hashes as rejection tombstones, but remove every retained login result.
UPDATE oauth_codes SET status = 'invalidated', user_id = NULL, oauth_user_id = NULL,
  provider_user_id = NULL, access_token = NULL, error_message = NULL,
  processed_at = now()
WHERE status IS DISTINCT FROM 'invalidated' OR user_id IS NOT NULL
  OR oauth_user_id IS NOT NULL OR provider_user_id IS NOT NULL
  OR access_token IS NOT NULL OR error_message IS NOT NULL;

CREATE TABLE IF NOT EXISTS oauth_transactions (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'google'),
  client_challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS oauth_transactions_expiry ON oauth_transactions (expires_at);

CREATE TABLE IF NOT EXISTS oauth_handoffs (
  handoff_hash TEXT PRIMARY KEY,
  client_challenge TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_handoffs_expiry ON oauth_handoffs (expires_at);
