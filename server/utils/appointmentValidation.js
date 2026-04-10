/**
 * Unified Appointment Validation Schemas
 * Type-aware validation for service in-shop, home service, and pickup appointments
 * Path: server/utils/appointmentValidation.js
 */

const Joi = require('joi');

const appointmentValidation = {
  // ─── CREATE APPOINTMENT (Type-Aware) ──────────────────────────────────────

  createAppointmentSchema: Joi.object({
    appointment_type: Joi.string()
      .valid('service_in_shop', 'service_home', 'pickup')
      .required()
      .messages({
        'any.required': 'appointment_type is required',
        'any.only': 'appointment_type must be: service_in_shop, service_home, or pickup',
      }),

    // Service ID - Required for service types, forbidden for pickup
    service_id: Joi.number()
      .integer()
      .positive()
      .when('appointment_type', {
        is: Joi.string().valid('service_in_shop', 'service_home'),
        then: Joi.required().messages({
          'any.required': 'service_id is required for service appointments',
        }),
        otherwise: Joi.forbidden().messages({
          'any.forbidden': 'service_id must not be provided for pickup appointments',
        }),
      })
      .messages({
        'number.base': 'service_id must be a number',
        'number.positive': 'service_id must be positive',
      }),

    // Order ID - Required for pickup, forbidden for service
    order_id: Joi.string()
      .uuid()
      .when('appointment_type', {
        is: 'pickup',
        then: Joi.required().messages({
          'any.required': 'order_id is required for pickup appointments',
        }),
        otherwise: Joi.forbidden().messages({
          'any.forbidden': 'order_id must not be provided for service appointments',
        }),
      })
      .messages({
        'string.guid': 'order_id must be a valid UUID',
      }),

    // Address ID - Required for home service, forbidden for others
    address_id: Joi.string()
      .uuid()
      .when('appointment_type', {
        is: 'service_home',
        then: Joi.required().messages({
          'any.required': 'address_id is required for home service appointments',
        }),
        otherwise: Joi.forbidden().messages({
          'any.forbidden': 'address_id must not be provided for in-shop or pickup appointments',
        }),
      })
      .messages({
        'string.guid': 'address_id must be a valid UUID',
      }),

    // Scheduled date/time - Required for service, optional for pickup
    scheduled_at: Joi.date()
      .iso()
      .required()
      .min('now')
      .messages({
        'any.required': 'scheduled_at is required',
        'date.base': 'Invalid date format. Use ISO8601 (YYYY-MM-DDTHH:mm:ssZ)',
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

    confirmation_notes: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .trim(),

    staff_id: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'staff_id must be a valid UUID',
      }),

    user_id: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'user_id must be a valid UUID',
      }),
  })
    .required()
    .messages({
      'object.base': 'Request body must be a valid object',
    }),

  // ─── UPDATE APPOINTMENT ──────────────────────────────────────────────────

  updateAppointmentSchema: Joi.object({
    scheduled_at: Joi.date()
      .iso()
      .min('now')
      .optional()
      .messages({
        'date.base': 'Invalid date format',
        'date.min': 'Cannot reschedule to the past',
      }),

    notes: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .trim(),

    confirmation_notes: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .trim(),

    staff_id: Joi.string()
      .uuid()
      .optional(),
  })
    .or('scheduled_at', 'notes', 'confirmation_notes', 'staff_id')
    .messages({
      'object.missing': 'At least one field must be provided for update',
    }),

  // ─── STATUS UPDATE ──────────────────────────────────────────────────────

  statusUpdateSchema: Joi.object({
    status: Joi.string()
      .valid('pending', 'confirmed', 'in_progress', 'completed', 'ready_for_pickup', 'cancelled')
      .required()
      .messages({
        'any.required': 'Status is required',
        'any.only': 'Status must be valid',
      }),

    reason: Joi.string()
      .max(300)
      .optional()
      .trim()
      .messages({
        'string.max': 'Reason cannot exceed 300 characters',
      }),

    confirmation_notes: Joi.string()
      .max(500)
      .optional()
      .trim(),
  }),

  // ─── LIST APPOINTMENTS (Multi-Filter) ────────────────────────────────────

  listAppointmentsSchema: Joi.object({
    appointment_type: Joi.string()
      .valid('service_in_shop', 'service_home', 'pickup')
      .optional()
      .messages({
        'any.only': 'Invalid appointment type',
      }),

    search: Joi.string().allow('').optional(),

    status: Joi.string()
      .valid('pending', 'confirmed', 'in_progress', 'completed', 'ready_for_pickup', 'cancelled')
      .optional(),

    user_id: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'Invalid user_id format',
      }),

    service_id: Joi.number()
      .integer()
      .positive()
      .optional()
      .messages({
        'number.positive': 'service_id must be positive',
      }),

    order_id: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'Invalid order_id format',
      }),

    staff_id: Joi.string()
      .uuid()
      .optional(),

    date_from: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.base': 'Invalid date_from format',
      }),

    date_to: Joi.date()
      .iso()
      .min(Joi.ref('date_from'))
      .optional()
      .messages({
        'date.base': 'Invalid date_to format',
        'date.min': 'date_to must be after date_from',
      }),

    sort_by: Joi.string()
      .valid('scheduled_at', 'created_at', 'status')
      .optional()
      .default('scheduled_at'),

    sort_order: Joi.string()
      .valid('asc', 'desc')
      .optional()
      .default('asc'),

    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .messages({
        'number.min': 'limit must be at least 1',
        'number.max': 'limit cannot exceed 100',
      }),

    offset: Joi.number()
      .integer()
      .min(0)
      .optional()
      .default(0)
      .messages({
        'number.min': 'offset cannot be negative',
      }),
  }),

  // ─── CANCEL APPOINTMENT ──────────────────────────────────────────────────

  cancelSchema: Joi.object({
    reason: Joi.string()
      .max(300)
      .optional()
      .allow('')
      .trim()
      .messages({
        'string.max': 'Reason cannot exceed 300 characters',
      }),
  }),

  // ─── DATE RANGE QUERY ────────────────────────────────────────────────────

  dateRangeSchema: Joi.object({
    start_date: Joi.date()
      .iso()
      .required()
      .messages({
        'any.required': 'start_date is required',
        'date.base': 'Invalid date format for start_date',
      }),

    end_date: Joi.date()
      .iso()
      .required()
      .min(Joi.ref('start_date'))
      .messages({
        'any.required': 'end_date is required',
        'date.base': 'Invalid date format for end_date',
        'date.min': 'end_date must be after or equal to start_date',
      }),

    appointment_type: Joi.string()
      .valid('service_in_shop', 'service_home', 'pickup')
      .optional(),

    status: Joi.string()
      .valid('pending', 'confirmed', 'in_progress', 'completed', 'ready_for_pickup', 'cancelled')
      .optional(),

    limit: Joi.number()
      .integer()
      .min(1)
      .max(500)
      .optional()
      .default(100),

    offset: Joi.number()
      .integer()
      .min(0)
      .optional()
      .default(0),
  }),

  // ─── STATS QUERY ────────────────────────────────────────────────────────

  statsSchema: Joi.object({
    period: Joi.string()
      .valid('day', 'week', 'month', 'year')
      .optional()
      .default('month'),

    service_id: Joi.number()
      .integer()
      .positive()
      .optional(),

    user_id: Joi.string()
      .uuid()
      .optional(),

    appointment_type: Joi.string()
      .valid('service_in_shop', 'service_home', 'pickup')
      .optional(),

    date_from: Joi.date()
      .iso()
      .optional(),

    date_to: Joi.date()
      .iso()
      .min(Joi.ref('date_from'))
      .optional(),
  }),

  // ─── AVAILABLE SLOTS QUERY ──────────────────────────────────────────────

  availableSlotsSchema: Joi.object({
    date: Joi.date()
      .iso()
      .required()
      .messages({
        'any.required': 'date parameter is required (YYYY-MM-DD)',
        'date.base': 'Invalid date format',
      }),

    service_id: Joi.number()
      .integer()
      .positive()
      .optional(),

    slot_duration: Joi.number()
      .integer()
      .min(15)
      .max(480)
      .optional()
      .default(30)
      .messages({
        'number.min': 'slot_duration must be at least 15 minutes',
        'number.max': 'slot_duration cannot exceed 480 minutes',
      }),
  }),

  // ─── CHECK CONFLICT ──────────────────────────────────────────────────────

  checkConflictSchema: Joi.object({
    service_id: Joi.number()
      .integer()
      .positive()
      .required(),

    scheduled_at: Joi.date()
      .iso()
      .required(),

    duration_minutes: Joi.number()
      .integer()
      .positive()
      .optional()
      .default(60),
  }),
};

module.exports = {
  appointmentValidation,
};
