/**
 * Service Controller
 * HTTP request handlers for services and appointments
 * Path: server/controllers/serviceController.js
 */

const { AppError } = require('../middleware/errorHandler');
const serviceService = require('../services/serviceService');
const { serviceValidation } = require('../utils/serviceValidation');

// ─── VALIDATION HELPER ───────────────────────────────────────────────────────

const validate = async (data, schema) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    throw new AppError(messages.join('; '), 400);
  }
  return value;
};

// ─── SERVICES ENDPOINTS ──────────────────────────────────────────────────────

/**
 * GET /api/services
 * Get all services with optional filtering
 */
exports.listServices = async (req, res, next) => {
  try {
    const validated = await validate(
      req.query,
      serviceValidation.listServicesSchema
    );

    const services = await serviceService.getAllServices(validated);
    const total = await serviceService.getServicesCount(validated);

    res.json({
      status: 'success',
      data: services,
      pagination: {
        total,
        limit: validated.limit,
        offset: validated.offset,
        hasMore: validated.offset + validated.limit < total,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/services/:id
 * Get single service
 */
exports.getService = async (req, res, next) => {
  try {
    const service = await serviceService.getServiceById(req.params.id);
    if (!service) {
      throw new AppError('Service not found', 404);
    }

    const stats = await serviceService.getServiceStats(req.params.id);

    res.json({ status: 'success', data: { ...service, stats } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/services
 * Create new service (Admin/Staff only)
 */
exports.createService = async (req, res, next) => {
  try {
    const validated = await validate(
      req.body,
      serviceValidation.createServiceSchema
    );

    const service = await serviceService.createService(validated);

    res.status(201).json({ status: 'success', data: service });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/services/:id
 * Update service (Admin/Staff only)
 */
exports.updateService = async (req, res, next) => {
  try {
    const validated = await validate(
      req.body,
      serviceValidation.updateServiceSchema
    );

    const service = await serviceService.updateService(req.params.id, validated);
    if (!service) {
      throw new AppError('Service not found', 404);
    }

    res.json({ status: 'success', data: service });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/services/:id
 * Soft delete service (Admin only)
 */
exports.deleteService = async (req, res, next) => {
  try {
    const service = await serviceService.deleteService(req.params.id);
    if (!service) {
      throw new AppError('Service not found', 404);
    }

    res.json({
      status: 'success',
      data: service,
      message: 'Service deactivated successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ─── APPOINTMENTS ENDPOINTS ──────────────────────────────────────────────────

/**
 * GET /api/appointments
 * Get appointments (filtered by role)
 */
exports.listAppointments = async (req, res, next) => {
  try {
    const validated = await validate(
      req.query,
      serviceValidation.listAppointmentsSchema
    );

    // Customers can only see own appointments
    if (req.user.role === 'customer') {
      validated.user_id = req.user.id;
    }

    const appointments = await serviceService.getAllAppointments(validated);

    res.json({
      status: 'success',
      data: appointments,
      pagination: {
        limit: validated.limit,
        offset: validated.offset,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/appointments/:id
 * Get single appointment
 */
exports.getAppointment = async (req, res, next) => {
  try {
    const appointment = await serviceService.getAppointmentById(req.params.id);
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Check authorization: customers can only view own appointments
    if (
      req.user.role === 'customer'
      && appointment.user_id !== req.user.id
    ) {
      throw new AppError('Unauthorized', 403);
    }

    res.json({ status: 'success', data: appointment });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/appointments
 * Create appointment (Customer can book, Admin can create for others)
 */
exports.createAppointment = async (req, res, next) => {
  try {
    const validated = await validate(
      req.body,
      serviceValidation.createAppointmentSchema
    );

    // Customers book for themselves
    const user_id = req.user.role === 'customer' ? req.user.id : (validated.user_id || null);

    const appointment = await serviceService.createAppointment({
      ...validated,
      user_id,
    });

    res.status(201).json({ status: 'success', data: appointment });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/appointments/:id
 * Update appointment
 */
exports.updateAppointment = async (req, res, next) => {
  try {
    const appointment = await serviceService.getAppointmentById(req.params.id);
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Authorization check
    if (
      req.user.role === 'customer'
      && appointment.user_id !== req.user.id
    ) {
      throw new AppError('Unauthorized', 403);
    }

    const validated = await validate(
      req.body,
      serviceValidation.updateAppointmentSchema
    );

    const updated = await serviceService.updateAppointment(
      req.params.id,
      validated
    );

    res.json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/appointments/:id/cancel
 * Cancel appointment
 */
exports.cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await serviceService.getAppointmentById(req.params.id);
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Check authorization
    if (
      req.user.role === 'customer'
      && appointment.user_id !== req.user.id
    ) {
      throw new AppError('Unauthorized', 403);
    }

    // Cannot cancel completed or already cancelled appointments
    if (['completed', 'cancelled'].includes(appointment.status)) {
      throw new AppError(`Cannot cancel ${appointment.status} appointment`, 400);
    }

    const cancelled = await serviceService.cancelAppointment(req.params.id);

    res.json({
      status: 'success',
      data: cancelled,
      message: 'Appointment cancelled successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/services/:serviceId/availability
 * Check availability for a service on given date
 */
exports.checkAvailability = async (req, res, next) => {
  try {
    const { scheduled_at } = req.query;

    if (!scheduled_at) {
      throw new AppError('scheduled_at query parameter is required', 400);
    }

    const service = await serviceService.getServiceById(req.params.serviceId);
    if (!service) {
      throw new AppError('Service not found', 404);
    }

    const isAvailable = await serviceService.checkAvailability(
      req.params.serviceId,
      new Date(scheduled_at),
      service.duration_minutes
    );

    res.json({
      status: 'success',
      data: {
        service_id: req.params.serviceId,
        scheduled_at,
        is_available: isAvailable,
      },
    });
  } catch (err) {
    next(err);
  }
};
