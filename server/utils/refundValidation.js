const Joi = require('joi');
const image = Joi.string().max(7 * 1024 * 1024).pattern(/^data:image\/(png|jpeg|webp);base64,/)
  .messages({ 'string.pattern.base': 'Upload a PNG, JPG, JPEG or WebP image.' });
const refundDestinationSchema = Joi.object({
  method: Joi.string().valid('e_wallet','e_bank').required(),
  provider: Joi.string().trim().min(2).max(100).when('qrImage', { is: Joi.exist(), then: Joi.optional().allow(''), otherwise: Joi.required() }).label('Wallet / bank name'),
  accountName: Joi.string().trim().min(2).max(150).when('qrImage', { is: Joi.exist(), then: Joi.optional().allow(''), otherwise: Joi.required() }).label('Account name'),
  accountNumber: Joi.string().trim().pattern(/^[0-9+ -]{5,40}$/).when('qrImage', { is: Joi.exist(), then: Joi.optional().allow(''), otherwise: Joi.required() }).label('Account / mobile number')
    .messages({ 'string.pattern.base': 'Enter a valid account / mobile number (5–40 characters).' }),
  details: Joi.string().trim().max(500).allow('').optional(),
  qrImage: Joi.when('method', { is: 'e_wallet', then: image.optional(), otherwise: Joi.forbidden() }),
});
module.exports = { refundDestinationSchema, refundImageSchema: image };
