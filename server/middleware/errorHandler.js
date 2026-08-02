/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Handle PostgreSQL duplicate key errors (e.g., unique email)
  if (err.code === '23505') {
    const fieldMatch = err.detail?.match(/Key \((.*?)\)=/);
    const field = fieldMatch ? fieldMatch[1] : 'Field';
    return res.status(409).json({
      status: 'error',
      message: `${field} already exists. Please use a different ${field}.`,
      errors: [{ field, message: `${field} must be unique` }],
    });
  }

  // Handle PostgreSQL foreign key violations
  if (err.code === '23503') {
    const fieldMatch = err.detail?.match(/Key \((.*?)\)=/);
    const field = fieldMatch ? fieldMatch[1] : 'related field';
    return res.status(400).json({
      status: 'error',
      message: 'A related item was not found. Please check the referenced value and try again.',
      errors: [{ field, message: 'Related record not found' }],
    });
  }

  // Handle PostgreSQL required field (NOT NULL) violations
  if (err.code === '23502') {
    const fieldMatch = err.detail?.match(/null value in column "(.*?)"/);
    const field = fieldMatch ? fieldMatch[1] : 'required field';
    return res.status(400).json({
      status: 'error',
      message: 'A required field is missing. Please provide all required information.',
      errors: [{ field, message: 'This field is required' }],
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Your session is invalid. Please sign in again.',
      errors: [{ field: 'token', message: 'Token verification failed' }],
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Your session has expired. Please sign in again.',
      errors: [{ field: 'token', message: 'Please refresh your token' }],
    });
  }

  // Handle PostgreSQL invalid UUID (CastError equivalent)
  if (err.code === '22P02') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid ID format. Please provide a valid identifier.',
      errors: [{ field: 'id', message: 'The provided ID is invalid' }],
    });
  }

  const normalizedMessage = Array.isArray(err.message)
    ? err.message.join('; ')
    : String(err.message || '');

  const friendlyMessage = normalizedMessage === 'Validation failed'
    ? 'Some fields are invalid. Please check the details below.'
    : normalizedMessage;

  // Handle custom application errors
  if (err.isApplicationError) {
    return res.status(err.statusCode || 400).json({
      status: 'error',
      message: friendlyMessage || 'Something went wrong. Please try again later.',
      errors: err.errors || [],
    });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    status: 'error',
    message: statusCode >= 500
      ? 'Something went wrong. Please try again later.'
      : friendlyMessage || 'Something went wrong. Please try again later.',
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