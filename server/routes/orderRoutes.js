const express = require('express')
const router = express.Router()
const orderController = require('../controllers/orderController.js')
const { authenticateToken, authorize } = require('../middleware/auth.js')

// --- ADMIN ROUTES ---
router.get('/', authenticateToken, authorize('staff', 'admin', 'super_admin'), orderController.getAllOrders)
router.put('/:id', authenticateToken, authorize('staff', 'admin', 'super_admin'), orderController.updateOrder)
router.post('/:id/cancel', authenticateToken, authorize('staff', 'admin', 'super_admin'), orderController.cancelOrder)

// Create new order (requires authentication)
router.post('/', authenticateToken, orderController.createOrder)

// Get user's orders (requires authentication)
router.get('/my-orders', authenticateToken, orderController.getUserOrders)

// Get single order (requires authentication)
router.get('/:orderId', authenticateToken, orderController.getOrder)

module.exports = router