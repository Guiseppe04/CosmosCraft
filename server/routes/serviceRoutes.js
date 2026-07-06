/**
 * Service Routes
 * Route definitions and middleware for services and appointments
 * Path: server/routes/serviceRoutes.js
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/serviceController');

// ─── SERVICES ROUTES ─────────────────────────────────────────────────────────

// Public (anyone can view services)
router.get('/', ctrl.listServices);
router.get('/:id', ctrl.getService);
router.get('/:serviceId/availability', ctrl.checkAvailability);

// Admin/Staff only (manage services)
router.post(
  '/',
  authenticateToken,
  authorize('admin', 'super_admin'),
  ctrl.createService
);

router.put(
  '/:id',
  authenticateToken,
  authorize('admin', 'super_admin'),
  ctrl.updateService
);

router.delete(
  '/:id',
  authenticateToken,
  authorize('admin'),
  ctrl.deleteService
);

// ─── APPOINTMENTS ROUTES ──────────────────────────────────────────────────────

// All authenticated users
router.get(
  '/list/all',
  authenticateToken,
  ctrl.listAppointments
);

router.get(
  '/:id/detail',
  authenticateToken,
  ctrl.getAppointment
);

router.post(
  '/book',
  authenticateToken,
  ctrl.createAppointment
);

router.put(
  '/:id/update',
  authenticateToken,
  ctrl.updateAppointment
);

router.post(
  '/:id/cancel',
  authenticateToken,
  ctrl.cancelAppointment
);

module.exports = router;
