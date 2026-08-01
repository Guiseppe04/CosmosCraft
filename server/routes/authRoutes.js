const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController.js');
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/auth.js');
const { asyncHandler } = require('../middleware/errorHandler');
const rbacService = require('../services/rbacService');
const { oauthSingleUseGuard } = require('../middleware/oauthGuard');

const router = express.Router();

// Helper to generate tokens (import from utils)
const { generateTokens } = require('../utils/generateTokens');
const crypto = require('crypto');
const { pool } = require('../config/database');

let oauthUserIdColumnExists;

const ensureOauthUserIdColumn = async () => {
  if (oauthUserIdColumnExists !== undefined) return oauthUserIdColumnExists;
  const result = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'oauth_codes' AND column_name = 'oauth_user_id' LIMIT 1`
  );
  oauthUserIdColumnExists = result.rows.length > 0;
  return oauthUserIdColumnExists;
};

const updateOauthCodeSuccess = async (code, userId) => {
  if (!code) return;
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const hasColumn = await ensureOauthUserIdColumn();

  if (hasColumn) {
    await pool.query(
      'UPDATE oauth_codes SET status = $1, oauth_user_id = $2, processed_at = now() WHERE code_hash = $3',
      ['success', String(userId), hash]
    );
  } else {
    await pool.query(
      'UPDATE oauth_codes SET status = $1, user_id = $2, processed_at = now() WHERE code_hash = $3',
      ['success', userId, hash]
    );
  }
};

const updateOauthCodeFailure = async (code, errorMessage) => {
  if (!code) return;
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  await pool.query(
    'UPDATE oauth_codes SET status = $1, error_message = $2, processed_at = now() WHERE code_hash = $3',
    ['failed', errorMessage, hash]
  );
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { httpOnly: true, secure: true, sameSite: 'none' });
  res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'none' });
};

// OAuth Routes - Use standard Passport middleware
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google Callback - use custom callback to capture user
router.get('/google/callback', oauthSingleUseGuard('google'), asyncHandler(async (req, res, next) => {
  console.log('[Google Callback] Request received:', { query: req.query, params: req.params });
  clearAuthCookies(res);
  
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    try {
      console.log('[Google Callback] Auth result:', { err, user: user ? 'user found' : 'no user', info });

      if (err) {
        console.error('[Google Callback] Auth error:', err);
        const payload = { status: 'error', code: 'OAUTH_ERROR', provider: 'google', message: err.message || 'Authentication failed. Please try again.' };
        // Mark oauth_codes as failed so duplicate callers know
        try {
          const code = req.query.code || req.body.code;
          if (code) {
            const hash = crypto.createHash('sha256').update(code).digest('hex');
            await pool.query('UPDATE oauth_codes SET status = $1, error_message = $2, processed_at = now() WHERE code_hash = $3', ['failed', err.message || 'oauth_error', hash]);
          }
        } catch (uErr) {
          console.error('[Google Callback] Failed to mark oauth_codes failed:', uErr);
        }
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(400).json(payload);
        return res.redirect(`${process.env.FRONTEND_URL}/?auth_error=${encodeURIComponent(payload.message)}&auth_code=${payload.code}`);
      }

      if (!user) {
        console.log('[Google Callback] No user found, redirecting to signup');
        const msg = 'Authentication failed. Please try again.';
        try {
          await updateOauthCodeFailure(req.query.code || req.body.code, msg);
        } catch (uErr) {
          console.error('[Google Callback] Failed to mark oauth_codes failed:', uErr);
        }
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(400).json({ status: 'error', message: msg });
        return res.redirect(`${process.env.FRONTEND_URL}/?auth_error=${encodeURIComponent(msg)}`);
      }

      // User exists or was just created - generate tokens
      const roleSummary = await rbacService.getUserRoleSummary(user.user_id, false);
      const { accessToken, refreshToken } = await generateTokens(user.user_id, roleSummary.role);
      console.log('[Google Callback] Tokens generated for user:', user.user_id);

      // Update oauth_codes record to mark success so duplicate callers can proceed
      try {
        await updateOauthCodeSuccess(req.query.code || req.body.code, user.user_id);
      } catch (uErr) {
        console.error('[Google Callback] Failed to update oauth_codes record:', uErr);
      }

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const redirectUrl = `${process.env.FRONTEND_URL}/auth/success?userId=${user.user_id}&provider=google`;
      console.log('[Google Callback] Redirecting to:', redirectUrl);
      
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('[Google Callback] Error in callback:', error);
      const payload = { status: 'error', code: 'OAUTH_ERROR', provider: 'google', message: 'Authentication failed. Please try again.' };
      if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(500).json(payload);
      return res.redirect(`${process.env.FRONTEND_URL}/?auth_error=${encodeURIComponent(payload.message)}&auth_code=${payload.code}`);
    }
  })(req, res, next);
}));

// Facebook - Use standard Passport middleware
router.get(
  '/facebook',
  passport.authenticate('facebook', { scope: ['public_profile', 'email'] })
);

// Facebook Callback - use custom callback to capture user
router.get('/facebook/callback', oauthSingleUseGuard('facebook'), asyncHandler(async (req, res, next) => {
  clearAuthCookies(res);
  passport.authenticate('facebook', { session: false }, async (err, user, info) => {
    try {
      if (err) {
        console.error('[Facebook Callback] Auth error:', err);
          // Mark oauth_codes as failed
          try {
            const code = req.query.code || req.body.code;
            if (code) {
              const hash = crypto.createHash('sha256').update(code).digest('hex');
              await pool.query('UPDATE oauth_codes SET status = $1, error_message = $2, processed_at = now() WHERE code_hash = $3', ['failed', err.message || 'oauth_error', hash]);
            }
          } catch (uErr) {
            console.error('[Facebook Callback] Failed to mark oauth_codes failed:', uErr);
          }
        const payload = { status: 'error', code: 'OAUTH_ERROR', provider: 'facebook', message: err.message || 'Authentication failed. Please try again.' };
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(400).json(payload);
        return res.redirect(`${process.env.FRONTEND_URL}/?auth_error=${encodeURIComponent(payload.message)}&auth_code=${payload.code}`);
      }

      if (!user) {
        const msg = 'Authentication failed. Please try again.';
        try {
          await updateOauthCodeFailure(req.query.code || req.body.code, msg);
        } catch (uErr) {
          console.error('[Facebook Callback] Failed to mark oauth_codes failed:', uErr);
        }
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(400).json({ status: 'error', message: msg });
        return res.redirect(`${process.env.FRONTEND_URL}/?auth_error=${encodeURIComponent(msg)}`);
      }

      // User exists or was just created - generate tokens
      const roleSummary = await rbacService.getUserRoleSummary(user.user_id, false);
      const { accessToken, refreshToken } = await generateTokens(user.user_id, roleSummary.role);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Update oauth_codes record to mark success so duplicate callers can proceed
      try {
        await updateOauthCodeSuccess(req.query.code || req.body.code, user.user_id);
      } catch (uErr) {
        console.error('[Facebook Callback] Failed to update oauth_codes record:', uErr);
      }

      return res.redirect(`${process.env.FRONTEND_URL}/auth/success?userId=${user.user_id}&provider=facebook`);
    } catch (error) {
      next(error);
    }
  })(req, res, next);
}));

// OAuth Signup (for new users)
router.post('/oauth-signup', authController.oauthSignup);

// Email/Password Authentication Routes
router.post('/email-signup', authController.emailSignup);
router.post('/email-login', authController.emailLogin);

// OTP Verification Routes
router.post('/verify-otp', authController.verifyEmailOTP);
router.post('/resend-otp', authController.resendOTP);

// Token & Auth Routes
router.post('/refresh', authController.refreshAccessToken);
router.post('/logout', authenticateToken, authController.logout);
router.get('/check', optionalAuthenticateToken, authController.checkAuth);

module.exports = router;
