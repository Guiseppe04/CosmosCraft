const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/posController');

/**
 * POS ROUTES
 * All routes require authentication
 * manage_pos: staff, admin, super_admin
 * view_pos: staff, admin, super_admin
 * verify_pos_payment: staff, admin, super_admin
 * void_pos_sale: admin, super_admin
 */

// ──────────────────────────────────────────────────────────────────────────────
// SALES MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────────

// Create new sale
router.post(
  '/sales',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.createSale
);

// List all sales
router.get(
  '/sales',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.listSales
);

// Get specific sale
router.get(
  '/sales/:id',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getSaleById
);

// Update sale info
router.patch(
  '/sales/:id/info',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.updateSaleInfo
);

// ──────────────────────────────────────────────────────────────────────────────
// SALE ITEMS MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────────

// Add product item
router.post(
  '/sales/:id/items/product',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.addProductItem
);

// Add service item
router.post(
  '/sales/:id/items/service',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.addServiceItem
);

// Remove item
router.delete(
  '/sales/:id/items/:itemId',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.removeItem
);

// ──────────────────────────────────────────────────────────────────────────────
// CHECKOUT & PAYMENT
// ──────────────────────────────────────────────────────────────────────────────

// Complete checkout
router.post(
  '/sales/:id/checkout',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.checkoutSale
);

// Cancel sale
router.patch(
  '/sales/:id/cancel',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.cancelSale
);

// Verify payment (for non-cash payments)
router.patch(
  '/payments/:paymentId/verify',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.verifyPayment
);

// ──────────────────────────────────────────────────────────────────────────────
// REPORTING & ANALYTICS
// ──────────────────────────────────────────────────────────────────────────────

// Daily sales summary
router.get(
  '/reports/daily-summary',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getDailySalesSummary
);

// Staff productivity summary
router.get(
  '/reports/staff-summary',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getStaffSummary
);

// Payment method breakdown
router.get(
  '/reports/payment-breakdown',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getPaymentBreakdown
);

// Generate receipt data
router.post(
  '/reports/receipt/:saleId',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.generateReceiptData
);

module.exports = router;
