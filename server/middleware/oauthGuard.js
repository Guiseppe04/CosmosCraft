const crypto = require('crypto');
const { pool } = require('../config/database');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const random = () => crypto.randomBytes(32).toString('hex');
const validSecret = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-oauthTransaction' : 'oauthTransaction';
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 5 * 60 * 1000 });
const getFrontendUrl = () => process.env.NODE_ENV === 'production'
  ? (process.env.FRONTEND_URL_PROD || process.env.FRONTEND_URL || 'http://localhost:3000')
  : (process.env.FRONTEND_URL || process.env.FRONTEND_URL_PROD || 'http://localhost:3000');

function privateResponse(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}
function rejectCallback(req, res, code = 'OAUTH_TRANSACTION_INVALID', status = 400) {
  // Rejections never clear or issue authentication cookies. Duplicate UI
  // requests can restore an existing session, not mint one from a used code.
  if (req.headers.accept?.includes('application/json')) {
    return res.status(status).json({ status: 'error', code, message: 'Sign-in could not be completed. Please start again.' });
  }
  return res.redirect(`${getFrontendUrl()}/auth/success?auth_code=${code}`);
}

const beginOAuth = provider => async (req, res, next) => {
  try {
    const challenge = req.query.challenge;
    if (!validSecret(challenge)) return rejectCallback(req, res);
    const state = random(), browser = random();
    await pool.query(
      `INSERT INTO oauth_transactions (state_hash, browser_hash, provider, client_challenge, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '5 minutes')`,
      [hash(state), hash(browser), provider, challenge]
    );
    res.cookie(cookieName(), browser, cookieOptions());
    req.oauthState = state;
    next();
  } catch (error) { next(error); }
};

const oauthSingleUseGuard = provider => async (req, res, next) => {
  try {
    const { state, code, error } = req.query;
    const browser = req.cookies?.[cookieName()];
    if (!validSecret(state) || !validSecret(browser) ||
        (!error && (typeof code !== 'string' || !code || code.length > 4096))) {
      return rejectCallback(req, res);
    }
    // One statement claims the transaction and reserves the code. Concurrent
    // callbacks cannot both proceed, even across multiple server processes.
    const result = await pool.query(
      `WITH claimed AS (
         UPDATE oauth_transactions SET consumed_at = now()
         WHERE state_hash = $1 AND browser_hash = $2 AND provider = $3
           AND expires_at > now() AND consumed_at IS NULL
         RETURNING client_challenge
       ), reserved AS (
         INSERT INTO oauth_codes (provider, code_hash, status, created_at)
         SELECT $3, $4, 'consumed', now() FROM claimed WHERE $4::text IS NOT NULL
         ON CONFLICT (code_hash) DO NOTHING RETURNING code_hash
       )
       SELECT client_challenge FROM claimed WHERE EXISTS (SELECT 1 FROM reserved)`,
      [hash(state), hash(browser), provider, error ? null : hash(code)]
    );
    if (!result.rows.length) return rejectCallback(req, res, 'AUTH_CODE_USED', 409);
    req.oauthTransaction = result.rows[0];
    next();
  } catch (error) { next(error); }
};

module.exports = { beginOAuth, oauthSingleUseGuard, privateResponse, rejectCallback, getFrontendUrl, hash, random, validSecret };
