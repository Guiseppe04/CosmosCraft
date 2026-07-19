const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const getAccessTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string') {
    const matches = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
    if (matches) {
      return decodeURIComponent(matches[1]);
    }
  }

  return null;
};

const isAdminRequest = (req) => {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    return false;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded && (decoded.role === 'admin' || decoded.role === 'super_admin');
  } catch (error) {
    return false;
  }
};

const createRateLimiter = (options = {}) => {
  return rateLimit({
    skip: (req, res) => isAdminRequest(req),
    ...options,
  });
};

module.exports = {
  createRateLimiter,
  isAdminRequest,
};
