const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/inventoryController');

/**
 * INVENTORY ROUTES
 * All routes require authentication
 * view_inventory: staff, admin, super_admin
 * adjust_stock: staff, admin, super_admin
 * manage_inventory: admin, super_admin
 */

// ──────────────────────────────────────────────────────────────────────────────
// PRODUCT STOCK VIEW
// ──────────────────────────────────────────────────────────────────────────────

router.get(
  '/products',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getProductsWithStock
);

router.get(
  '/products/:id',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getProductStock
);

// ──────────────────────────────────────────────────────────────────────────────
// STOCK OPERATIONS
// ──────────────────────────────────────────────────────────────────────────────

router.patch(
  '/stock-in',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.addStock
);

router.patch(
  '/stock-out',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.deductStock
);

router.patch(
  '/adjust',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.adjustStock
);

// ──────────────────────────────────────────────────────────────────────────────
// INVENTORY LOGS
// ──────────────────────────────────────────────────────────────────────────────

router.get(
  '/logs',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getInventoryLogs
);

router.get(
  '/logs/:productId',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getProductInventoryLogs
);

// ──────────────────────────────────────────────────────────────────────────────
// LOW STOCK ALERTS
// ──────────────────────────────────────────────────────────────────────────────

router.get(
  '/alerts/low-stock',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getLowStockAlerts
);

router.patch(
  '/alerts/:alertId/read',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.markAlertAsRead
);

// ──────────────────────────────────────────────────────────────────────────────
// INVENTORY SUMMARY
// ──────────────────────────────────────────────────────────────────────────────

router.get(
  '/summary',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  ctrl.getInventorySummary
);

module.exports = router;
