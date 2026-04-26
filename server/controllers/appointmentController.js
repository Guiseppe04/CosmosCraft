/**
 * Appointment Controller
 * HTTP request handlers for appointment endpoints
 * Path: server/controllers/appointmentController.js
 */

const appointmentService = require('../services/appointmentService');
const { AppError } = require('../middleware/errorHandler');
const { appointmentValidation } = require('../utils/appointmentValidation');

// ─── HELPER: VALIDATION ──────────────────────────────────────────────────────

const validate = (data, schema) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    const messages = error.details.map(detail => detail.message).join('; ');
    throw new AppError(messages, 400);
  }
  return value;
};

// ─── HELPER: AUTHORIZATION ──────────────────────────────────────────────────

/**
 * Check if user can access this appointment
 * Customers can only see their own appointments
 * Staff/Admin can see all
 */
async function checkAppointmentAccess(appointmentId, userId, userRole) {
  const appointment = await appointmentService.getAppointmentById(appointmentId);

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  // Staff, admin, and super_admin can access all
  if (['admin', 'super_admin', 'staff'].includes(userRole)) {
    return appointment;
  }

  // Customers can only access their own
  if (appointment.user_id !== userId) {
    throw new AppError('Access denied to this appointment', 403);
  }

  return appointment;
}

// ─── CREATE APPOINTMENT ─────────────────────────────────────────────────────

/**
 * POST /appointments
 * Create new appointment
 */
exports.createAppointment = async (req, res, next) => {
  try {
    // Validate request
    const validated = validate(req.body, appointmentValidation.createAppointmentSchema);

    const isPrivilegedRole = ['admin', 'super_admin', 'staff'].includes(req.user.role);
    if (!isPrivilegedRole && validated.user_id && validated.user_id !== req.user.id) {
      throw new AppError('Customers can only create appointments for their own account', 403);
    }

    // Customers always book for self; staff/admin may book on behalf of users.
    const userId = isPrivilegedRole ? (validated.user_id || req.user.id) : req.user.id;

    const appointment = await appointmentService.createAppointment({
      appointment_type: validated.appointment_type,
      services: validated.services,
      location_id: validated.location_id,
      guitar_details: validated.guitar_details,
      scheduled_at: validated.scheduled_at,
      notes: validated.notes,
      user_id: userId,
      order_id: validated.order_id,
      confirmation_notes: validated.confirmation_notes,
    });

    res.status(201).json({
      status: 'success',
      data: {
        appointment,
      },
      message: 'Appointment created successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET SINGLE APPOINTMENT ─────────────────────────────────────────────────

/**
 * GET /appointments/:id
 * Get single appointment details
 */
exports.getAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check access
    const appointment = await checkAppointmentAccess(
      id,
      req.user.id,
      req.user.role
    );

    res.json({
      status: 'success',
      data: {
        appointment,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── LIST APPOINTMENTS ──────────────────────────────────────────────────────

/**
 * GET /appointments
 * List appointments with filtering
 */
exports.listAppointments = async (req, res, next) => {
  try {
    // Validate query parameters
    const validated = validate(
      req.query,
      appointmentValidation.listAppointmentsSchema
    );

    // Filter by role
    let filters = { ...validated };

    // Customers can only see their own appointments
    if (req.user.role === 'customer') {
      filters.user_id = req.user.id;
    }

    // Get appointments
    const appointments = await appointmentService.listAppointments(filters);

    // Get total count (for pagination)
    const total = await appointmentService.getAppointmentsCount(filters);

    res.json({
      status: 'success',
      data: {
        appointments,
        pagination: {
          total,
          limit: parseInt(validated.limit, 10),
          offset: parseInt(validated.offset, 10),
          pages: Math.ceil(total / parseInt(validated.limit, 10)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE APPOINTMENT ─────────────────────────────────────────────────────

/**
 * PATCH /appointments/:id
 * Update appointment (notes, status, or reschedule)
 */
exports.updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check access (customers can only update their own)
    const appointment = await checkAppointmentAccess(
      id,
      req.user.user_id,
      req.user.role
    );

    // Validate update schema
    const validated = validate(
      req.body,
      appointmentValidation.updateAppointmentSchema
    );

    // Staff/Admin can update status, customers cannot
    if (req.user.role === 'customer' && validated.status !== undefined) {
      throw new AppError('Customers cannot update appointment status', 403);
    }

    // Perform update
    const updated = await appointmentService.updateAppointment(id, validated);

    res.json({
      status: 'success',
      data: {
        appointment: updated,
      },
      message: 'Appointment updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ─── RESCHEDULE APPOINTMENT ────────────────────────────────────────────────

/**
 * PATCH /appointments/:id/reschedule
 * Reschedule appointment to new date/time
 */
exports.rescheduleAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check access
    const appointment = await checkAppointmentAccess(
      id,
      req.user.user_id,
      req.user.role
    );

    // Validate reschedule schema
    const validated = validate(
      req.body,
      appointmentValidation.rescheduleSchema
    );

    // Perform reschedule
    const updated = await appointmentService.rescheduleAppointment(
      id,
      validated.new_scheduled_at,
      validated.reason
    );

    res.json({
      status: 'success',
      data: {
        appointment: updated,
      },
      message: 'Appointment rescheduled successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE STATUS ──────────────────────────────────────────────────────────

/**
 * PATCH /appointments/:id/status
 * Update appointment status (admin/staff only)
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check access
    await checkAppointmentAccess(id, req.user.user_id, req.user.role);

    // Validate status schema
    const validated = validate(
      req.body,
      appointmentValidation.updateStatusSchema
    );

    // Perform status update
    const updated = await appointmentService.updateStatus(
      id,
      validated.new_status || validated.status,
      validated.reason
    );

    res.json({
      status: 'success',
      data: {
        appointment: updated,
      },
      message: 'Appointment status updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ─── CANCEL APPOINTMENT ─────────────────────────────────────────────────────

/**
 * DELETE /appointments/:id
 * Cancel appointment
 */
exports.cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check access
    await checkAppointmentAccess(id, req.user.user_id, req.user.role);

    // Validate cancel schema
    const validated = validate(
      req.body,
      appointmentValidation.cancelSchema
    );

    // Perform cancellation
    const cancelled = await appointmentService.cancelAppointment(id, validated.reason);

    res.json({
      status: 'success',
      data: {
        appointment: cancelled,
      },
      message: 'Appointment cancelled successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET USER APPOINTMENTS ──────────────────────────────────────────────────

/**
 * GET /users/:userId/appointments
 * Get all appointments for a specific user
 */
exports.getUserAppointments = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Customers can only see their own appointments
    if (req.user.role === 'customer' && userId !== req.user.user_id) {
      throw new AppError('Access denied', 403);
    }

    const appointments = await appointmentService.getAppointmentsByUser(userId, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    const total = await appointmentService.getAppointmentsCount({
      user_id: userId,
    });

    res.json({
      status: 'success',
      data: {
        user_id: userId,
        appointments,
        pagination: {
          total,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/:userId/appointments/upcoming
 * Get user's upcoming appointments
 */
exports.getUserUpcomingAppointments = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Customers can only see their own
    if (req.user.role === 'customer' && userId !== req.user.user_id) {
      throw new AppError('Access denied', 403);
    }

    const appointments = await appointmentService.getUserUpcomingAppointments(userId);

    res.json({
      status: 'success',
      data: {
        user_id: userId,
        appointments,
        count: appointments.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET SERVICE APPOINTMENTS ───────────────────────────────────────────────

/**
 * GET /services/:serviceId/appointments
 * Get all appointments for a specific service
 */
exports.getServiceAppointments = async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const appointments = await appointmentService.getAppointmentsByService(
      parseInt(serviceId, 10),
      {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      }
    );

    const total = await appointmentService.getAppointmentsCount({
      service_id: parseInt(serviceId, 10),
    });

    res.json({
      status: 'success',
      data: {
        service_id: parseInt(serviceId, 10),
        appointments,
        pagination: {
          total,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET BY DATE RANGE ──────────────────────────────────────────────────────

/**
 * GET /appointments/search/by-date
 * Get appointments within date range
 */
exports.getAppointmentsByDateRange = async (req, res, next) => {
  try {
    // Validate date range schema
    const validated = validate(
      req.query,
      appointmentValidation.dateRangeSchema
    );

    const appointments = await appointmentService.getAppointmentsByDateRange(
      validated.start_date,
      validated.end_date,
      {
        service_id: validated.service_id,
        status: validated.status,
        limit: parseInt(validated.limit, 10),
        offset: parseInt(validated.offset, 10),
      }
    );

    res.json({
      status: 'success',
      data: {
        date_range: {
          start: validated.start_date,
          end: validated.end_date,
        },
        appointments,
        count: appointments.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── AVAILABILITY CHECK ─────────────────────────────────────────────────────

/**
 * GET /services/:serviceId/availability
 * Check availability for service on given date/time
 */
exports.checkAvailability = async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { scheduled_at } = req.query;

    // Get service to find duration
    const serviceResult = await require('../config/database').pool.query(
      'SELECT * FROM services WHERE service_id = $1',
      [serviceId]
    );

    if (serviceResult.rows.length === 0) {
      throw new AppError('Service not found', 404);
    }

    const service = serviceResult.rows[0];

    if (!scheduled_at) {
      throw new AppError('scheduled_at parameter is required', 400);
    }

    const available = await appointmentService.checkAvailability(
      parseInt(serviceId, 10),
      new Date(scheduled_at),
      service.duration_minutes
    );

    res.json({
      status: 'success',
      data: {
        service_id: parseInt(serviceId, 10),
        scheduled_at,
        available,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /services/:serviceId/availability/slots
 * Get available time slots for service on given date
 */
exports.getAvailableSlots = async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { date, slot_duration = 30 } = req.query;

    if (!date) {
      throw new AppError('date parameter is required (YYYY-MM-DD)', 400);
    }

    const dailyLoad = await appointmentService.getDailyAppointmentLoad(new Date(date));
    const slots = await appointmentService.getAvailableSlots(
      parseInt(serviceId, 10),
      new Date(date),
      parseInt(slot_duration, 10)
    );

    const availabilityStatus = dailyLoad.is_unavailable
      ? 'unavailable'
      : dailyLoad.is_fully_booked
        ? 'fully_booked'
        : 'open';

    res.json({
      status: 'success',
      data: {
        service_id: parseInt(serviceId, 10),
        date,
        slot_duration: parseInt(slot_duration, 10),
        available_slots: slots,
        total_available: slots.length,
        availability_status: availabilityStatus,
        daily_appointments: dailyLoad.active_appointments,
        max_daily_appointments: dailyLoad.max_appointments,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── STATISTICS & REPORTING ────────────────────────────────────────────────

/**
 * GET /appointments/stats
 * Get appointment statistics
 */
exports.getAppointmentStats = async (req, res, next) => {
  try {
    const validated = validate(
      req.query,
      appointmentValidation.statsSchema
    );

    // Apply role-based filtering
    const filters = {};
    if (validated.service_id) {
      filters.service_id = validated.service_id;
    }

    // Customers can only see their own stats
    if (req.user.role === 'customer') {
      filters.user_id = req.user.user_id;
    } else if (validated.user_id) {
      filters.user_id = validated.user_id;
    }

    const stats = await appointmentService.getAppointmentStats(filters);

    res.json({
      status: 'success',
      data: {
        filters,
        period: validated.period || 'month',
        statistics: stats,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /services/:serviceId/stats
 * Get service utilization statistics
 */
exports.getServiceStats = async (req, res, next) => {
  try {
    const { serviceId } = req.params;

    const stats = await appointmentService.getServiceUtilization(
      parseInt(serviceId, 10)
    );

    if (!stats) {
      throw new AppError('Service not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        service_stats: stats,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /appointments/stats/peak-hours
 * Get peak appointment hours (admin/staff only)
 */
exports.getPeakHours = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const peakHours = await appointmentService.getPeakHours(
      parseInt(limit, 10)
    );

    res.json({
      status: 'success',
      data: {
        peak_hours: peakHours,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/:userId/stats
 * Get user booking statistics
 */
exports.getUserStats = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Customers can only see their own stats
    if (req.user.role === 'customer' && userId !== req.user.user_id) {
      throw new AppError('Access denied', 403);
    }

    const stats = await appointmentService.getUserBookingFrequency(userId);

    res.json({
      status: 'success',
      data: {
        user_id: userId,
        booking_stats: stats,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── UNAVAILABLE DATES ───────────────────────────────────────────────────────

/**
 * GET /appointments/unavailable-dates
 * Get all unavailable dates
 * Access: Admin/Staff only
 */
exports.getUnavailableDates = async (req, res, next) => {
  try {
    const dates = await appointmentService.getUnavailableDates();

    res.json({
      status: 'success',
      data: {
        unavailable_dates: dates,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /appointments/unavailable-dates
 * Add unavailable date
 * Access: Admin/Staff only
 */
exports.addUnavailableDate = async (req, res, next) => {
  try {
    const { date, reason } = req.body;

    if (!date) {
      throw new AppError('date is required', 400);
    }

    const result = await appointmentService.addUnavailableDate(
      date,
      reason,
      req.user.user_id
    );

    res.status(201).json({
      status: 'success',
      data: {
        unavailable_date: result,
      },
      message: 'Date marked as unavailable',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /appointments/unavailable-dates/:id
 * Remove unavailable date
 * Access: Admin/Staff only
 */
exports.removeUnavailableDate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await appointmentService.removeUnavailableDate(id);

    res.json({
      status: 'success',
      data: {
        removed: result,
      },
      message: 'Date availability restored',
    });
  } catch (err) {
    next(err);
  }
};

// ─── PAYMENT STATUS ─────────────────────────────────────────────────────────

/**
 * PATCH /appointments/:id/payment-status
 * Update payment status
 * Access: Admin/Staff only
 */
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_method, payment_proof_url } = req.body;

    if (!payment_status) {
      throw new AppError('payment_status is required', 400);
    }

    const validStatuses = ['pending', 'awaiting_approval', 'paid', 'failed'];
    if (!validStatuses.includes(payment_status)) {
      throw new AppError('Invalid payment status', 400);
    }

    const updated = await appointmentService.updatePaymentStatus(
      id,
      payment_status,
      payment_method,
      payment_proof_url
    );

    res.json({
      status: 'success',
      data: {
        appointment: updated,
      },
      message: 'Payment status updated',
    });
  } catch (err) {
    next(err);
  }
};
