const Joi = require('joi');

const paymentMethodEnum = ['gcash', 'bank_transfer', 'cash'];
const paymentStatusEnum = ['pending', 'for_verification', 'verified', 'rejected', 'cancelled', 'refunded'];

exports.paymentMethods = paymentMethodEnum;
exports.paymentStatuses = paymentStatusEnum;

exports.createPaymentSchema = Joi.object({
  order_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required',
    }),
  method: Joi.string()
    .valid(...paymentMethodEnum)
    .required()
    .messages({
      'any.only': `Payment method must be one of: ${paymentMethodEnum.join(', ')}`,
      'any.required': 'Payment method is required',
    }),
  amount: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.positive': 'Amount must be a positive number',
      'any.required': 'Amount is required',
    }),
  currency: Joi.string()
    .length(3)
    .uppercase()
    .default('PHP')
    .messages({
      'string.length': 'Currency must be a 3-letter code',
    }),
  reference_number: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Reference number must not exceed 100 characters',
    }),
});

exports.uploadProofSchema = Joi.object({
  reference_number: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Reference number must not exceed 100 characters',
    }),
});

exports.updatePaymentStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...paymentStatusEnum)
    .required()
    .messages({
      'any.only': `Status must be one of: ${paymentStatusEnum.join(', ')}`,
      'any.required': 'Status is required',
    }),
  rejection_reason: Joi.string()
    .max(500)
    .when('status', {
      is: 'rejected',
      then: Joi.string().required().max(500),
      otherwise: Joi.optional(),
    })
    .messages({
      'string.max': 'Rejection reason must not exceed 500 characters',
    }),
});

exports.listPaymentsSchema = Joi.object({
  status: Joi.string()
    .valid(...paymentStatusEnum)
    .optional(),
  method: Joi.string()
    .valid(...paymentMethodEnum)
    .optional(),
  order_id: Joi.string()
    .uuid()
    .optional(),
  user_id: Joi.string()
    .uuid()
    .optional(),
  start_date: Joi.date()
    .iso()
    .optional(),
  end_date: Joi.date()
    .iso()
    .optional(),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must not exceed 100',
    }),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Offset must be at least 0',
    }),
});

exports.verifyPaymentSchema = Joi.object({
  notes: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Notes must not exceed 500 characters',
    }),
});

exports.rejectPaymentSchema = Joi.object({
  reason: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': 'Rejection reason must be at least 10 characters',
      'string.max': 'Rejection reason must not exceed 500 characters',
      'any.required': 'Rejection reason is required',
    }),
  notes: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Notes must not exceed 500 characters',
    }),
});

exports.paymentIdParamSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Payment ID must be a valid UUID',
      'any.required': 'Payment ID is required',
    }),
});
