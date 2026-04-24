const { asyncHandler, AppError } = require('../middleware/errorHandler')
const orderService = require('../services/orderService')
const userService = require('../services/userService')

exports.createOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) {
    throw new AppError('You must be logged in to place an order', 401)
  }

  const { items, notes, shippingMethod, paymentMethod, billingAddress, termsAccepted } = req.body

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

  if (termsAccepted !== true) {
    throw new AppError('You must agree to the Terms and Conditions before placing your order.', 400)
  }

  const normalizedPaymentMethod = paymentMethod === 'cod' ? 'cash' : paymentMethod
  if (!['gcash', 'bank_transfer', 'cash'].includes(normalizedPaymentMethod)) {
    throw new AppError('Invalid payment method', 400)
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
    paymentMethod: normalizedPaymentMethod,
    billingAddress,
    termsAccepted,
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

exports.getAllOrders = asyncHandler(async (req, res, next) => {
  const orders = await orderService.getAllOrders(req.query)
  res.status(200).json({ status: 'success', data: orders })
})

exports.updateOrder = asyncHandler(async (req, res, next) => {
  const order = await orderService.updateOrder(req.params.id, req.body)
  if (!order) throw new AppError('Order not found', 404)
  res.status(200).json({ status: 'success', data: order })
})

exports.cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await orderService.cancelOrder(req.params.id)
  if (!order) throw new AppError('Order not found', 404)
  res.status(200).json({ status: 'success', data: order })
})

exports.cancelMyOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError('You must be logged in', 401);
  }
  try {
    const order = await orderService.cancelMyOrder(req.params.id, userId);
    res.status(200).json({ status: 'success', data: order });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
})

exports.updatePaymentStatus = asyncHandler(async (req, res, next) => {
  const { status, reference_number, rejection_reason, admin_notes } = req.body
  if (!status) throw new AppError('Payment status is required', 400)

  const adminUserId = req.user?.user_id || req.user?.id
  const adminName = req.user?.first_name ? `${req.user.first_name}${req.user.last_name ? ' ' + req.user.last_name : ''}` : null
  const adminEmail = req.user?.email

  const order = await orderService.updatePaymentStatus(req.params.id, status, {
    reference_number,
    admin_name: adminName,
    admin_email: adminEmail,
    rejection_reason,
    admin_notes,
    admin_user_id: adminUserId
  })
  if (!order) throw new AppError('Order not found', 404)
  res.status(200).json({ status: 'success', data: order })
})

exports.approvePayment = asyncHandler(async (req, res, next) => {
  const adminUserId = req.user?.user_id || req.user?.id
  const adminName = req.user?.first_name ? `${req.user.first_name}${req.user.last_name ? ' ' + req.user.last_name : ''}` : null
  const adminEmail = req.user?.email

  const order = await orderService.approvePayment(req.params.id, {
    admin_name: adminName,
    admin_email: adminEmail,
    admin_user_id: adminUserId
  })
  if (!order) throw new AppError('Order not found', 404)
  res.status(200).json({ status: 'success', data: order })
})

exports.updateShipment = asyncHandler(async (req, res, next) => {
  const { tracking_number, courier_name, rider_name, rider_contact } = req.body
  
  if (!tracking_number || !courier_name) {
    throw new AppError('Tracking number and courier name are required', 400)
  }
  
  const order = await orderService.updateShipment(req.params.id, {
    tracking_number,
    courier_name,
    rider_name,
    rider_contact
  })
  if (!order) throw new AppError('Order not found', 404)
  res.status(200).json({ status: 'success', data: order })
})

exports.updateOutForDelivery = asyncHandler(async (req, res, next) => {
  const { rider_name, rider_contact } = req.body
  
  if (!rider_name || !rider_contact) {
    throw new AppError('Rider name and contact are required', 400)
  }
  
  const order = await orderService.updateOutForDelivery(req.params.id, {
    rider_name,
    rider_contact
  })
  if (!order) throw new AppError('Order not found', 404)
  res.status(200).json({ status: 'success', data: order })
})

exports.markDelivered = asyncHandler(async (req, res, next) => {
  const order = await orderService.markDelivered(req.params.id)
  if (!order) throw new AppError('Order not found', 404)
  res.status(200).json({ status: 'success', data: order })
})
