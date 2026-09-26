const jwt = require('jsonwebtoken');
const { generateTokens, verifyRefreshToken } = require('../utils/generateTokens');
const rbacService = require('../services/rbacService');

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

const handleAuth = async (req, res, next, { required }) => {
  try {
    // 1. Extract access token from cookies, Authorization header (Bearer), or x-access-token
    let accessToken = req.cookies?.accessToken;
    if (!accessToken && req.headers?.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        accessToken = parts[1];
      }
    }
    if (!accessToken && req.headers?.['x-access-token']) {
      accessToken = req.headers['x-access-token'];
    }

    // 2. Extract refresh token from cookies, headers, or body
    const refreshToken = req.cookies?.refreshToken || req.headers?.['x-refresh-token'] || req.body?.refreshToken;

    const cookieOptions = getCookieOptions();

    // Helper to attempt refreshing tokens using refreshToken
    const tryRefreshToken = async () => {
      if (!refreshToken) return null;
      try {
        const decoded = await verifyRefreshToken(refreshToken);
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateTokens(decoded.id, decoded.role);

        res.cookie('accessToken', newAccessToken, cookieOptions);
        res.cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.setHeader('X-New-Access-Token', newAccessToken);

        const roleSummary = await rbacService.getUserRoleSummary(decoded.id, false);
        return {
          ...decoded,
          user_id: decoded.id,
          role: roleSummary.role,
          roles: roleSummary.roles || [],
          permissions: roleSummary.permissions || [],
        };
      } catch (refreshErr) {
        return null;
      }
    };

    if (!accessToken) {
      // If access token is not present but refresh token is, try to refresh immediately
      if (refreshToken) {
        const refreshedUser = await tryRefreshToken();
        if (refreshedUser) {
          req.user = refreshedUser;
          return next();
        }
      }

      if (!required) {
        req.user = null;
        return next();
      }

      return res.status(401).json({
        status: 'error',
        message: 'Access token not found. Please sign in.',
      });
    }

    jwt.verify(accessToken, process.env.JWT_SECRET, async (err, user) => {
      if (err) {
        // If token is expired and we have a refresh token, try to refresh
        if (err.name === 'TokenExpiredError' && refreshToken) {
          const refreshedUser = await tryRefreshToken();
          if (refreshedUser) {
            req.user = refreshedUser;
            return next();
          }

          if (!required) {
            req.user = null;
            return next();
          }

          return res.status(401).json({
            status: 'error',
            message: 'Session expired. Please sign in again.',
            code: 'SESSION_EXPIRED',
          });
        } else {
          if (!required) {
            req.user = null;
            return next();
          }

          return res.status(401).json({
            status: 'error',
            message: err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid token',
            code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          });
        }
      } else {
        const roleSummary = await rbacService.getUserRoleSummary(user.id, false);
        req.user = {
          ...user,
          user_id: user.id,
          role: roleSummary.role,
          roles: roleSummary.roles || [],
          permissions: roleSummary.permissions || [],
        };
        next();
      }
    });
  } catch (error) {
    if (!required) {
      req.user = null;
      return next();
    }

    return res.status(500).json({
      status: 'error',
      message: 'Authentication error',
    });
  }
};

const { hasRole } = require('../utils/roles');

const authenticateToken = async (req, res, next) => handleAuth(req, res, next, { required: true });

const optionalAuthenticateToken = async (req, res, next) => handleAuth(req, res, next, { required: false });

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !hasRole(req.user.role, ...allowedRoles)) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions',
      });
    }
    next();
  };
};

module.exports = { authenticateToken, optionalAuthenticateToken, authorize };

