-- =============================================
-- Migration 27: Fix incorrectly verified accounts & cleanup old unverified accounts
-- =============================================

-- 1. FIND: Password-based accounts marked is_verified=true but have NO completed OTP record
-- These are accounts that were created via email signup but never actually verified their email
-- because the bug allowed tokens to be issued before OTP verification.

SELECT 
  u.user_id,
  u.email,
  u.is_verified,
  u.created_at,
  u.password_hash IS NOT NULL AS has_password,
  COUNT(oc.otp_id) as total_otp_codes,
  COUNT(CASE WHEN oc.is_used = true AND oc.purpose = 'signup' THEN 1 END) as used_signup_otps
FROM users u
LEFT JOIN otp_codes oc ON oc.user_id = u.user_id AND oc.purpose = 'signup'
WHERE u.password_hash IS NOT NULL
  AND u.is_verified = true
GROUP BY u.user_id, u.email, u.is_verified, u.created_at, u.password_hash
HAVING COUNT(CASE WHEN oc.is_used = true AND oc.purpose = 'signup' THEN 1 END) = 0;

-- 2. FIX: Mark these accounts as unverified (is_verified = false)
-- Uncomment to run the fix:
/*
UPDATE users u
SET is_verified = false, updated_at = now()
WHERE u.password_hash IS NOT NULL
  AND u.is_verified = true
  AND NOT EXISTS (
    SELECT 1 FROM otp_codes oc
    WHERE oc.user_id = u.user_id
      AND oc.purpose = 'signup'
      AND oc.is_used = true
  );
*/

-- 3. CLEANUP: Find unverified password-based accounts older than 48 hours
-- These are accounts that signed up but never completed verification.
-- They can be safely deleted or marked for deletion.

SELECT 
  u.user_id,
  u.email,
  u.is_verified,
  u.created_at,
  u.password_hash IS NOT NULL AS has_password,
  EXTRACT(EPOCH FROM (now() - u.created_at))/3600 AS hours_since_creation
FROM users u
WHERE u.password_hash IS NOT NULL
  AND u.is_verified = false
  AND u.created_at < now() - interval '48 hours'
  AND u.deleted_at IS NULL;

-- 4. CLEANUP JOB: Delete unverified password-based accounts older than 48 hours
-- Uncomment to run the cleanup:
/*
DELETE FROM users u
WHERE u.password_hash IS NOT NULL
  AND u.is_verified = false
  AND u.created_at < now() - interval '48 hours'
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM appointments a WHERE a.user_id = u.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.order_id IN (
      SELECT order_id FROM orders WHERE user_id = u.user_id
    )
  );
*/

-- 5. OPTIONAL: Soft-delete instead of hard delete (recommended for audit trail)
-- Uncomment to run soft-delete:
/*
UPDATE users u
SET deleted_at = now(), updated_at = now()
WHERE u.password_hash IS NOT NULL
  AND u.is_verified = false
  AND u.created_at < now() - interval '48 hours'
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM appointments a WHERE a.user_id = u.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.order_id IN (
      SELECT order_id FROM orders WHERE user_id = u.user_id
    )
  );
*/

-- 6. REVOKE: Revoke all refresh tokens for the fixed accounts
-- This ensures any tokens issued before the fix are invalidated.
-- Uncomment to run after fixing accounts:
/*
UPDATE refresh_tokens rt
SET is_revoked = true
WHERE rt.user_id IN (
  SELECT u.user_id
  FROM users u
  WHERE u.password_hash IS NOT NULL
    AND u.is_verified = true
    AND NOT EXISTS (
      SELECT 1 FROM otp_codes oc
      WHERE oc.user_id = u.user_id
        AND oc.purpose = 'signup'
        AND oc.is_used = true
    )
);
*/

-- 7. SCHEDULED CLEANUP JOB (run via pg_cron or application scheduler)
-- This can be set up as a recurring job to clean up stale unverified accounts.

-- Example pg_cron setup (run daily at 3 AM):
/*
SELECT cron.schedule(
  'cleanup-unverified-accounts-daily',
  '0 3 * * *',
  $$
  UPDATE users u
  SET deleted_at = now(), updated_at = now()
  WHERE u.password_hash IS NOT NULL
    AND u.is_verified = false
    AND u.created_at < now() - interval '48 hours'
    AND u.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM orders o WHERE o.user_id = u.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM appointments a WHERE a.user_id = u.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM projects p WHERE p.order_id IN (
        SELECT order_id FROM orders WHERE user_id = u.user_id
      )
    );
  $$
);
*/

-- To unschedule: SELECT cron.unschedule('cleanup-unverified-accounts-daily');