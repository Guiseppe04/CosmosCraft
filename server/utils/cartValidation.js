const Joi = require('joi');

exports.addItemSchema = Joi.object({
  product_id: Joi.string().uuid().optional(),
  customization_id: Joi.string().uuid().optional(),
  quantity: Joi.number().integer().min(1).default(1),
}).or('product_id', 'customization_id').messages({
  'object.missing': 'Either product_id or customization_id is required',
});

exports.updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

exports.checkoutSchema = Joi.object({
  shipping_address_id: Joi.string().uuid().optional(),
  notes: Joi.string().max(1000).optional().allow(''),
  payment_method: Joi.string().valid('gcash', 'bank_transfer', 'cash').optional(),
});

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