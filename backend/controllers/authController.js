const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { generateTokens, verifyRefreshToken, revokeRefreshToken } = require('../utils/generateTokens');
const userService = require('../services/userService');
const { validate, emailSignupSchema, emailLoginSchema, oauthSignupSchema } = require('../utils/validation');

/**
 * OAuth Google Callback
 * User already exists: Log them in
 * User doesn't exist: Redirect to signup with OAuth data
 */
exports.googleCallback = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    // User doesn't exist - return OAuth data for frontend to complete signup
    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/oauth-signup?provider=google&userData=${encodeURIComponent(
        JSON.stringify(req.authInfo?.oauthData || {})
      )}`
    );
  }

  // User exists - log them in
  const { accessToken, refreshToken } = await generateTokens(req.user._id, req.user.role);

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
    `${process.env.FRONTEND_URL}/auth/success?userId=${req.user._id}&provider=google&isProfileComplete=${req.user.isProfileComplete}`
  );
});

/**
 * OAuth Facebook Callback
 */
exports.facebookCallback = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    // User doesn't exist - return OAuth data for frontend to complete signup
    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/oauth-signup?provider=facebook&userData=${encodeURIComponent(
        JSON.stringify(req.authInfo?.oauthData || {})
      )}`
    );
  }

  // User exists - log them in
  const { accessToken, refreshToken } = await generateTokens(req.user._id, req.user.role);

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
    `${process.env.FRONTEND_URL}/auth/success?userId=${req.user._id}&provider=facebook&isProfileComplete=${req.user.isProfileComplete}`
  );
});

/**
 * OAuth Signup - Complete registration with OAuth data
 * @body {string} provider - 'google' or 'facebook'
 * @body {string} firstName
 * @body {string} middleName
 * @body {string} lastName
 * @body {string} googleId or facebookId
 * @body {string} email
 */
exports.oauthSignup = asyncHandler(async (req, res, next) => {
  const { provider, googleId, facebookId, email, firstName, middleName, lastName } = req.body;

  if (!['google', 'facebook'].includes(provider)) {
    throw new AppError('Provider must be google or facebook', 400);
  }

  // Validate OAuth data
  const userData = {
    firstName,
    middleName,
    lastName,
  };

  const { error } = oauthSignupSchema.validate(userData, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    throw new AppError('Validation failed', 400, errors);
  }

  // Create user with OAuth data
  const newUser = await userService.createOAuthUser({
    provider,
    googleId: provider === 'google' ? googleId : undefined,
    facebookId: provider === 'facebook' ? facebookId : undefined,
    email,
    firstName,
    middleName: middleName || '',
    lastName,
  });

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokens(newUser._id, newUser.role);

  // Set cookies
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

  res.status(201).json({
    status: 'success',
    message: 'OAuth signup successful',
    data: {
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        providers: newUser.providers,
        isProfileComplete: newUser.isProfileComplete,
      },
    },
  });
});

/**
 * Email/Password Signup
 */
exports.emailSignup = asyncHandler(async (req, res, next) => {
  // Validate input
  const { error, value } = emailSignupSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    throw new AppError('Validation failed', 400, errors);
  }

  // Create user
  const newUser = await userService.createEmailUser(value);

  res.status(201).json({
    status: 'success',
    message: 'Signup successful. Please verify your email.',
    data: {
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        emailVerified: newUser.emailVerified,
      },
    },
  });
});

/**
 * Email/Password Login
 */
exports.emailLogin = asyncHandler(async (req, res, next) => {
  // Validate input
  const { error, value } = emailLoginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    throw new AppError('Validation failed', 400, errors);
  }

  // Find user
  const user = await userService.getUserByEmail(value.email);
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if user has password auth
  if (!user.password) {
    throw new AppError('This account does not use password authentication', 400);
  }

  // Verify password
  const isPasswordValid = await userService.verifyPassword(user._id, value.password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403);
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokens(user._id, user.role);

  // Set cookies
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

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        providers: user.providers,
        isProfileComplete: user.isProfileComplete,
      },
    },
  });
});

/**
 * Refresh Access Token
 */
exports.refreshAccessToken = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    throw new AppError('Refresh token not found', 401);
  }

  const decoded = await verifyRefreshToken(refreshToken);
  const user = await userService.getUserById(decoded.id);

  const tokens = await generateTokens(user._id, user.role);

  res.cookie('accessToken', tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    status: 'success',
    message: 'Token refreshed',
  });
});

/**
 * Logout
 */
exports.logout = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

/**
 * Check Authentication Status
 */
exports.checkAuth = asyncHandler(async (req, res, next) => {
  const user = await userService.getUserById(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      isAuthenticated: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        providers: user.providers,
        role: user.role,
        isProfileComplete: user.isProfileComplete,
        addresses: user.addresses,
      },
    },
  });
});