const jwt = require('jsonwebtoken');
const { generateTokens, verifyRefreshToken } = require('../utils/generateTokens');

const handleAuth = async (req, res, next, { required }) => {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken) {
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
          try {
            const decoded = await verifyRefreshToken(refreshToken);
            // Generate new tokens
            const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateTokens(decoded.id, decoded.role);

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

            // Set new tokens
            res.cookie('accessToken', newAccessToken, cookieOptions);
            res.cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

            // Decode the new token and attach user to request
            jwt.verify(newAccessToken, process.env.JWT_SECRET, (err, decoded) => {
              if (err) {
                return res.status(403).json({
                  status: 'error',
                  message: 'Invalid token',
                });
              }
              req.user = { ...decoded, user_id: decoded.id };
              next();
            });
          } catch (refreshErr) {
            if (!required) {
              req.user = null;
              return next();
            }

            return res.status(401).json({
              status: 'error',
              message: 'Session expired. Please sign in again.',
              code: 'SESSION_EXPIRED',
            });
          }
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
        req.user = { ...user, user_id: user.id };
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

const authenticateToken = async (req, res, next) => handleAuth(req, res, next, { required: true });

const optionalAuthenticateToken = async (req, res, next) => handleAuth(req, res, next, { required: false });

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions',
      });
    }
    next();
  };
};

module.exports = { authenticateToken, optionalAuthenticateToken, authorize };
