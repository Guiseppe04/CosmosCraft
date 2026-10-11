const Joi = require('joi');
const { AppError } = require('../middleware/errorHandler');

const identifier = Joi.string().pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/).max(100);
const schema = Joi.object({
  entity_type: identifier,
  entity_id: Joi.string().guid(),
  user_id: Joi.string().guid(),
  action: identifier,
  start_date: Joi.date().iso(),
  end_date: Joi.date().iso().when('start_date', { is: Joi.exist(), then: Joi.date().min(Joi.ref('start_date')) }),
  search: Joi.string().trim().max(200).allow(''),
  limit: Joi.number().integer().min(1).max(50).default(25),
  offset: Joi.number().integer().min(0).max(2147483647).default(0),
});

function validateAuditFilters(filters = {}) {
  const { value, error } = schema.validate(filters);
  if (error) throw new AppError(`Invalid audit filters: ${error.details[0].message}`, 400);
  return value;
}

function validateAuditId(id) {
  if (!/^[1-9][0-9]*$/.test(String(id)) || BigInt(id) > 9223372036854775807n) {
    throw new AppError('Invalid audit record ID', 400);
  }
  return id;
}

module.exports = { validateAuditFilters, validateAuditId };
