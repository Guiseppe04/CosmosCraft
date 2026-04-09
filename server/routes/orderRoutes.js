const express = require('express')
const router = express.Router()
const orderController = require('../controllers/orderController.js')
const { authenticateToken } = require('../middleware/auth.js')

// Create new order (requires authentication)
router.post('/', authenticateToken, orderController.createOrder)

// Get user's orders (requires authentication)
router.get('/my-orders', authenticateToken, orderController.getUserOrders)

// Get single order (requires authentication)
router.get('/:orderId', authenticateToken, orderController.getOrder)

module.exports = router