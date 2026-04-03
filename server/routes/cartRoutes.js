const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/cartController');

router.use(authenticateToken);

router.get('/', ctrl.getCart);
router.get('/count', ctrl.getCartItemCount);
router.post('/items', ctrl.addItem);
router.patch('/items/:id', ctrl.updateItem);
router.delete('/items/:id', ctrl.removeItem);
router.delete('/', ctrl.clearCart);
router.post('/prepare-checkout', ctrl.prepareCheckout);
router.post('/checkout', ctrl.checkout);

module.exports = router;