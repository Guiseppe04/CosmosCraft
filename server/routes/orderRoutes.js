const express = require('express')
const router = express.Router()
const orderController = require('../controllers/orderController.js')
const { authenticateToken, authorize } = require('../middleware/auth.js')
const {
  validate,
  validateParams,
  createOrderSchema,
  cancelMyOrderSchema,
  updatePaymentStatusSchema,
  updateShipmentSchema,
  updateOutForDeliverySchema,
  updateOrderSchema,
  orderIdParamSchema,
  uuidParamSchema,
} = require('../utils/validation.js')

// --- SPECIFIC ROUTES FIRST (before /:id wildcard) ---
// Get user's orders (requires authentication)
router.get('/my-orders', authenticateToken, orderController.getUserOrders)

// --- ADMIN ROUTES ---
router.get('/', authenticateToken, authorize('staff', 'admin', 'super_admin'), orderController.getAllOrders)

// --- ID-BASED ROUTES (after specific routes) ---
router.get('/:orderId', authenticateToken, validateParams(orderIdParamSchema), orderController.getOrder)
router.put('/:id/payment-status', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), validate(updatePaymentStatusSchema), orderController.updatePaymentStatus)
router.put('/:id', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), validate(updateOrderSchema), orderController.updateOrder)
router.post('/:id/cancel', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), orderController.cancelOrder)
router.post('/:id/approve-payment', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), orderController.approvePayment)
router.post('/:id/cancel-my-order', authenticateToken, validateParams(uuidParamSchema), validate(cancelMyOrderSchema), orderController.cancelMyOrder)

// Create new order (requires authentication)
router.post('/', authenticateToken, validate(createOrderSchema), orderController.createOrder)

module.exports = router