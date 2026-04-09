const { asyncHandler, AppError } = require('../middleware/errorHandler')
const orderService = require('../services/orderService')
const userService = require('../services/userService')

exports.createOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) {
    throw new AppError('You must be logged in to place an order', 401)
  }

  const { items, notes, shippingMethod, paymentMethod, billingAddress } = req.body

  // Validate required fields
  if (!items || items.length === 0) {
    throw new AppError('No items in order', 400)
  }

  if (!billingAddress) {
    throw new AppError('Shipping address is required', 400)
  }

  if (!billingAddress.street || !billingAddress.street.trim()) {
    throw new AppError('Address street is required', 400)
  }

  if (!billingAddress.city || !billingAddress.city.trim()) {
    throw new AppError('City is required', 400)
  }

  if (!paymentMethod) {
    throw new AppError('Payment method is required', 400)
  }

  const user = await userService.getUserById(userId)
  if (!user) {
    throw new AppError('User not found', 404)
  }

  const order = await orderService.createOrder({
    userId,
    items,
    notes,
    shippingMethod,
    paymentMethod,
    billingAddress
  })

  res.status(201).json({
    status: 'success',
    data: { order }
  })
})

exports.getUserOrders = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) {
    throw new AppError('You must be logged in to view orders', 401)
  }

  const orders = await orderService.getUserOrders(userId)

  res.status(200).json({
    status: 'success',
    data: { orders }
  })
})

exports.getOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id
  const { orderId } = req.params

  if (!userId) {
    throw new AppError('You must be logged in to view orders', 401)
  }

  const order = await orderService.getOrderById(orderId, userId)

  res.status(200).json({
    status: 'success',
    data: { order }
  })
})