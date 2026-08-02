const crypto = require('crypto');
const { pool } = require('../config/database');
const rbacService = require('../services/rbacService');
const { generateTokens } = require('../utils/generateTokens');

/**
 * Middleware to ensure an OAuth authorization code is processed only once.
 * Inserts a hash of the authorization code into the `oauth_codes` table.
 * If the code hash already exists, the middleware returns a structured error.
 */
let oauthUserIdColumnExists;

const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL_PROD || process.env.FRONTEND_URL || 'http://localhost:3000';
  }
  return process.env.FRONTEND_URL || process.env.FRONTEND_URL_PROD || 'http://localhost:3000';
};

const ensureOauthUserIdColumn = async () => {
  if (oauthUserIdColumnExists !== undefined) return oauthUserIdColumnExists;
  const result = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'oauth_codes' AND column_name = 'oauth_user_id' LIMIT 1`
  );
  oauthUserIdColumnExists = result.rows.length > 0;
  return oauthUserIdColumnExists;
};

const getOauthCodeRow = async (hash) => {
  const hasOauthUserId = await ensureOauthUserIdColumn();
  const query = hasOauthUserId
    ? 'SELECT status, oauth_user_id, user_id, error_message FROM oauth_codes WHERE code_hash = $1'
    : 'SELECT status, user_id, error_message FROM oauth_codes WHERE code_hash = $1';
  const result = await pool.query(query, [hash]);
  return result.rows[0];
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { httpOnly: true, secure: true, sameSite: 'none' });
  res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'none' });
};

const setAuthCookies = async (res, userId) => {
  const roleSummary = await rbacService.getUserRoleSummary(userId, false);
  const { accessToken, refreshToken } = await generateTokens(userId, roleSummary.role);
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, cookieOptions);
};

const redirectToSuccess = (res, userId, provider) => {
  return res.redirect(`${getFrontendUrl()}/auth/success?userId=${encodeURIComponent(userId)}&provider=${provider}`);
};

const oauthSingleUseGuard = (provider) => {
  return async (req, res, next) => {
    try {
      const code = req.query.code || req.body.code;
      clearAuthCookies(res);
      if (!code) return next();

      const hash = crypto.createHash('sha256').update(code).digest('hex');

      try {
        // Insert initial processing marker. If this insert succeeds, this process is responsible for exchanging the code.
        await pool.query(
          'INSERT INTO oauth_codes (provider, code_hash, status, created_at) VALUES ($1, $2, $3, now())',
          [provider, hash, 'processing']
        );
        // inserted successfully - proceed
        return next();
      } catch (err) {
        // duplicate key - code already present
        if (err.code === '23505') {
          console.warn(`[oauthGuard] Duplicate authorization code for provider=${provider}`);
          // If another process is currently handling this code, poll for the result for a short window
          const maxPollMs = 3000; // wait up to 3s
          const pollInterval = 300;
          const start = Date.now();

          while (Date.now() - start < maxPollMs) {
            const row = await getOauthCodeRow(hash);
            if (row) {
              const duplicateUserId = row.oauth_user_id ?? (row.user_id != null ? String(row.user_id) : null);
              if (row.status === 'success' && duplicateUserId) {
                // Another request completed successfully. Re-issue tokens and cookies
                // because clearAuthCookies/res may have been called on this duplicate
                // request, which would otherwise leave the user logged out.
                try {
                  await setAuthCookies(res, Number(duplicateUserId));
                } catch (tokenErr) {
                  console.error('[oauthGuard] Failed to re-issue tokens for duplicate OAuth code:', tokenErr);
                }
                return redirectToSuccess(res, duplicateUserId, provider);
              }
              if (row.status === 'failed') {
                const payload = { status: 'error', code: 'AUTH_CODE_USED', message: row.error_message || 'Authorization code already used or processing failed. Please try signing in again.' };
                if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(409).json(payload);
                return res.redirect(`${getFrontendUrl()}/?auth_error=${encodeURIComponent(payload.message)}&auth_code=${payload.code}`);
              }
            }
            // wait and poll again
            await new Promise((r) => setTimeout(r, pollInterval));
          }

          // If polling timed out, return an informative message rather than attempting another exchange
          const payload = {
            status: 'error',
            code: 'AUTH_CODE_USED',
            message: 'Authorization code is being processed. If you were just redirected, please wait a moment and refresh.'
          };
          if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(409).json(payload);
          }
          const redirect = `${getFrontendUrl()}/?auth_error=${encodeURIComponent(payload.message)}&auth_code=${payload.code}`;
          return res.redirect(redirect);
        }
        throw err;
      }
    } catch (error) {
      return next(error);
    }
  };
};

module.exports = { oauthSingleUseGuard };
