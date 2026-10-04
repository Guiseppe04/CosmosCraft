const Joi = require('joi');

const assignmentSchema = Joi.object({
  customer_id: Joi.string().guid().required(),
  customization_id: Joi.string().guid().required(),
  quantity: Joi.number().integer().min(1).max(99).default(1),
  design: Joi.object({
    name: Joi.string().trim().max(150).required(),
    guitar_type: Joi.string().valid('electric', 'acoustic', 'bass').required(),
    total_price: Joi.number().min(0).max(9999999999.99).required(),
    body_wood: Joi.string().max(100).allow(null),
    neck_wood: Joi.string().max(100).allow(null),
    fingerboard_wood: Joi.string().max(100).allow(null),
    bridge_type: Joi.string().max(50).allow(null),
    pickups: Joi.string().max(200).allow(null),
    color: Joi.string().max(100).allow(null),
    finish_type: Joi.string().max(50).allow(null),
    config_json: Joi.object().min(1).required(),
    stickers: Joi.array().items(Joi.object()).max(10).default([]),
    preview_image: Joi.string().allow(null).max(5000000),
    summary: Joi.object().required(),
    pricingBreakdown: Joi.object().required(),
    lineItems: Joi.array().items(Joi.object({
      id: Joi.string().required(), category: Joi.string().required(), name: Joi.string().required(),
      unitPrice: Joi.number().min(0).required(), quantity: Joi.number().integer().min(1).required(),
      subtotal: Joi.number().min(0).required(),
    })).min(1).required(),
  }).required(),
});

const customerLookupSchema = Joi.object({
  search: Joi.string().trim().max(150).allow('').default(''),
  page: Joi.number().integer().min(1).max(100000).default(1),
});

module.exports = { assignmentSchema, customerLookupSchema };
