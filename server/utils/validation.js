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
  bio: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Bio must not exceed 500 characters',
    }),
  birthDate: Joi.date()
    .iso()
    .optional()
    .allow(null, '')
    .messages({
      'date.format': 'Birth date must be a valid ISO date',
    }),
  avatarUrl: Joi.string()
    .uri()
    .optional()
    .allow(null, '')
    .messages({
      'string.uri': 'Avatar URL must be a valid URI',
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

// ============================================================================
// MIDDLEWARE VALIDATORS
// ============================================================================

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
exports.validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
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
        message: 'Validation failed',
        errors,
      });
    }

    req.validatedData = value;
    next();
  };
};
