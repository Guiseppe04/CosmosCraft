/**
 * Appointment Routes
 * RESTful endpoints for appointment management
 * Path: server/routes/appointmentRoutes.js
 */

const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const appointmentController = require('../controllers/appointmentController');

const router = express.Router();

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────
// All routes require authentication
router.use(authenticateToken);

// ─── CREATE APPOINTMENT ─────────────────────────────────────────────────────
/**
 * POST /api/appointments
 * Create new appointment
 * Access: All authenticated users (customer books for self, admin for any user)
 */
router.post('/', appointmentController.createAppointment);

// ─── GET SINGLE APPOINTMENT ────────────────────────────────────────────────

/**
 * GET /api/appointments/unavailable-dates
 * Get all unavailable dates
 * Access: Any authenticated user
 */
router.get('/unavailable-dates', appointmentController.getUnavailableDates);

/**
 * POST /api/appointments/unavailable-dates
 * Add unavailable date
 * Access: Admin/Staff only
 */
router.post(
  '/unavailable-dates',
  authorize('admin', 'staff', 'super_admin'),
  appointmentController.addUnavailableDate
);

/**
 * GET /api/appointments/:id
 * Get appointment details
 * Access: Customers see own, Admin/Staff see all
 */
router.get('/:id', appointmentController.getAppointment);

// ─── LIST APPOINTMENTS ─────────────────────────────────────────────────────

/**
 * GET /api/appointments
 * List appointments with filtering
 * Query params:
 *   - user_id (optional) - Filter by user
 *   - service_id (optional) - Filter by service
 *   - status (optional) - pending, approved, completed, cancelled
 *   - date_from (optional) - ISO date string
 *   - date_to (optional) - ISO date string
 *   - sort_by (optional) - scheduled_at, created_at, status (default: scheduled_at)
 *   - sort_order (optional) - asc, desc (default: asc)
 *   - limit (optional) - 1-100 (default: 20)
 *   - offset (optional) - 0+ (default: 0)
 * Access: Customers see own, Admin/Staff see all
 */
router.get('/', appointmentController.listAppointments);

// ─── UPDATE APPOINTMENT ────────────────────────────────────────────────────

/**
 * PATCH /api/appointments/:id
 * Update appointment
 * Body:
 *   - scheduled_at (optional) - New date/time
 *   - status (optional) - Admin/Staff only
 *   - notes (optional) - Appointment notes
 * Access: Customers update own, Admin/Staff update any
 */
router.patch('/:id', appointmentController.updateAppointment);

// ─── RESCHEDULE APPOINTMENT ───────────────────────────────────────────────

/**
 * PATCH /api/appointments/:id/reschedule
 * Reschedule appointment to new date/time
 * Body:
 *   - new_scheduled_at (required) - ISO date string, must be in future
 *   - reason (optional) - Reason for rescheduling
 * Access: Customers reschedule own, Admin/Staff reschedule any
 */
router.patch('/:id/reschedule', appointmentController.rescheduleAppointment);

// ─── UPDATE STATUS ────────────────────────────────────────────────────────

/**
 * PATCH /api/appointments/:id/status
 * Update appointment status (with state machine validation)
 * Body:
 *   - new_status (required) - pending, approved, completed, cancelled
 *   - reason (optional) - Reason for status change
 * Valid transitions:
 *   - pending → approved, cancelled
 *   - approved → completed, cancelled
 *   - completed (terminal)
 *   - cancelled (terminal)
 * Access: Admin/Staff only
 */
router.patch(
  '/:id/status',
  authorize('admin', 'staff', 'super_admin'),
  appointmentController.updateStatus
);

// ─── CANCEL APPOINTMENT ────────────────────────────────────────────────────

/**
 * DELETE /api/appointments/:id
 * Cancel appointment
 * Body:
 *   - reason (optional) - Cancellation reason
 * Access: Customers cancel own, Admin/Staff cancel any
 */
router.delete('/:id', appointmentController.cancelAppointment);

// ─── GET APPOINTMENTS BY DATE RANGE ───────────────────────────────────────

/**
 * GET /api/appointments/search/by-date
 * Get appointments within date range
 * Query params:
 *   - start_date (required) - ISO date string
 *   - end_date (required) - ISO date string (>=start_date)
 *   - service_id (optional)
 *   - status (optional)
 *   - limit (optional) - 1-500 (default: 100)
 *   - offset (optional) - 0+ (default: 0)
 * Access: Admin/Staff only
 */
router.get(
  '/search/by-date',
  authorize('admin', 'staff', 'super_admin'),
  appointmentController.getAppointmentsByDateRange
);

// ─── AVAILABILITY & SLOTS ──────────────────────────────────────────────────

/**
 * GET /api/services/:serviceId/availability
 * Check if service is available at specific time
 * Query params:
 *   - scheduled_at (required) - ISO date/time string to check
 * Response: { available: boolean }
 * Access: Public (no auth required)
 */
router.get(
  '/services/:serviceId/availability',
  (req, res, next) => {
    // Make this route public
    req.user = req.user || { role: 'public' };
    next();
  },
  appointmentController.checkAvailability
);

/**
 * GET /api/services/:serviceId/availability/slots
 * Get available time slots for service on given date
 * Query params:
 *   - date (required) - YYYY-MM-DD
 *   - slot_duration (optional) - Minutes per slot (default: 30)
 * Response: Array of available slots with start/end times
 * Access: Public
 */
router.get(
  '/services/:serviceId/availability/slots',
  (req, res, next) => {
    req.user = req.user || { role: 'public' };
    next();
  },
  appointmentController.getAvailableSlots
);

// ─── USER APPOINTMENTS ────────────────────────────────────────────────────

/**
 * GET /api/users/:userId/appointments
 * Get all appointments for user
 * Query params:
 *   - limit (optional) - Default 20
 *   - offset (optional) - Default 0
 * Access: Customers see own, Admin/Staff see any
 */
router.get('/users/:userId/appointments', appointmentController.getUserAppointments);

/**
 * GET /api/users/:userId/appointments/upcoming
 * Get user's upcoming appointments
 * Access: Customers see own, Admin/Staff see any
 */
router.get(
  '/users/:userId/appointments/upcoming',
  appointmentController.getUserUpcomingAppointments
);

// ─── SERVICE APPOINTMENTS ──────────────────────────────────────────────────

/**
 * GET /api/services/:serviceId/appointments
 * Get all appointments for service
 * Query params:
 *   - limit (optional) - Default 20
 *   - offset (optional) - Default 0
 * Access: Admin/Staff only
 */
router.get(
  '/services/:serviceId/appointments',
  authorize('admin', 'staff', 'super_admin'),
  appointmentController.getServiceAppointments
);

// ─── STATISTICS & REPORTING ───────────────────────────────────────────────

/**
 * GET /api/appointments/stats
 * Get appointment statistics
 * Query params:
 *   - period (optional) - day, week, month, year (default: month)
 *   - service_id (optional)
 *   - user_id (optional) - Customers can only see own
 * Response: { total_appointments, pending_count, approved_count, completed_count, cancelled_count, completion_rate_percent }
 * Access: Customers see own, Admin/Staff see all
 */
router.get('/stats', appointmentController.getAppointmentStats);

/**
 * GET /api/services/:serviceId/stats
 * Get service utilization statistics
 * Response: { total_appointments, completed_count, total_revenue, unique_customers }
 * Access: Admin/Staff only
 */
router.get(
  '/services/:serviceId/stats',
  authorize('admin', 'staff', 'super_admin'),
  appointmentController.getServiceStats
);

/**
 * GET /api/appointments/stats/peak-hours
 * Get peak appointment hours
 * Query params:
 *   - limit (optional) - Default 10
 * Access: Admin/Staff only
 */
router.get(
  '/stats/peak-hours',
  authorize('admin', 'staff', 'super_admin'),
  appointmentController.getPeakHours
);

/**
 * GET /api/users/:userId/stats
 * Get user booking statistics
 * Response: { total_bookings, completed_bookings, cancelled_bookings, completion_rate_percent, first_booking_date, last_booking_date }
 * Access: Customers see own, Admin/Staff see any
 */
router.get('/users/:userId/stats', appointmentController.getUserStats);

// ─── UNAVAILABLE DATES ───────────────────────────────────────────────────────

/**
 * DELETE /api/appointments/unavailable-dates/:id
 * Remove unavailable date
 * Access: Admin/Staff only
 */
router.delete(
  '/unavailable-dates/:id',
  authorize('admin', 'staff', 'super_admin'),
  appointmentController.removeUnavailableDate
);

// ─── PAYMENT STATUS ─────────────────────────────────────────────────────────

/**
 * PATCH /api/appointments/:id/payment-status
 * Update payment status
 * Access: Admin/Staff only
 */
router.patch(
  '/:id/payment-status',
  authorize('admin', 'staff', 'super_admin'),
  appointmentController.updatePaymentStatus
);

module.exports = router;
