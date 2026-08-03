const crypto = require('crypto');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { generateTokens, verifyRefreshToken, revokeRefreshToken } = require('../utils/generateTokens');
const { generateOTPWithExpiry, verifyOTP } = require('../utils/otp');
const userService = require('../services/userService');
const rbacService = require('../services/rbacService');
const mailService = require('../services/mailService');
const { pool } = require('../config/database');
const {
  validate,
  emailSignupSchema,
  emailLoginSchema,
  oauthSignupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../utils/validation');

const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.FRONTEND_URL_PROD) return process.env.FRONTEND_URL_PROD;
    if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  } else {
    if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
    if (process.env.FRONTEND_URL_PROD) return process.env.FRONTEND_URL_PROD;
  }
  throw new Error('Frontend URL not configured.');
};

// Google Callback
exports.googleCallback = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.redirect(`${getFrontendUrl()}/auth/oauth-signup?provider=google&userData=${encodeURIComponent(JSON.stringify(req.authInfo?.oauthData || {}))}`);
  }

  const roleSummary = await rbacService.getUserRoleSummary(req.user.user_id, false);
  const { accessToken, refreshToken } = await generateTokens(req.user.user_id, roleSummary.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(process.env.NODE_ENV === 'production' ? {
      secure: true,
      sameSite: 'none'
    } : {
      secure: false,
      sameSite: 'lax'
    })
  };

  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return res.redirect(`${getFrontendUrl()}/auth/success?userId=${req.user.user_id}&provider=google`);
});
// Facebook Callback
exports.facebookCallback = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.redirect(`${getFrontendUrl()}/auth/oauth-signup?provider=facebook&userData=${encodeURIComponent(JSON.stringify(req.authInfo?.oauthData || {}))}`);
  }

  const roleSummary = await rbacService.getUserRoleSummary(req.user.user_id, false);
  const { accessToken, refreshToken } = await generateTokens(req.user.user_id, roleSummary.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(process.env.NODE_ENV === 'production' ? {
      secure: true,
      sameSite: 'none'
    } : {
      secure: false,
      sameSite: 'lax'
    })
  };

  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return res.redirect(`${getFrontendUrl()}/auth/success?userId=${req.user.user_id}&provider=facebook`);
});

// OAuth Signup(for new users)
exports.oauthSignup = asyncHandler(async (req, res, next) => {
  const { provider, googleId, facebookId, email, firstName, middleName, lastName } = req.body;

  if (!['google', 'facebook'].includes(provider)) throw new AppError('Provider must be google or facebook', 400);

  const userData = { firstName, middleName, lastName };
  const { error } = oauthSignupSchema.validate(userData, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({ field: detail.path.join('.'), message: detail.message }));
    throw new AppError('Validation failed', 400, errors);
  }

  const newUser = await userService.createOAuthUser({
    provider,
    googleId: provider === 'google' ? googleId : undefined,
    facebookId: provider === 'facebook' ? facebookId : undefined,
    email,
    firstName,
    middleName: middleName || '',
    lastName,
  });

  const roleSummary = await rbacService.getUserRoleSummary(newUser.user_id, false);
  const { accessToken, refreshToken } = await generateTokens(newUser.user_id, roleSummary.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(process.env.NODE_ENV === 'production' ? {
      secure: true,
      sameSite: 'none'
    } : {
      secure: false,
      sameSite: 'lax'
    })
  };

  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.status(201).json({
    status: 'success', message: 'OAuth signup successful',
    data: { user: { id: newUser.user_id, email: newUser.email, name: `${newUser.first_name} ${newUser.last_name}` } }
  });
});
// Email Signup
exports.emailSignup = asyncHandler(async (req, res, next) => {
  const { error, value } = emailSignupSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({ field: detail.path.join('.'), message: detail.message }));
    throw new AppError('Validation failed', 400, errors);
  }

  try {
    const newUser = await userService.createEmailUser(value);

    const { code: otp, expiresAt: otpExpires } = generateOTPWithExpiry(15);
    await userService.saveOTP(newUser.user_id, otp, otpExpires, 'signup');

    try {
      await mailService.sendVerificationEmail(newUser.email, otp);
    } catch (mailError) {
      console.error('Failed to send verification email to', newUser.email, ':', mailError.message || mailError);
    }

    const roleSummary = await rbacService.getUserRoleSummary(newUser.user_id, false);
    const { accessToken, refreshToken } = await generateTokens(newUser.user_id, roleSummary.role);

    const cookieOptions = {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...(process.env.NODE_ENV === 'production' ? {
        secure: true,
        sameSite: 'none'
      } : {
        secure: false,
        sameSite: 'lax'
      })
    };

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.status(201).json({
      status: 'success', message: 'Signup successful. Please check your email for the verification code.',
      data: { user: { id: newUser.user_id, email: newUser.email, is_verified: newUser.is_verified } }
    });
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      throw new AppError('An account with this email already exists.', 409, [], 'EMAIL_EXISTS');
    }
    throw new AppError(error.message || 'Signup failed', 400);
  }
});
// Email Login
exports.emailLogin = asyncHandler(async (req, res, next) => {
  const { error, value } = emailLoginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({ field: detail.path.join('.'), message: detail.message }));
    throw new AppError('Validation failed', 400, errors);
  }

  const user = await userService.getUserByEmail(value.email.toLowerCase());
  if (!user) throw new AppError('Invalid email or password', 401);

  if (!user.is_active) throw new AppError('Account is deactivated. Please contact support.', 403);

  let isPasswordValid = false;
  try {
    isPasswordValid = await userService.verifyPassword(user.user_id, value.password);
  } catch (passError) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!isPasswordValid) throw new AppError('Invalid email or password', 401);

  // Require email verification before allowing login
  if (!user.is_verified) {
    return res.status(403).json({
      status: 'error',
      message: 'Please verify your email before logging in.',
      code: 'EMAIL_NOT_VERIFIED',
      data: { emailVerified: false }
    });
  }

  const roleSummary = await rbacService.getUserRoleSummary(user.user_id, false);
  const { accessToken, refreshToken } = await generateTokens(user.user_id, roleSummary.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(process.env.NODE_ENV === 'production' ? {
      secure: true,
      sameSite: 'none'
    } : {
      secure: false,
      sameSite: 'lax'
    })
  };

  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.status(200).json({
    status: 'success', message: 'Login successful',
    data: { 
      user: { 
        id: user.user_id, 
        email: user.email, 
        name: { firstName: user.first_name, lastName: user.last_name },
        avatar: user.avatar_url,
        role: roleSummary.role
      } 
    }
  });
});

exports.refreshAccessToken = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) throw new AppError('Refresh token not found', 401);

  const decoded = await verifyRefreshToken(refreshToken);
  const user = await userService.getUserById(decoded.id);

  const roleSummary = await rbacService.getUserRoleSummary(user.user_id, false);
  const tokens = await generateTokens(user.user_id, roleSummary.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(process.env.NODE_ENV === 'production' ? {
      secure: true,
      sameSite: 'none'
    } : {
      secure: false,
      sameSite: 'lax'
    })
  };

  res.cookie('accessToken', tokens.accessToken, cookieOptions);
  res.cookie('refreshToken', tokens.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.status(200).json({ status: 'success', message: 'Token refreshed' });
});

exports.logout = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

exports.checkAuth = asyncHandler(async (req, res, next) => {
  if (!req.user?.id) {
    return res.status(200).json({
      status: 'success',
      data: {
        isAuthenticated: false,
        user: null,
      }
    });
  }

  const user = await userService.getUserById(req.user.id);
  const authInfo = await userService.getUserAuthInfo(req.user.id);
  const roleSummary = await rbacService.getUserRoleSummary(user.user_id, false);
  res.status(200).json({ 
    status: 'success', 
    data: { 
      isAuthenticated: true, 
      user: { 
        id: user.user_id, 
        email: user.email, 
        name: { firstName: user.first_name, lastName: user.last_name },
        avatar: user.avatar_url,
        role: roleSummary.role || user.role,
        provider: authInfo.provider,
        identityProviders: authInfo.identity_providers || [],
        hasLocalPassword: authInfo.has_local_password,
      } 
    } 
  });
});

exports.verifyEmailOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) throw new AppError('Email and OTP are required', 400);

  const user = await userService.getUserByEmail(email);
  if (!user) throw new AppError('User not found', 404);

  if (user.is_verified) return res.status(200).json({ status: 'success', message: 'Email is already verified', data: { emailVerified: true } });

  const isValidOTP = await userService.verifyAndConsumeOTP(user.user_id, otp, 'signup');
  if (!isValidOTP) throw new AppError('Invalid or expired OTP', 401);

  await userService.markEmailVerified(user.user_id);
  res.status(200).json({ status: 'success', message: 'Email verified successfully', data: { emailVerified: true } });
});

exports.resendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email) throw new AppError('Email is required', 400);

  const user = await userService.getUserByEmail(email);
  if (!user) throw new AppError('User not found', 404);

  if (user.is_verified) return res.status(200).json({ status: 'success', message: 'Email is already verified', data: { emailVerified: true } });

  const { code: otp, expiresAt: otpExpires } = generateOTPWithExpiry(15);
  await userService.saveOTP(user.user_id, otp, otpExpires, 'signup');

  try {
    await mailService.sendVerificationEmail(user.email, otp);
  } catch (mailError) {
    console.error('Failed to send OTP:', mailError);
    throw new AppError('Unable to send verification email. Please try again later.', 502, [], 'EMAIL_SEND_FAILED');
  }

  res.status(200).json({ status: 'success', message: 'OTP sent to your email' });
});

// Forgot Password (POST /auth/forgot-password)
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { error, value } = forgotPasswordSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({ field: detail.path.join('.'), message: detail.message }));
    throw new AppError('Validation failed', 400, errors);
  }

  const GENERIC_RESPONSE = 'If an account exists for this email, a reset link has been sent.';
  // Artificial delay applied on paths that don't perform a real email send so the
  // response timing stays consistent and doesn't leak whether the email exists.
  const MIMIC_EMAIL_SEND_DELAY_MS = 500;

  try {
    const user = await userService.getUserByEmail(value.email.toLowerCase());

    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, MIMIC_EMAIL_SEND_DELAY_MS));
      return res.status(200).json({ status: 'success', message: GENERIC_RESPONSE });
    }

    // OAuth-only accounts have no password and cannot use this flow. mailService only
    // exposes password-reset / password-change templates, so we intentionally skip
    // sending rather than inventing a new template. (Tradeoff: these users receive no
    // email; a dedicated "sign in with Google/Facebook" template would avoid confusion.)
    if (!user.password_hash) {
      await new Promise((resolve) => setTimeout(resolve, MIMIC_EMAIL_SEND_DELAY_MS));
      return res.status(200).json({ status: 'success', message: GENERIC_RESPONSE });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any previous unused tokens so only one active token exists per user.
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
      [user.user_id]
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.user_id, tokenHash, expiresAt]
    );

    const resetLink = `${getFrontendUrl()}/reset-password?token=${rawToken}`;
    await mailService.sendPasswordResetEmail(user.email, resetLink);

    return res.status(200).json({ status: 'success', message: GENERIC_RESPONSE });
  } catch (err) {
    // Log server-side for debugging, but never leak details that could aid enumeration.
    console.error('[forgotPassword] Error:', err);
    return res.status(200).json({ status: 'success', message: GENERIC_RESPONSE });
  }
});

// Reset Password (POST /auth/reset-password)
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { error, value } = resetPasswordSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({ field: detail.path.join('.'), message: detail.message }));
    throw new AppError('Validation failed', 400, errors);
  }

  const INVALID_OR_EXPIRED = 'This reset link is invalid or has expired. Please request a new one.';

  const tokenHash = crypto.createHash('sha256').update(value.token).digest('hex');

  const tokenRes = await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token_hash = $1',
    [tokenHash]
  );
  const tokenRecord = tokenRes.rows[0];

  if (!tokenRecord || tokenRecord.used_at || new Date(tokenRecord.expires_at) < new Date()) {
    throw new AppError(INVALID_OR_EXPIRED, 400);
  }

  const userRes = await pool.query(
    'SELECT email FROM users WHERE user_id = $1',
    [tokenRecord.user_id]
  );
  if (userRes.rows.length === 0) {
    throw new AppError(INVALID_OR_EXPIRED, 400);
  }
  const userEmail = userRes.rows[0].email;

  // Reuse the same bcrypt hashing / update used by email-signup and change-password
  // (userService.setPassword → bcrypt.hash(password, 12)).
  await userService.setPassword(tokenRecord.user_id, value.newPassword);

  // Mark this token consumed and invalidate any other outstanding tokens for the user.
  await pool.query(
    'UPDATE password_reset_tokens SET used_at = now() WHERE token_id = $1',
    [tokenRecord.token_id]
  );
  await pool.query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
    [tokenRecord.user_id]
  );

  // Revoke all existing refresh sessions so old devices get logged out after a reset.
  await pool.query(
    'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
    [tokenRecord.user_id]
  );

  // Notify the user in case they didn't initiate the change.
  try {
    const frontendUrl = getFrontendUrl();
    await mailService.sendPasswordChangeConfirmationEmail(userEmail, `${frontendUrl}/login`);
  } catch (mailError) {
    console.error('Failed to send password change confirmation email:', mailError);
  }

  return res.status(200).json({
    status: 'success',
    message: 'Password updated successfully. Please sign in with your new password.',
    data: { redirectTo: '/login' },
  });
});
