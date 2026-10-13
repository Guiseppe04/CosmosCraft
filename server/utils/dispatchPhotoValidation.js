const Joi=require('joi');
const image=require('./refundValidation').refundImageSchema;
exports.itemPhotos=Joi.array().unique('order_item_id').items(Joi.object({order_item_id:Joi.number().integer().positive().required(),images:Joi.array().items(image).min(1).max(5).required()}).unknown(false)).min(1).max(100);
exports.appendSchema=Joi.object({itemPhotos:exports.itemPhotos.required(),reason:Joi.string().trim().min(10).max(1000).required()}).unknown(false);
