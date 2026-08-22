const { asyncHandler, AppError } = require('../middleware/errorHandler')
const orderService = require('../services/orderService')
const userService = require('../services/userService')

exports.createOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) {
    throw new AppError('You must be logged in to place an order', 401)
  }

  const { items, notes, shippingMethod, paymentMethod, shippingAddressId, billingAddress, termsAccepted, paymentPlan, initialPaymentPercentage, installmentTenureMonths } = req.validatedData || req.body

  // Validate required fields
  if (!items || items.length === 0) {
    throw new AppError('No items in order', 400)
  }

  if (!shippingAddressId && !billingAddress) {
    throw new AppError('Shipping address is required', 400)
  }

  if (!shippingAddressId) {
    if (!billingAddress.street || !billingAddress.street.trim()) {
      throw new AppError('Address street is required', 400)
    }

    if (!billingAddress.city || !billingAddress.city.trim()) {
      throw new AppError('City is required', 400)
    }
  }

  if (!paymentMethod) {
    throw new AppError('Payment method is required', 400)
  }

  if (termsAccepted !== true) {
    throw new AppError('You must agree to the Terms and Conditions before placing your order.', 400)
  }

  if (!['gcash', 'bank_transfer'].includes(paymentMethod)) {
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
    paymentMethod,
    shippingAddressId,
    billingAddress,
    termsAccepted,
    paymentPlan,
    initialPaymentPercentage,
    installmentTenureMonths,
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
  const result = await orderService.getAllOrders(req.query)
  res.status(200).json({ status: 'success', data: result.orders, pagination: result.pagination })
})

exports.updateOrder = asyncHandler(async (req, res, next) => {
  const order = await orderService.updateOrder(req.params.id, req.validatedData || req.body)
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
  const reason = typeof (req.validatedData?.reason || req.body?.reason) === 'string' ? (req.validatedData?.reason || req.body?.reason).trim() : ''
  if (!reason) {
    throw new AppError('Cancellation reason is required', 400)
  }
  if (reason.length > 200) {
    throw new AppError('Cancellation reason must be 200 characters or less', 400)
  }
  try {
    const order = await orderService.cancelMyOrder(req.params.id, userId, reason);
    res.status(200).json({ status: 'success', data: order });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
})

exports.updatePaymentStatus = asyncHandler(async (req, res, next) => {
  const { status, reference_number, rejection_reason, admin_notes } = req.validatedData || req.body

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
  const { tracking_number, courier_name, rider_name, rider_contact } = req.validatedData || req.body
  
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
  const { rider_name, rider_contact } = req.validatedData || req.body
  
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

exports.markAsReceived = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) {
    throw new AppError('You must be logged in to mark order as received', 401)
  }
  const order = await orderService.markAsReceived(req.params.id, userId)
  if (!order) throw new AppError('Order not found', 404)
  res.status(200).json({ status: 'success', data: order })
})

exports.createRefundRequest = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) {
    throw new AppError('You must be logged in to request a refund', 401)
  }
  const { reason, customerNotes, items, images } = req.validatedData || req.body
  if (!reason || !String(reason).trim()) {
    throw new AppError('Refund reason is required', 400)
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one item must be selected for refund', 400)
  }
  const refundRequest = await orderService.createRefundRequest({
    orderId: req.params.id,
    userId,
    reason: String(reason).trim(),
    customerNotes: customerNotes ? String(customerNotes).trim() : null,
    items,
    images: images || [],
  })
  res.status(201).json({ status: 'success', data: refundRequest })
})

exports.getRefundRequests = asyncHandler(async (req, res, next) => {
  const result = await orderService.getRefundRequests(req.validatedQuery || req.query)
  res.status(200).json({ status: 'success', data: result.requests, pagination: result.pagination })
})

exports.getRefundRequest = asyncHandler(async (req, res, next) => {
  const refundRequest = await orderService.getRefundRequestById(req.params.refundId)
  if (!refundRequest) throw new AppError('Refund request not found', 404)
  res.status(200).json({ status: 'success', data: refundRequest })
})

exports.updateRefundStatus = asyncHandler(async (req, res, next) => {
  const { status, adminNotes } = req.validatedData || req.body
  const adminUserId = req.user?.user_id || req.user?.id
  if (!status) {
    throw new AppError('Status is required', 400)
  }
  const refundRequest = await orderService.updateRefundStatus(req.params.refundId, status, {
    adminUserId,
    adminNotes: adminNotes ? String(adminNotes).trim() : null,
  })
  if (!refundRequest) throw new AppError('Refund request not found', 404)
  res.status(200).json({ status: 'success', data: refundRequest })
})

exports.withdrawRefund = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) {
    throw new AppError('You must be logged in to withdraw a refund request', 401)
  }
  const refundService = require('../services/refundService')
  const refundRequest = await refundService.withdrawRefund(req.params.refundId, userId)
  res.status(200).json({ status: 'success', data: refundRequest })
})

exports.adjustRefundAmount = asyncHandler(async (req, res, next) => {
  const adminUserId = req.user?.user_id || req.user?.id
  const { approvedAmount, adjustmentReason } = req.validatedData || req.body
  if (!approvedAmount || Number(approvedAmount) <= 0) {
    throw new AppError('Approved amount must be greater than 0', 400)
  }
  const refundService = require('../services/refundService')
  const refundRequest = await refundService.applyTransition(
    req.params.refundId,
    'approved',
    adminUserId,
    req.user?.role || 'admin',
    {
      approvedAmount: Number(approvedAmount),
      adjustmentReason: adjustmentReason ? String(adjustmentReason).trim() : null,
    }
  )
  res.status(200).json({ status: 'success', data: refundRequest })
})
