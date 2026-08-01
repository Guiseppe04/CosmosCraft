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
        await pool.query(
          'INSERT INTO oauth_codes (provider, code_hash) VALUES ($1, $2)',
          [provider, hash]
        );
        // inserted successfully - proceed
        return next();
      } catch (err) {
        // duplicate key - code already used
        if (err.code === '23505') {
          console.warn(`[oauthGuard] Duplicate authorization code for provider=${provider}`);
          const payload = {
            status: 'error',
            code: 'AUTH_CODE_USED',
            message: 'Authorization code already used. Please try signing in again.'
          };
          // If client expects JSON, return JSON; otherwise redirect with encoded message
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
