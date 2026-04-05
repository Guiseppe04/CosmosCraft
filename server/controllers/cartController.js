const cartService = require('../services/cartService');
const { AppError } = require('../middleware/errorHandler');
const cartValidation = require('../utils/cartValidation');

const validate = (data, schema) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    const messages = error.details.map(detail => detail.message).join('; ');
    throw new AppError(messages, 400);
  }
  return value;
};

exports.getCart = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const cart = await cartService.getCartWithItems(userId);
    res.json({ status: 'success', data: cart });
  } catch (err) {
    next(err);
  }
};

exports.addItem = async (req, res, next) => {
  try {
    const validated = validate(req.body, cartValidation.addItemSchema);
    const userId = req.user.user_id;
    const cart = await cartService.addItemToCart(userId, validated);
    res.status(201).json({ status: 'success', data: cart, message: 'Item added to cart' });
  } catch (err) {
    next(err);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = validate(req.body, cartValidation.updateItemSchema);
    const userId = req.user.user_id;
    const cart = await cartService.updateCartItem(userId, id, validated);
    res.json({ status: 'success', data: cart, message: 'Cart item updated' });
  } catch (err) {
    next(err);
  }
};

exports.removeItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const cart = await cartService.removeCartItem(userId, id);
    res.json({ status: 'success', data: cart, message: 'Item removed from cart' });
  } catch (err) {
    next(err);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const cart = await cartService.clearCart(userId);
    res.json({ status: 'success', data: cart, message: 'Cart cleared' });
  } catch (err) {
    next(err);
  }
};

exports.getCartItemCount = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const count = await cartService.getCartItemCount(userId);
    res.json({ status: 'success', data: { item_count: count } });
  } catch (err) {
    next(err);
  }
};

exports.prepareCheckout = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const result = await cartService.prepareCheckout(userId, req.body);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

exports.checkout = async (req, res, next) => {
  try {
    const validated = validate(req.body, cartValidation.checkoutSchema);
    const userId = req.user.user_id;
    const result = await cartService.convertCartToOrder(userId, validated);
    res.status(201).json({ status: 'success', data: result, message: result.message });
  } catch (err) {
    next(err);
  }
};