/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Handle PostgreSQL duplicate key errors (e.g., unique email)
  if (err.code === '23505') {
    const fieldMatch = err.detail.match(/Key \((.*?)\)=/);
    const field = fieldMatch ? fieldMatch[1] : 'Field';
    return res.status(409).json({
      status: 'error',
      message: `${field} already exists. Please use a different ${field}.`,
      errors: [{ field, message: `${field} must be unique` }],
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token',
      errors: [{ field: 'token', message: 'Token verification failed' }],
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token has expired',
      errors: [{ field: 'token', message: 'Please refresh your token' }],
    });
  }

  // Handle PostgreSQL invalid UUID (CastError equivalent)
  if (err.code === '22P02') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid ID format',
      errors: [{ field: 'id', message: 'The provided ID is invalid' }],
    });
  }

  // Handle custom application errors
  if (err.isApplicationError) {
    return res.status(err.statusCode || 400).json({
      status: 'error',
      message: err.message,
      errors: err.errors || [],
    });
  }

  // Handle generic errors
  return res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Not Found middleware
 */
const notFound = (req, res) => {
  return res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

/**
 * Custom application error class
 */
class AppError extends Error {
  constructor(message, statusCode = 400, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isApplicationError = true;
  }
}

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFound,
  AppError,
  asyncHandler,
};