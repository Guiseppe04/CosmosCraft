const Joi = require('joi');
const optionalText = max => Joi.string().trim().max(max).allow('').default('');
const money = Joi.number().min(0).precision(2).allow(null).default(null);
const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value,helpers) => {
  const date = new Date(value+'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value ? value : helpers.error('any.invalid');
}).allow(null).default(null);
exports.day = day;
exports.reviewSchema = Joi.object({
  version: Joi.number().integer().min(0).required(),
  receipt: Joi.object({status:Joi.string().valid('unverified','verified','disputed').required(),confirmedDate:day,evidence:optionalText(1000)}).required(),
  shipping: Joi.object({payer:Joi.string().valid('undecided','seller','customer').required(),
    arrangement:Joi.string().valid('undecided','customer_shipping','seller_pickup').required(),courier:optionalText(100),reference:optionalText(255),
    cost:money,reimbursement:Joi.string().valid('not_recorded','pending','recorded','not_applicable').required(),
    reimbursementAmount:money,reimbursementReference:optionalText(255),deadline:day}).required(),
  financial: Joi.object({materialValue:money,incurredLabor:money,evidence:optionalText(1000),verified:Joi.boolean().strict().required()}).required(),
  evidenceComplete:Joi.boolean().strict().required(),
}).unknown(false);
exports.offerSchema = Joi.object({version:Joi.number().integer().min(0).required(),type:Joi.string().valid('repair','rework').required(),
  description:Joi.string().trim().min(10).max(2000).required()}).unknown(false);
exports.responseSchema = Joi.object({offerId:Joi.string().uuid().required(),response:Joi.string().valid('accepted','declined').required()}).unknown(false);
