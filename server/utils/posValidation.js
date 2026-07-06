/**
 * POS VALIDATION UTILITIES
 * Validates Point of Sale requests and data
 */

const { body, validationResult, param } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');

// ─── VALIDATION MIDDLEWARE ──────────────────────────────────────────────────

/**
 * Validate create sale request
 */
exports.validateCreateSale = [
  body('customerName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 150 })
    .withMessage('Customer name must not exceed 150 characters'),
  body('customerPhone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid phone format'),
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
 * Validate add product item request
 */
exports.validateAddProductItem = [
  param('id')
    .isUUID()
    .withMessage('Invalid sale ID'),
  body('productId')
    .isUUID()
    .withMessage('Invalid product ID format'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('discount')
    .optional()
    .isDecimal({ min: 0 })
    .withMessage('Discount must be non-negative'),
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
 * Validate add service item request
 */
exports.validateAddServiceItem = [
  param('id')
    .isUUID()
    .withMessage('Invalid sale ID'),
  body('serviceId')
    .isInt({ min: 1 })
    .withMessage('Invalid service ID'),
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('discount')
    .optional()
    .isDecimal({ min: 0 })
    .withMessage('Discount must be non-negative'),
  body('notes')
    .optional()
    .isString()
    .trim(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }
    next();
  }
];

/**
 * Validate checkout request
 */
exports.validateCheckout = [
  param('id')
    .isUUID()
    .withMessage('Invalid sale ID'),
  body('paymentMethod')
    .isIn(['cash', 'gcash'])
    .withMessage('Invalid payment method'),
  body('referenceNumber')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference number must not exceed 100 characters'),
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

    const paymentMethod = String(req.body.paymentMethod || '').toLowerCase();
    const referenceNumber = String(req.body.referenceNumber || '').trim();
    if (paymentMethod === 'gcash' && !referenceNumber) {
      return next(new AppError('GCash reference number is required', 400));
    }

    next();
  }
];

/**
 * Validate cancel sale request
 */
exports.validateCancelSale = [
  param('id')
    .isUUID()
    .withMessage('Invalid sale ID'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }
    next();
  }
];

/**
 * Validate update sale info request
 */
exports.validateUpdateSaleInfo = [
  param('id')
    .isUUID()
    .withMessage('Invalid sale ID'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'gcash'])
    .withMessage('Invalid payment method'),
  body('customerName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 150 })
    .withMessage('Customer name must not exceed 150 characters'),
  body('customerPhone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid phone format'),
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
 * Validate remove item request
 */
exports.validateRemoveItem = [
  param('id')
    .isUUID()
    .withMessage('Invalid sale ID'),
  param('itemId')
    .isInt()
    .withMessage('Invalid item ID'),
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
 * Check if payment method is valid
 */
exports.isValidPaymentMethod = (method) => {
  return ['cash', 'gcash'].includes(method);
};

/**
 * Check if price is valid
 */
exports.isValidPrice = (price) => {
  return !isNaN(parseFloat(price)) && parseFloat(price) >= 0;
};

/**
 * Format currency
 */
exports.formatCurrency = (amount) => {
  return parseFloat(amount).toFixed(2);
};

/**
 * Calculate tax (default 12% VAT)
 */
exports.calculateTax = (amount, taxRate = 0.12) => {
  return parseFloat((amount * taxRate).toFixed(2));
};
