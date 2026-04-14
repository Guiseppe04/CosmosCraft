const express = require('express')
const router = express.Router()
const orderController = require('../controllers/orderController.js')
const { authenticateToken, authorize } = require('../middleware/auth.js')

// --- SPECIFIC ROUTES FIRST (before /:id wildcard) ---
// Get user's orders (requires authentication)
router.get('/my-orders', authenticateToken, orderController.getUserOrders)

// --- ADMIN ROUTES ---
router.get('/', authenticateToken, authorize('staff', 'admin', 'super_admin'), orderController.getAllOrders)

// --- ID-BASED ROUTES (after specific routes) ---
router.get('/:orderId', authenticateToken, orderController.getOrder)
router.put('/:id', authenticateToken, authorize('staff', 'admin', 'super_admin'), orderController.updateOrder)
router.post('/:id/cancel', authenticateToken, authorize('staff', 'admin', 'super_admin'), orderController.cancelOrder)
router.post('/:id/approve-payment', authenticateToken, authorize('staff', 'admin', 'super_admin'), orderController.approvePayment)
router.post('/:id/cancel-my-order', authenticateToken, orderController.cancelMyOrder)

// Create new order (requires authentication)
router.post('/', authenticateToken, orderController.createOrder)

module.exports = router