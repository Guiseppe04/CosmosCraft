const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.use(authenticateToken);
router.use(authorize('staff', 'admin', 'super_admin'));

router.get('/dashboard', ctrl.getDashboardSummary);
router.get('/sales', ctrl.getSalesReport);
router.get('/orders', ctrl.getOrderReport);
router.get('/payments', ctrl.getPaymentReport);
router.get('/appointments', ctrl.getAppointmentReport);
router.get('/services', ctrl.getServiceReport);
router.get('/products', ctrl.getProductReport);
router.get('/cart', ctrl.getCartReport);
router.get('/users', ctrl.getUserReport);
router.get('/revenue', ctrl.getRevenueReport);
router.get('/customizations', ctrl.getCustomizationReport);
router.get('/export', ctrl.exportReport);

module.exports = router;
