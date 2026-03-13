const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token not found. Please sign in.',
      });
    }

    jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            status: 'error',
            message: 'Access token expired',
            code: 'TOKEN_EXPIRED',
          });
        }
        return res.status(403).json({
          status: 'error',
          message: 'Invalid token',
        });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Authentication error',
    });
  }
};

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

module.exports = { authenticateToken, authorize };