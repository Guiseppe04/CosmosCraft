const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { generateTokens, verifyRefreshToken, revokeRefreshToken } = require('../utils/generateTokens');
const { generateOTPWithExpiry, verifyOTP } = require('../utils/otp');
const userService = require('../services/userService');
const mailService = require('../services/mailService');
const { validate, emailSignupSchema, emailLoginSchema, oauthSignupSchema } = require('../utils/validation');

const getFrontendUrl = () => {
  const prodUrl = process.env.FRONTEND_URL_PROD;
  const devUrl = process.env.FRONTEND_URL;

  if (prodUrl) return prodUrl;
  if (devUrl) return devUrl;
  throw new Error('Frontend URL not configured.');
};

exports.googleCallback = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.redirect(`${getFrontendUrl()}/auth/oauth-signup?provider=google&userData=${encodeURIComponent(JSON.stringify(req.authInfo?.oauthData || {}))}`);
  }

  const { accessToken, refreshToken } = await generateTokens(req.user.user_id, req.user.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 15 * 60 * 1000,
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

exports.facebookCallback = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.redirect(`${getFrontendUrl()}/auth/oauth-signup?provider=facebook&userData=${encodeURIComponent(JSON.stringify(req.authInfo?.oauthData || {}))}`);
  }

  const { accessToken, refreshToken } = await generateTokens(req.user.user_id, req.user.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 15 * 60 * 1000,
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

  const { accessToken, refreshToken } = await generateTokens(newUser.user_id, newUser.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 15 * 60 * 1000,
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
      console.error('Failed to send verification email:', mailError);
    }

    const { accessToken, refreshToken } = await generateTokens(newUser.user_id, newUser.role);

    const cookieOptions = {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
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
      data: { user: { id: newUser.user_id, email: newUser.email, is_verified: newUser.is_verified }, accessToken, refreshToken }
    });
  } catch (error) {
    if (error.message.includes('already exists')) throw new AppError('Email address already used.', 409);
    throw new AppError(error.message || 'Signup failed', 400);
  }
});

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

  const { accessToken, refreshToken } = await generateTokens(user.user_id, user.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 15 * 60 * 1000,
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
        role: user.role
      } 
    }
  });
});

exports.refreshAccessToken = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) throw new AppError('Refresh token not found', 401);

  const decoded = await verifyRefreshToken(refreshToken);
  const user = await userService.getUserById(decoded.id);

  const tokens = await generateTokens(user.user_id, user.role);

  const cookieOptions = {
    httpOnly: true,
    maxAge: 15 * 60 * 1000,
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
  const user = await userService.getUserById(req.user.id);
  res.status(200).json({ 
    status: 'success', 
    data: { 
      isAuthenticated: true, 
      user: { 
        id: user.user_id, 
        email: user.email, 
        name: { firstName: user.first_name, lastName: user.last_name },
        avatar: user.avatar_url,
        role: user.role
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
    throw new AppError('Failed to send OTP email', 500);
  }

  res.status(200).json({ status: 'success', message: 'OTP sent to your email' });
});