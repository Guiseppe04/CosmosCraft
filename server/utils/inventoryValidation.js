/**
 * INVENTORY VALIDATION UTILITIES
 * Validates inventory-related requests and data
 */

const { body, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');

// ─── VALIDATION MIDDLEWARE ──────────────────────────────────────────────────

/**
 * Validate stock-in request
 */
exports.validateStockIn = [
  body('productId')
    .isUUID()
    .withMessage('Invalid product ID format'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }
    next();
  }
];

/**
 * Validate stock-out request
 */
exports.validateStockOut = [
  body('productId')
    .isUUID()
    .withMessage('Invalid product ID format'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('referenceType')
    .optional()
    .isIn(['manual', 'pos_sale', 'order', 'return', 'damage'])
    .withMessage('Invalid reference type'),
  body('referenceId')
    .optional()
    .isUUID()
    .withMessage('Invalid reference ID format'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }
    next();
  }
];

/**
 * Validate stock adjustment request
 */
exports.validateAdjustStock = [
  body('productId')
    .isUUID()
    .withMessage('Invalid product ID format'),
  body('quantity')
    .isInt()
    .withMessage('Quantity must be an integer')
    .custom(value => value !== 0)
    .withMessage('Adjustment quantity cannot be zero'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }
    next();
  }
];

/**
 * Validate inventory logs query parameters
 */
exports.validateInventoryLogsQuery = [
  body('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  body('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }
    next();
  }
];

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Check if product ID is valid UUID
 */
exports.isValidProductId = (productId) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(productId);
};

/**
 * Check if quantity is valid positive integer
 */
exports.isValidQuantity = (quantity) => {
  return Number.isInteger(quantity) && quantity > 0;
};

/**
 * Check if decimal value is valid
 */
exports.isValidDecimal = (value, maxDigits = 12, maxDecimals = 2) => {
  const regex = new RegExp(`^\\d{1,${maxDigits - maxDecimals}}(\\.\\d{1,${maxDecimals}})?$`);
  return regex.test(value);
};
