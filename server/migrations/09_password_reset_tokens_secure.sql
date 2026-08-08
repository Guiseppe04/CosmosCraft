-- =============================================
-- Migration 09: Secure password reset tokens
-- =============================================
-- The previous password_reset_tokens table stored the RAW token and a
-- pre-staged new_password_hash, which is a security risk. It was only
-- referenced by legacy dead code (no active production flow uses it).
--
-- This migration drops that insecure table and recreates it to store only
-- a SHA-256 hash of the token (never the raw token), plus used_at so tokens
-- are single-use.
--
-- NOTE: CASCADE is used to drop dependent indexes; the table has no active
-- foreign-key dependents beyond the users.user_id FK that is recreated below.
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

CREATE TABLE password_reset_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);