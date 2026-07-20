/**
 * Service Validation Schemas
 * Add to existing server/utils/validation.js file
 */

const Joi = require('joi');

// ============================================================================
// SERVICE VALIDATION SCHEMAS
// ============================================================================

const serviceValidation = {
  // Create/Update Service
  createServiceSchema: Joi.object({
    name: Joi.string()
      .min(5)
      .max(150)
      .required()
      .trim()
      .messages({
        'string.min': 'Service name must be at least 5 characters',
        'string.max': 'Service name cannot exceed 150 characters',
        'any.required': 'Service name is required',
      }),
    description: Joi.string()
      .max(1000)
      .optional()
      .allow('')
      .trim()
      .messages({
        'string.max': 'Description cannot exceed 1000 characters',
      }),
    price: Joi.number()
      .min(0)
      .max(99999.99)
      .required()
      .precision(2)
      .messages({
        'number.min': 'Price must be 0 or greater',
        'number.max': 'Price cannot exceed 99,999.99',
        'any.required': 'Price is required',
      }),
    duration_minutes: Joi.number()
      .integer()
      .min(5)
      .max(1440)
      .required()
      .messages({
        'number.min': 'Duration must be at least 5 minutes',
        'number.max': 'Duration cannot exceed 1440 minutes (24 hours)',
        'any.required': 'Duration is required',
      }),
  }),

  updateServiceSchema: Joi.object({
    name: Joi.string()
      .min(5)
      .max(150)
      .optional()
      .trim(),
    description: Joi.string()
      .max(1000)
      .optional()
      .allow('')
      .trim(),
    price: Joi.number()
      .min(0)
      .max(99999.99)
      .optional()
      .precision(2),
    duration_minutes: Joi.number()
      .integer()
      .min(5)
      .max(1440)
      .optional(),
    is_active: Joi.boolean().optional(),
  }),

  // Create Appointment
  createAppointmentSchema: Joi.object({
    service_id: Joi.number()
      .integer()
      .required()
      .messages({
        'any.required': 'Service ID is required',
        'number.base': 'Service ID must be a number',
      }),
    scheduled_at: Joi.date()
      .iso()
      .required()
      .min('now')
      .messages({
        'any.required': 'Scheduled date/time is required',
        'date.base': 'Invalid date format. Use ISO 8601 (YYYY-MM-DDTHH:mm:ss)',
        'date.min': 'Cannot schedule appointments in the past',
      }),
    notes: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .trim()
      .messages({
        'string.max': 'Notes cannot exceed 500 characters',
      }),
  }).required(),

  // Update Appointment
  updateAppointmentSchema: Joi.object({
    scheduled_at: Joi.date()
      .iso()
      .optional()
      .min('now'),
    status: Joi.string()
      .valid('pending', 'approved', 'completed', 'cancelled')
      .optional()
      .messages({
        'any.only': 'Status must be one of: pending, approved, completed, cancelled',
      }),
    notes: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .trim(),
  }),

  // Filter Queries
  listServicesSchema: Joi.object({
    is_active: Joi.boolean().optional(),
    search: Joi.string().max(100).optional().trim(),
    sort: Joi.string().valid('name', 'price', 'duration', 'created_at').optional(),
    order: Joi.string().valid('asc', 'desc').optional().default('asc'),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    offset: Joi.number().integer().min(0).optional().default(0),
  }),

  listAppointmentsSchema: Joi.object({
    status: Joi.string()
      .valid('pending', 'approved', 'completed', 'cancelled')
      .optional(),
    service_id: Joi.number().integer().optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional(),
    user_id: Joi.string().uuid().optional(),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    offset: Joi.number().integer().min(0).optional().default(0),
  }),
};

module.exports = {
  serviceValidation,
};
