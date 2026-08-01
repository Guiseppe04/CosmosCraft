const crypto = require('crypto');
const { pool } = require('../config/database');

/**
 * Middleware to ensure an OAuth authorization code is processed only once.
 * Inserts a hash of the authorization code into the `oauth_codes` table.
 * If the code hash already exists, the middleware returns a structured error.
 */
const oauthSingleUseGuard = (provider) => {
  return async (req, res, next) => {
    try {
      const code = req.query.code || req.body.code;
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
            const r = await pool.query('SELECT status, user_id, error_message FROM oauth_codes WHERE code_hash = $1', [hash]);
            const row = r.rows[0];
            if (row) {
              if (row.status === 'success' && row.user_id) {
                // Another request completed successfully: redirect to success
                const redirect = `${process.env.FRONTEND_URL}/auth/success?userId=${row.user_id}&provider=${provider}`;
                return res.redirect(redirect);
              }
              if (row.status === 'failed') {
                const payload = { status: 'error', code: 'AUTH_CODE_USED', message: row.error_message || 'Authorization code already used or processing failed. Please try signing in again.' };
                if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(409).json(payload);
                return res.redirect(`${process.env.FRONTEND_URL}/?auth_error=${encodeURIComponent(payload.message)}&auth_code=${payload.code}`);
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
          const redirect = `${process.env.FRONTEND_URL}/?auth_error=${encodeURIComponent(payload.message)}&auth_code=${payload.code}`;
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
