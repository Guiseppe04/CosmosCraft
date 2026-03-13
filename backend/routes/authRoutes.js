const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController.js');
const { authenticateToken } = require('../middleware/auth.js');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Helper to generate tokens (import from utils)
const { generateTokens } = require('../utils/generateTokens');

// OAuth Routes - Use standard Passport middleware
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google Callback - use custom callback to capture info object
router.get(
  '/google/callback',
  asyncHandler(async (req, res, next) => {
    passport.authenticate('google', { session: false }, async (err, user, info) => {
      try {
        if (err) {
          return res.status(500).json({ status: 'error', message: 'Authentication error', error: err.message });
        }
        
        if (!user) {
          // New user - redirect to signup with OAuth data
          return res.redirect(
            `${process.env.FRONTEND_URL}/auth/oauth-signup?provider=google&userData=${encodeURIComponent(
              JSON.stringify(info?.oauthData || {})
            )}`
          );
        }

        // Existing user - generate tokens
        const { accessToken, refreshToken } = await generateTokens(user._id, user.role);

        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000,
        });

        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/success?userId=${user._id}&provider=google&isProfileComplete=${user.isProfileComplete}`
        );
      } catch (error) {
        next(error);
      }
    })(req, res, next);
  })
);

// Facebook - Use standard Passport middleware
router.get(
  '/facebook',
  passport.authenticate('facebook', { scope: ['public_profile', 'email'] })
);

// Facebook Callback - use custom callback to capture info object
router.get(
  '/facebook/callback',
  asyncHandler(async (req, res, next) => {
    console.log('Facebook callback received');
    passport.authenticate('facebook', { session: false }, async (err, user, info) => {
      try {
        if (err) {
          return res.status(500).json({ status: 'error', message: 'Authentication error', error: err.message });
        }
        
        if (!user) {
          // New user - redirect to signup with OAuth data
          return res.redirect(
            `${process.env.FRONTEND_URL}/auth/oauth-signup?provider=facebook&userData=${encodeURIComponent(
              JSON.stringify(info?.oauthData || {})
            )}`
          );
        }

        // Existing user - generate tokens
        const { accessToken, refreshToken } = await generateTokens(user._id, user.role);

        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000,
        });

        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/success?userId=${user._id}&provider=facebook&isProfileComplete=${user.isProfileComplete}`
        );
      } catch (error) {
        next(error);
      }
    })(req, res, next);
  })
);

// OAuth Signup (for new users)
router.post('/oauth-signup', authController.oauthSignup);

// Email/Password Authentication Routes
router.post('/email-signup', authController.emailSignup);
router.post('/email-login', authController.emailLogin);

// Token & Auth Routes
router.post('/refresh', authController.refreshAccessToken);
router.post('/logout', authenticateToken, authController.logout);
router.get('/check', authenticateToken, authController.checkAuth);

module.exports = router;