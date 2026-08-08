const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/installmentController');
const { authenticateToken, authorize } = require('../middleware/auth');

// All installment routes require authentication and staff/admin access
router.use(authenticateToken);
router.use(authorize('staff', 'admin', 'super_admin'));

// Get installment tracking data by order ID (resolves project internally)
// MUST be before /project/:projectId to avoid "by-order" being matched as a UUID
router.get('/project/by-order', ctrl.getOrderInstallmentTracking);
// Get installment tracking data for a project (for admin order details)
router.get('/project/:projectId', ctrl.getOrderInstallmentTracking);

// Get all overdue installments
router.get('/overdue', ctrl.getOverdueInstallments);

// Mark an installment as paid
router.patch('/:scheduleId/pay', ctrl.markInstallmentPaid);

// Manually run overdue check
router.post('/check-overdue', ctrl.runOverdueCheck);

module.exports = router;