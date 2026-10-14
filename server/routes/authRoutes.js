const express = require('express');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController.js');
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/auth.js');
const { asyncHandler } = require('../middleware/errorHandler');
const rbacService = require('../services/rbacService');
const { beginOAuth, oauthSingleUseGuard, privateResponse, rejectCallback, getFrontendUrl, hash, random, validSecret } = require('../middleware/oauthGuard');

const router = express.Router();
const termsController = require('../controllers/termsController');
router.get('/terms/status', authenticateToken, termsController.status);
router.post('/terms/account', authenticateToken, termsController.acceptAccount);
router.post('/terms/checkout', authenticateToken, termsController.acceptCheckout);

// Dedicated rate limiter scoped to the forgot-password route only.
// Prevents abuse/spam of the email-sending endpoint (max 5 requests per IP per hour).
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many password reset requests. Please try again later.',
  },
});

// Helper to generate tokens (import from utils)
const { generateTokens } = require('../utils/generateTokens');
const { pool } = require('../config/database');

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(isProd ? {
      secure: true,
      sameSite: 'none',
      partitioned: true,
    } : {
      secure: false,
      sameSite: 'lax',
    }),
  };
};

// Both route prefixes share the same transaction and code constraints.
router.get('/google', privateResponse, beginOAuth('google'), (req, res, next) => {
  passport.authenticate('google', { scope: ['profile', 'email'], state: req.oauthState, session: false })(req, res, next);
});

router.get('/google/callback', privateResponse, oauthSingleUseGuard('google'), (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user) => {
    try {
      if (err || !user || user.is_active === false || !user.is_verified) return rejectCallback(req, res, 'OAUTH_ERROR');
      // No session is minted here. The initiating tab must redeem the handoff.
      const handoff = random();
      await pool.query(
        "INSERT INTO oauth_handoffs (handoff_hash, client_challenge, user_id, expires_at) VALUES ($1, $2, $3, now() + interval '1 minute')",
        [hash(handoff), req.oauthTransaction.client_challenge, user.user_id]
      );
      return res.redirect(getFrontendUrl() + '/auth/success#handoff=' + handoff);
    } catch (error) {
      // Provider errors may contain tokens, codes or profiles; never log them.
      return rejectCallback(req, res, 'OAUTH_ERROR', 500);
    }
  })(req, res, next);
});

router.post('/oauth/complete', privateResponse, asyncHandler(async (req, res) => {
  const { handoff, verifier } = req.body || {};
  if (!validSecret(handoff) || !validSecret(verifier)) {
    return res.status(400).json({ code: 'OAUTH_TRANSACTION_INVALID' });
  }
  const result = await pool.query(
    'DELETE FROM oauth_handoffs WHERE handoff_hash = $1 AND client_challenge = $2 AND expires_at > now() RETURNING user_id',
    [hash(handoff), hash(verifier)]
  );
  if (!result.rows.length) return res.status(409).json({ code: 'AUTH_CODE_USED' });
  const userId = result.rows[0].user_id;
  const account = await pool.query('SELECT is_active, is_verified FROM users WHERE user_id = $1', [userId]);
  if (!account.rows[0]?.is_active || !account.rows[0]?.is_verified) {
    return res.status(403).json({ code: 'ACCOUNT_UNAVAILABLE' });
  }
  const roleSummary = await rbacService.getUserRoleSummary(userId, false);
  const { accessToken, refreshToken } = await generateTokens(userId, roleSummary.role);
  const options = getCookieOptions();
  res.cookie('accessToken', accessToken, options);
  res.cookie('refreshToken', refreshToken, options);
  return res.json({ data: { accessToken } });
}));

// Email/Password Authentication Routes
router.post('/email-signup', authController.emailSignup);
router.post('/email-login', authController.emailLogin);

// OTP Verification Routes
router.post('/verify-otp', authController.verifyEmailOTP);
router.post('/resend-otp', authController.resendOTP);

// Password Reset Routes
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Token & Auth Routes
router.post('/refresh', authController.refreshAccessToken);
// Revoke the presented session directly; authentication middleware must not renew it first.
router.post('/logout', authController.logout);
router.get('/check', optionalAuthenticateToken, authController.checkAuth);

module.exports = router;
