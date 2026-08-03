const Joi = require('joi');

// ============================================================================
// REUSABLE FIELD SCHEMAS
// ============================================================================

const nameFields = {
  firstName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name must not exceed 50 characters',
      'any.required': 'First name is required',
    }),
  middleName: Joi.string()
    .max(50)
    .optional()
    .allow('')
    .pattern(/^[a-zA-Z\s'-]*$/)
    .messages({
      'string.pattern.base': 'Middle name can only contain letters, spaces, hyphens, and apostrophes',
      'string.max': 'Middle name must not exceed 50 characters',
    }),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'Last name must be at least 2 characters',
      'string.max': 'Last name must not exceed 50 characters',
      'any.required': 'Last name is required',
    }),
};

const addressFields = {
  streetLine1: Joi.string()
    .min(5)
    .max(100)
    .required()
    .trim()
    .messages({
      'string.min': 'Street address must be at least 5 characters',
      'string.max': 'Street address must not exceed 100 characters',
      'any.required': 'Street address line 1 is required',
    }),
  streetLine2: Joi.string()
    .max(100)
    .optional()
    .allow('')
    .trim()
    .messages({
      'string.max': 'Street address line 2 must not exceed 100 characters',
    }),
  city: Joi.string()
    .min(2)
    .max(50)
    .required()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.pattern.base': 'City can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City must not exceed 50 characters',
      'any.required': 'City is required',
    }),
  barangay: Joi.string()
    .min(2)
    .max(80)
    .optional()
    .allow('')
    .trim()
    .messages({
      'string.min': 'Barangay must be at least 2 characters',
      'string.max': 'Barangay must not exceed 80 characters',
    }),
  stateProvince: Joi.string()
    .min(2)
    .max(50)
    .required()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.pattern.base': 'State/Province can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'State/Province must be at least 2 characters',
      'string.max': 'State/Province must not exceed 50 characters',
      'any.required': 'State/Province is required',
    }),
  postalZipCode: Joi.string()
    .min(3)
    .max(20)
    .required()
    .pattern(/^[a-zA-Z0-9\s-]+$/)
    .messages({
      'string.pattern.base': 'Postal code can only contain letters, numbers, spaces, and hyphens',
      'string.min': 'Postal code must be at least 3 characters',
      'string.max': 'Postal code must not exceed 20 characters',
      'any.required': 'Postal code is required',
    }),
  country: Joi.string()
    .length(2)
    .required()
    .pattern(/^[A-Z]{2}$/)
    .uppercase()
    .messages({
      'string.pattern.base': 'Country must be a standard 2-letter ISO code (e.g. US, CA, PH)',
      'string.length': 'Country code must be exactly 2 characters',
      'any.required': 'Country is required',
    }),
  isDefault: Joi.boolean().optional(),
};

// ============================================================================
// VALIDATION SCHEMAS FOR DIFFERENT SCENARIOS
// ============================================================================

// OAuth Signup - Only requires name (other info optional)
exports.oauthSignupSchema = Joi.object({
  firstName: nameFields.firstName,
  middleName: nameFields.middleName,
  lastName: nameFields.lastName,
}).unknown(true);

// Reusable password rule — single source of truth shared by email signup
// and password reset so the rules never drift apart.
const passwordField = Joi.string()
  .min(8)
  .max(64)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,64}$/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password must not exceed 64 characters',
    'string.pattern.base': 'Password must include uppercase, lowercase, and special character',
    'any.required': 'Password is required',
  });

// Forgot Password
exports.forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
});

// Reset Password (POST /auth/reset-password)
exports.resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Reset token is required',
    }),
  newPassword: passwordField,
});

// Email/Password Signup
exports.emailSignupSchema = Joi.object({
  firstName: nameFields.firstName,
  middleName: nameFields.middleName,
  lastName: nameFields.lastName,
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  phone: Joi.string()
    .pattern(/^[\d\s\-\+\(\)]{10,20}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be valid (10-20 digits with optional formatting)',
      'any.required': 'Phone number is required',
    }),
  password: Joi.string()
    .min(8)
    .max(64)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,64}$/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must not exceed 64 characters',
      'string.pattern.base': 'Password must include uppercase, lowercase, and special character',
      'any.required': 'Password is required',
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Confirmation password must match password',
      'any.required': 'Confirmation password is required',
    }),
  address: Joi.object({
    streetLine1: Joi.string()
      .min(5)
      .max(100)
      .required()
      .trim()
      .messages({
        'string.min': 'Street address must be at least 5 characters',
        'string.max': 'Street address must not exceed 100 characters',
        'any.required': 'Street address is required',
      }),
    streetLine2: Joi.string()
      .max(100)
      .optional()
      .allow('')
      .trim()
      .messages({
        'string.max': 'Street address line 2 must not exceed 100 characters',
      }),
    city: Joi.string()
      .min(2)
      .max(50)
      .required()
      .trim()
      .pattern(/^[a-zA-Z\s'-]+$/)
      .messages({
        'string.min': 'City must be at least 2 characters',
        'string.max': 'City must not exceed 50 characters',
        'string.pattern.base': 'City can only contain letters, spaces, hyphens, and apostrophes',
        'any.required': 'City is required',
      }),
    barangay: Joi.string()
      .min(2)
      .max(80)
      .required()
      .trim()
      .messages({
        'string.min': 'Barangay must be at least 2 characters',
        'string.max': 'Barangay must not exceed 80 characters',
        'any.required': 'Barangay is required',
      }),
    stateProvince: Joi.string()
      .min(2)
      .max(50)
      .required()
      .trim()
      .pattern(/^[a-zA-Z\s'-]+$/)
      .messages({
        'string.min': 'State/Province must be at least 2 characters',
        'string.max': 'State/Province must not exceed 50 characters',
        'string.pattern.base': 'State/Province can only contain letters, spaces, hyphens, and apostrophes',
        'any.required': 'State/Province is required',
      }),
    postalZipCode: Joi.string()
      .min(3)
      .max(20)
      .required()
      .trim()
      .pattern(/^[a-zA-Z0-9\s-]+$/)
      .messages({
        'string.min': 'Postal code must be at least 3 characters',
        'string.max': 'Postal code must not exceed 20 characters',
        'string.pattern.base': 'Postal code can only contain letters, numbers, spaces, and hyphens',
        'any.required': 'Postal code is required',
      }),
    country: Joi.string()
      .length(2)
      .required()
      .trim()
      .pattern(/^[A-Z]{2}$/)
      .uppercase()
      .messages({
        'string.length': 'Country code must be exactly 2 characters (ISO)',
        'string.pattern.base': 'Country must be a standard 2-letter ISO code (e.g. US, CA, PH)',
        'any.required': 'Country is required',
      }),
  }).required(),
});

// Email/Password Login
exports.emailLoginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});

// Add/Update Single Address
exports.addAddressSchema = Joi.object({
  label: Joi.string()
    .max(50)
    .optional()
    .trim()
    .messages({
      'string.max': 'Label must not exceed 50 characters',
    }),
  streetLine1: addressFields.streetLine1,
  streetLine2: addressFields.streetLine2,
  city: addressFields.city,
  barangay: addressFields.barangay.when('country', {
    is: 'PH',
    then: addressFields.barangay.required().messages({ 'any.required': 'Barangay is required' }),
    otherwise: addressFields.barangay.optional().allow(''),
  }),
  stateProvince: addressFields.stateProvince,
  postalZipCode: addressFields.postalZipCode,
  country: addressFields.country,
  isDefault: addressFields.isDefault,
});

// Update Address (partial fields allowed)
exports.updateAddressSchema = Joi.object({
  label: Joi.string()
    .max(50)
    .optional()
    .trim()
    .messages({
      'string.max': 'Label must not exceed 50 characters',
    }),
  streetLine1: addressFields.streetLine1.optional(),
  streetLine2: addressFields.streetLine2,
  city: addressFields.city.optional(),
  barangay: addressFields.barangay.optional(),
  stateProvince: addressFields.stateProvince.optional(),
  postalZipCode: addressFields.postalZipCode.optional(),
  country: addressFields.country.optional(),
  isDefault: addressFields.isDefault,
});

// Update Profile (partial name update)
exports.updateProfileSchema = Joi.object({
  firstName: nameFields.firstName.optional(),
  middleName: nameFields.middleName,
  lastName: nameFields.lastName.optional(),
  phone: Joi.string()
    .optional()
    .allow('')
    .pattern(/^[\d\s\-\+\(\)]{10,20}$/)
    .messages({
      'string.pattern.base': 'Phone number must be valid (10-20 digits with optional formatting)',
    }),
  avatarUrl: Joi.string()
    .uri()
    .optional()
    .allow(null, '')
    .messages({
      'string.uri': 'Avatar URL must be a valid URI',
    }),
});

// Update phone (PH mobile format: 09XXXXXXXXX or +639XXXXXXXXX)
exports.updatePhoneSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^(09\d{9}|\+639\d{9})$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be 11 digits starting with 09 or in +63 format (e.g. +639123456789)',
      'any.required': 'Phone number is required',
    }),
});

// Change Password
exports.changePasswordSchema = Joi.object({
  oldPassword: Joi.string()
    .optional()
    .allow(''),
  newPassword: Joi.string()
    .min(8)
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .messages({
      'string.min': 'New password must be at least 8 characters',
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
      'any.required': 'New password is required',
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Confirmation password must match new password',
      'any.required': 'Password confirmation is required',
    }),
});

// Product and category validation
exports.createProductSchema = Joi.object({
  name: Joi.string()
    .max(150)
    .required()
    .trim()
    .messages({
      'string.max': 'Product name must not exceed 150 characters',
      'any.required': 'Product name is required',
    }),
  description: Joi.string()
    .max(2000)
    .optional()
    .allow('')
    .trim()
    .messages({
      'string.max': 'Description must not exceed 2000 characters',
    }),
  price: Joi.number()
    .precision(2)
    .min(0)
    .required()
    .messages({
      'number.base': 'Price must be a number',
      'number.min': 'Price must be at least 0',
      'any.required': 'Price is required',
    }),
  brand: Joi.string()
    .max(100)
    .optional()
    .allow('')
    .trim()
    .messages({
      'string.max': 'Brand must not exceed 100 characters',
    }),
  category_id: Joi.number()
    .integer()
    .required()
    .messages({
      'number.base': 'Category is required',
      'number.integer': 'Category ID must be a valid integer',
      'any.required': 'Category is required',
    }),
  is_active: Joi.boolean().optional(),
  cost_price: Joi.number()
    .precision(2)
    .min(0)
    .optional()
    .messages({
      'number.base': 'Cost price must be a number',
      'number.min': 'Cost price must be at least 0',
    }),
  stock: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Stock must be a number',
      'number.min': 'Stock must be at least 0',
    }),
  low_stock_threshold: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Low stock threshold must be a number',
      'number.min': 'Low stock threshold must be at least 0',
    }),
  image_url: Joi.string()
    .uri()
    .optional()
    .allow('')
    .messages({
      'string.uri': 'Image URL must be a valid URI',
    }),
});

exports.updateProductSchema = Joi.object({
  name: Joi.string()
    .max(150)
    .optional()
    .trim()
    .messages({
      'string.max': 'Product name must not exceed 150 characters',
    }),
  description: Joi.string()
    .max(2000)
    .optional()
    .allow('')
    .trim()
    .messages({
      'string.max': 'Description must not exceed 2000 characters',
    }),
  price: Joi.number()
    .precision(2)
    .min(0)
    .optional()
    .messages({
      'number.base': 'Price must be a number',
      'number.min': 'Price must be at least 0',
    }),
  brand: Joi.string()
    .max(100)
    .optional()
    .allow('')
    .trim()
    .messages({
      'string.max': 'Brand must not exceed 100 characters',
    }),
  category_id: Joi.number()
    .integer()
    .optional()
    .messages({
      'number.base': 'Category ID must be a valid integer',
      'number.integer': 'Category ID must be a valid integer',
    }),
  is_active: Joi.boolean().optional(),
  cost_price: Joi.number()
    .precision(2)
    .min(0)
    .optional()
    .messages({
      'number.base': 'Cost price must be a number',
      'number.min': 'Cost price must be at least 0',
    }),
  stock: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Stock must be a number',
      'number.min': 'Stock must be at least 0',
    }),
  low_stock_threshold: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Low stock threshold must be a number',
      'number.min': 'Low stock threshold must be at least 0',
    }),
  image_url: Joi.string()
    .uri()
    .optional()
    .allow('')
    .messages({
      'string.uri': 'Image URL must be a valid URI',
    }),
});

exports.createCategorySchema = Joi.object({
  name: Joi.string()
    .max(100)
    .required()
    .trim()
    .messages({
      'string.max': 'Category name must not exceed 100 characters',
      'any.required': 'Category name is required',
    }),
  description: Joi.string()
    .optional()
    .allow('', null)
    .trim()
    .messages({
      'string.max': 'Description must not exceed 1000 characters',
    }),
  parent_id: Joi.number().integer().optional().allow(null),
  sort_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
});

exports.updateCategorySchema = Joi.object({
  name: Joi.string()
    .max(100)
    .optional()
    .trim()
    .messages({
      'string.max': 'Category name must not exceed 100 characters',
    }),
  description: Joi.string()
    .optional()
    .allow('', null)
    .trim()
    .messages({
      'string.max': 'Description must not exceed 1000 characters',
    }),
  parent_id: Joi.number().integer().optional().allow(null),
  sort_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
});

exports.createProductImageSchema = Joi.object({
  image_url: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': 'Image URL must be a valid URI',
      'any.required': 'Image URL is required',
    }),
  alt_text: Joi.string().max(200).optional().allow(''),
  sort_order: Joi.number().integer().min(0).optional(),
  is_primary: Joi.boolean().optional(),
});

const uuidParamSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
}).unknown(true);

const projectPartReceiveParamsSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
  partKey: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'Part key is required',
    }),
}).unknown(true);

const orderIdParamSchema = Joi.object({
  orderId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required',
    }),
}).unknown(true);

const createOrderParamSchema = Joi.object({
  orderId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required',
    }),
}).unknown(true);

const namedUuidParamSchema = (paramName) =>
  Joi.object({
    [paramName]: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.guid': `${paramName} must be a valid UUID`,
        'any.required': `${paramName} is required`,
      }),
  }).unknown(true);

const paymentMethodEnum = ['gcash', 'bank_transfer', 'cash'];
const orderStatusEnum = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const orderPaymentStatusEnum = ['pending', 'proof_submitted', 'under_review', 'approved', 'rejected', 'failed'];
const fulfillmentMethods = ['pickup_appointment', 'home_delivery', 'store_pickup', 'courier'];
const notificationTypeEnum = ['order_update', 'appointment_reminder', 'system', 'promotional', 'low_stock'];

exports.createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.string().uuid().optional(),
        customization_id: Joi.string().uuid().optional(),
        productId: Joi.string().optional(),
        customization: Joi.object().optional(),
        quantity: Joi.number().integer().min(1).required(),
        unit_price: Joi.number().precision(2).min(0).optional(),
        price: Joi.number().precision(2).min(0).optional(),
        name: Joi.string().max(255).required(),
        notes: Joi.string().max(500).optional().allow(''),
      }).or('product_id', 'customization_id', 'productId', 'customization')
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one order item is required',
      'any.required': 'Items are required',
    }),
  notes: Joi.string().max(500).optional().allow(''),
  shippingMethod: Joi.string().max(100).required().trim().messages({
    'string.max': 'Shipping method must not exceed 100 characters',
    'any.required': 'Shipping method is required',
  }),
  paymentMethod: Joi.string()
    .valid('gcash', 'bank_transfer')
    .required()
    .messages({
      'any.only': 'Payment method must be gcash or bank_transfer',
      'any.required': 'Payment method is required',
    }),
  shippingAddressId: Joi.string().uuid().optional(),
  billingAddress: Joi.object({
    street: Joi.string().min(5).max(100).required().trim().messages({
      'string.min': 'Address street must be at least 5 characters',
      'string.max': 'Address street must not exceed 100 characters',
      'any.required': 'Billing street address is required',
    }),
    city: Joi.string().min(2).max(50).required().trim().messages({
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City must not exceed 50 characters',
      'any.required': 'City is required',
    }),
    barangay: Joi.string().min(2).max(80).optional().trim().when('country', {
      is: 'PH',
      then: Joi.string().min(2).max(80).required().trim().messages({
        'any.required': 'Barangay is required',
        'string.min': 'Barangay must be at least 2 characters',
        'string.max': 'Barangay must not exceed 80 characters',
      }),
      otherwise: Joi.string().min(2).max(80).optional().allow('').trim().messages({
        'string.min': 'Barangay must be at least 2 characters',
        'string.max': 'Barangay must not exceed 80 characters',
      }),
    }),
    stateProvince: Joi.string().min(2).max(50).required().trim().messages({
      'string.min': 'Province must be at least 2 characters',
      'string.max': 'Province must not exceed 50 characters',
      'any.required': 'Province is required',
    }),
    postalCode: Joi.string().min(3).max(20).required().trim().messages({
      'string.min': 'Postal code must be at least 3 characters',
      'string.max': 'Postal code must not exceed 20 characters',
      'any.required': 'Postal code is required',
    }),
    country: Joi.string().length(2).required().trim().uppercase().messages({
      'string.length': 'Country code must be 2 characters',
      'any.required': 'Country is required',
    }),
  }).required(),
  termsAccepted: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must accept the terms and conditions',
    'any.required': 'Terms acceptance is required',
  }),
  paymentPlan: Joi.string()
    .valid('full_payment', 'installment')
    .default('full_payment')
    .messages({
      'any.only': 'Payment plan must be full_payment or installment',
    }),
  initialPaymentPercentage: Joi.number()
    .precision(2)
    .min(0)
    .max(1)
    .optional()
    .messages({
      'number.min': 'Initial payment percentage must be at least 0',
      'number.max': 'Initial payment percentage must not exceed 1',
    }),
  installmentTenureMonths: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.min': 'Installment tenure must be at least 1 month',
    }),
});

exports.cancelMyOrderSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(200).required().messages({
    'string.min': 'Cancellation reason must be at least 10 characters',
    'string.max': 'Cancellation reason must not exceed 200 characters',
    'any.required': 'Cancellation reason is required',
  }),
});

exports.updatePaymentStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...orderPaymentStatusEnum)
    .required()
    .messages({
      'any.only': `Status must be one of: ${orderPaymentStatusEnum.join(', ')}`,
      'any.required': 'Status is required',
    }),
  reference_number: Joi.string().max(100).optional().trim().allow(''),
  rejection_reason: Joi.string().max(500).optional().trim().allow(''),
  admin_notes: Joi.string().max(500).optional().trim().allow(''),
});

exports.updateOrderSchema = Joi.object({
  status: Joi.string().valid(...orderStatusEnum).optional(),
  payment_status: Joi.string().valid(...orderPaymentStatusEnum).optional(),
  notes: Joi.string().max(1000).optional().allow('').trim(),
  tracking_number: Joi.string().max(100).optional().allow('').trim(),
  courier_name: Joi.string().max(100).optional().allow('').trim(),
  rider_name: Joi.string().max(100).optional().allow('').trim(),
  rider_contact: Joi.string().max(20).optional().allow('').trim(),
}).or('status', 'payment_status', 'notes', 'tracking_number', 'courier_name', 'rider_name', 'rider_contact').messages({
  'object.missing': 'At least one field is required to update the order',
});

exports.orderIdParamSchema = Joi.object({
  orderId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required',
    }),
});

exports.updateShipmentSchema = Joi.object({
  tracking_number: Joi.string().trim().min(5).max(100).required().messages({
    'string.min': 'Tracking number must be at least 5 characters',
    'string.max': 'Tracking number must not exceed 100 characters',
    'any.required': 'Tracking number is required',
  }),
  courier_name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Courier name must be at least 2 characters',
    'string.max': 'Courier name must not exceed 100 characters',
    'any.required': 'Courier name is required',
  }),
  rider_name: Joi.string().trim().max(100).optional().allow(''),
  rider_contact: Joi.string().trim().max(20).optional().allow(''),
});

exports.updateOutForDeliverySchema = Joi.object({
  rider_name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Rider name must be at least 2 characters',
    'string.max': 'Rider name must not exceed 100 characters',
    'any.required': 'Rider name is required',
  }),
  rider_contact: Joi.string().trim().min(7).max(20).required().messages({
    'string.min': 'Rider contact must be at least 7 characters',
    'string.max': 'Rider contact must not exceed 20 characters',
    'any.required': 'Rider contact is required',
  }),
});

exports.createProjectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).required().messages({
    'string.min': 'Project name must be at least 3 characters',
    'string.max': 'Project name must not exceed 150 characters',
    'any.required': 'Project name is required',
  }),
  description: Joi.string().max(1000).optional().allow('').trim(),
  order_id: Joi.string().uuid().required().messages({
    'string.guid': 'Order ID must be a valid UUID',
    'any.required': 'Order ID is required',
  }),
  fulfillment_method: Joi.string().valid(...fulfillmentMethods).optional(),
  status: Joi.string().valid('not_started', 'in_progress', 'completed', 'cancelled').optional(),
});

exports.updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).optional(),
  description: Joi.string().max(1000).optional().allow('').trim(),
  fulfillment_method: Joi.string().valid(...fulfillmentMethods).optional(),
  status: Joi.string().valid('not_started', 'in_progress', 'completed', 'cancelled').optional(),
});

exports.assignTeamSchema = Joi.object({
  user_ids: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
    'array.min': 'At least one team member is required',
    'any.required': 'Team members are required',
  }),
});

exports.submitFulfillmentSchema = Joi.object({
  fulfillment_method: Joi.string().valid(...fulfillmentMethods).required().messages({
    'any.only': `Fulfillment method must be one of: ${fulfillmentMethods.join(', ')}`,
    'any.required': 'Fulfillment method is required',
  }),
  notes: Joi.string().max(500).optional().allow('').trim(),
});

exports.createMilestoneSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).required().messages({
    'string.min': 'Milestone title must be at least 3 characters',
    'string.max': 'Milestone title must not exceed 150 characters',
    'any.required': 'Milestone title is required',
  }),
  due_date: Joi.date().iso().optional(),
  notes: Joi.string().max(500).optional().allow('').trim(),
  status: Joi.string().valid('not_started', 'in_progress', 'completed', 'cancelled').optional(),
});

exports.updateMilestoneSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).optional(),
  due_date: Joi.date().iso().optional(),
  notes: Joi.string().max(500).optional().allow('').trim(),
  status: Joi.string().valid('not_started', 'in_progress', 'completed', 'cancelled').optional(),
});

exports.createSubtaskSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).required().messages({
    'string.min': 'Subtask title must be at least 3 characters',
    'string.max': 'Subtask title must not exceed 150 characters',
    'any.required': 'Subtask title is required',
  }),
  due_date: Joi.date().iso().optional(),
  assigned_to: Joi.string().uuid().optional(),
  notes: Joi.string().max(500).optional().allow('').trim(),
});

exports.updateSubtaskSchema = Joi.object({
  status: Joi.string().valid('not_started', 'in_progress', 'completed', 'cancelled').optional(),
  notes: Joi.string().max(500).optional().allow('').trim(),
});

const builderPartCommonFields = {
  name: Joi.string().trim().min(2).max(150).optional().messages({
    'string.min': 'Part name must be at least 2 characters',
    'string.max': 'Part name must not exceed 150 characters',
  }),
  description: Joi.string().trim().max(2000).optional().allow('', null),
  guitar_type: Joi.string().trim().min(3).max(50).optional().allow('', null),
  part_category: Joi.string().trim().min(1).max(100).optional().allow('', null),
  folder_key: Joi.string().trim().max(120).optional().allow('', null),
  type_mapping: Joi.string().trim().min(1).max(100).optional(),
  price: Joi.number().precision(2).min(0).optional(),
  stock: Joi.number().integer().min(0).optional(),
  image_url: Joi.string().max(2000).optional().allow('', null),
  metadata: Joi.object().optional(),
  is_active: Joi.boolean().optional(),
};

exports.createBuilderPartSchema = Joi.object({
  ...builderPartCommonFields,
  name: Joi.string().trim().min(2).max(150).required().messages({
    'string.min': 'Part name must be at least 2 characters',
    'string.max': 'Part name must not exceed 150 characters',
    'any.required': 'Part name is required',
  }),
  type_mapping: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Type mapping is required',
  }),
  price: Joi.number().precision(2).min(0).optional(),
  stock: Joi.number().integer().min(0).optional(),
});

exports.updateBuilderPartSchema = Joi.object({
  ...builderPartCommonFields,
});

exports.guitarTypeParamSchema = Joi.object({
  guitarType: Joi.string().trim().min(3).max(50).required().messages({
    'any.required': 'Guitar type is required',
    'string.min': 'Guitar type must be at least 3 characters',
    'string.max': 'Guitar type must not exceed 50 characters',
  }),
  modelKey: Joi.string().trim().min(1).max(150).required().messages({
    'any.required': 'Model key is required',
    'string.min': 'Model key must be at least 1 character',
    'string.max': 'Model key must not exceed 150 characters',
  }),
});

exports.guitarTypeRequestSchema = Joi.object({
  guitarType: Joi.string().trim().min(3).max(50).required().messages({
    'any.required': 'Guitar type is required',
    'string.min': 'Guitar type must be at least 3 characters',
    'string.max': 'Guitar type must not exceed 50 characters',
  }),
});

exports.upsertModelImageSchema = Joi.object({
  display_name: Joi.string().trim().max(150).optional().allow(''),
  image_url: Joi.string().uri().optional().allow('', null).messages({
    'string.uri': 'Image URL must be a valid URI',
  }),
});

exports.createNotificationSchema = Joi.object({
  user_id: Joi.string().uuid().required().messages({
    'string.guid': 'User ID must be a valid UUID',
    'any.required': 'User ID is required',
  }),
  type: Joi.string().valid(...notificationTypeEnum).required().messages({
    'any.only': `Notification type must be one of: ${notificationTypeEnum.join(', ')}`,
    'any.required': 'Notification type is required',
  }),
  title: Joi.string().trim().min(3).max(200).required().messages({
    'string.min': 'Title must be at least 3 characters',
    'string.max': 'Title must not exceed 200 characters',
    'any.required': 'Title is required',
  }),
  body: Joi.string().trim().min(3).max(1000).required().messages({
    'string.min': 'Body must be at least 3 characters',
    'string.max': 'Body must not exceed 1000 characters',
    'any.required': 'Body is required',
  }),
  related_entity_type: Joi.string().max(100).optional().allow(''),
  related_entity_id: Joi.string().uuid().optional().allow('', null).messages({
    'string.guid': 'Related entity ID must be a valid UUID',
  }),
});

exports.createBatchNotificationSchema = Joi.object({
  notifications: Joi.array().items(exports.createNotificationSchema).min(1).required().messages({
    'array.min': 'At least one notification is required',
    'any.required': 'Notifications are required',
  }),
});

const buildValidationMiddleware = (schema, source) => {
  if (!schema || typeof schema.validate !== 'function') {
    // Defensive: ensure callers passed a valid Joi schema to avoid hard-to-debug runtime TypeErrors
    throw new Error('Invalid or missing validation schema supplied to validation middleware');
  }

  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        status: 'error',
        message: 'Some fields are invalid. Please check the details below.',
        errors,
      });
    }

    if (source === 'body') req.validatedData = value;
    if (source === 'query') req.validatedQuery = value;
    if (source === 'params') req.validatedParams = value;

    next();
  };
};

exports.validateBody = (schema) => buildValidationMiddleware(schema, 'body');
exports.validateQuery = (schema) => buildValidationMiddleware(schema, 'query');
exports.validateParams = (schema) => buildValidationMiddleware(schema, 'params');
// Flexible validate helper: accepts (schema) or (schema, source) where source is 'body'|'query'|'params'
exports.validate = (schema, source = 'body') => buildValidationMiddleware(schema, source);
exports.projectPartReceiveParamsSchema = projectPartReceiveParamsSchema;
exports.saveDefaultWorkflowSchema = Joi.object({
  steps: Joi.array().min(1).required().items(
    Joi.object({
      step_name: Joi.string().trim().min(1).max(200).required().messages({
        'string.empty': 'Step name is required',
        'any.required': 'Step name is required',
      }),
      sort_order: Joi.number().integer().min(0).optional(),
      tasks: Joi.array().items(
        Joi.object({
          task_name: Joi.string().trim().min(1).max(200).required().messages({
            'string.empty': 'Task name is required',
            'any.required': 'Task name is required',
          }),
          sort_order: Joi.number().integer().min(0).optional(),
        })
      ).optional(),
    })
  ).messages({
    'array.min': 'At least one step is required',
  }),
});

const listOrdersSchema = Joi.object({
  search: Joi.string().max(100).optional().allow('').trim(),
  order_type: Joi.string().valid('product', 'customization', 'service').optional(),
  status: Joi.string().valid(
    'pending',
    'processing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled'
  ).optional(),
  payment_status: Joi.string().valid(
    'pending',
    'proof_submitted',
    'under_review',
    'approved',
    'rejected',
    'failed'
  ).optional(),
  date_from: Joi.string().isoDate().optional(),
  date_to: Joi.string().isoDate().optional(),
  payment_method: Joi.string().valid('gcash', 'bank_transfer', 'cash').optional(),
  sort_by: Joi.string().valid(
    'created_at',
    'order_number',
    'total_amount',
    'status',
    'payment_status',
    'customer_name'
  ).optional(),
  sort_dir: Joi.string().valid('asc', 'desc').optional(),
  page: Joi.number().integer().min(1).optional(),
  page_size: Joi.number().integer().min(1).max(100).optional(),
  include_items: Joi.alternatives().try(Joi.string(), Joi.boolean()).optional(),
}).unknown(true);

exports.listOrdersSchema = listOrdersSchema;
exports.orderIdParamSchema = orderIdParamSchema;
exports.uuidParamSchema = uuidParamSchema;
exports.namedUuidParamSchema = namedUuidParamSchema;

const listProjectsSchema = Joi.object({
  search: Joi.string().max(100).optional().allow('').trim(),
  status: Joi.string().valid(
    'not_started',
    'in_progress',
    'completed',
    'cancelled'
  ).optional(),
  assigned_to: Joi.string().uuid().optional().allow('', null),
  guitar_type: Joi.string().trim().min(2).max(80).optional().allow(''),
  date_from: Joi.string().isoDate().optional(),
  date_to: Joi.string().isoDate().optional(),
  due_date_from: Joi.string().isoDate().optional(),
  due_date_to: Joi.string().isoDate().optional(),
  completion_percentage: Joi.alternatives().try(Joi.number().integer().min(0).max(100), Joi.string()).optional().allow(''),
  sort_by: Joi.string().valid(
    'updated_at',
    'created_at',
    'project_name',
    'customer_name',
    'progress',
    'estimated_completion_date',
    'status'
  ).optional(),
  sort_dir: Joi.string().valid('asc', 'desc').optional(),
  page: Joi.number().integer().min(1).optional(),
  page_size: Joi.number().integer().min(1).max(100).optional(),
  include_tasks: Joi.alternatives().try(Joi.string(), Joi.boolean()).optional(),
}).unknown(true);

exports.listProjectsSchema = listProjectsSchema;
