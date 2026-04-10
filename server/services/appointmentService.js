/**
 * Appointment Service Layer
 * Business logic for appointments with full transaction support
 * Path: server/services/appointmentService.js
 */

const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Calculate estimated end time from service duration
 */
function calculateEstimatedEnd(scheduledAt, durationMinutes) {
  const endTime = new Date(scheduledAt);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);
  return endTime;
}

/**
 * Format appointment response with denormalization
 */
function formatAppointmentResponse(appointment) {
  return {
    appointment_id: appointment.appointment_id,
    user_id: appointment.user_id,
    user_email: appointment.user_email,
    user_name: appointment.user_name,
    user_phone: appointment.user_phone,
    service_id: appointment.service_id,
    service_name: appointment.service_name,
    service_price: appointment.service_price,
    service_duration_minutes: appointment.service_duration_minutes,
    scheduled_at: appointment.scheduled_at,
    estimated_end_at: appointment.estimated_end_at,
    status: appointment.status,
    notes: appointment.notes,
    time_until_appointment_minutes: appointment.time_until_appointment_minutes || null,
    created_at: appointment.created_at,
    updated_at: appointment.updated_at,
  };
}

// ─── CREATE APPOINTMENT ──────────────────────────────────────────────────────

/**
 * Create new appointment with transaction support
 * Validates service, checks conflicts, prevents double-booking
 */
exports.createAppointment = async ({ service_id, scheduled_at, notes, user_id }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify service exists and is active
    const serviceResult = await client.query(
      'SELECT * FROM services WHERE service_id = $1 AND is_active = true',
      [service_id]
    );

    if (serviceResult.rows.length === 0) {
      throw new AppError('Service not found or inactive', 400);
    }

    const service = serviceResult.rows[0];
    const estimatedEndAt = calculateEstimatedEnd(scheduled_at, service.duration_minutes);

    // 2. Check for scheduling conflicts (with lock)
    const conflictResult = await client.query(
      `SELECT COUNT(*) as conflict_count FROM appointments
       WHERE service_id = $1
       AND status NOT IN ('cancelled', 'completed')
       AND scheduled_at < $2
       AND estimated_end_at > $3
       FOR UPDATE`,
      [service_id, estimatedEndAt, new Date(scheduled_at)]
    );

    if (parseInt(conflictResult.rows[0].conflict_count, 10) > 0) {
      throw new AppError(
        'Time slot not available. Service is booked during this time.',
        409
      );
    }

    // 3. Verify user exists if provided
    if (user_id) {
      const userResult = await client.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [user_id]
      );

      if (userResult.rows.length === 0) {
        throw new AppError('User not found', 400);
      }
    }

    // 4. Create appointment
    const appointmentResult = await client.query(
      `INSERT INTO appointments (user_id, service_id, scheduled_at, estimated_end_at, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, now(), now())
       RETURNING *`,
      [user_id || null, service_id, scheduled_at, estimatedEndAt, notes || null]
    );

    await client.query('COMMIT');

    // Fetch denormalized data
    return this.getAppointmentById(appointmentResult.rows[0].appointment_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── GET APPOINTMENT ────────────────────────────────────────────────────────

/**
 * Get single appointment with denormalized service/user data
 */
exports.getAppointmentById = async (appointmentId) => {
  const result = await pool.query(
    `SELECT 
       a.*,
       s.name AS service_name,
       s.price AS service_price,
       s.duration_minutes AS service_duration_minutes,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name,
       u.phone AS user_phone,
       EXTRACT(EPOCH FROM (a.scheduled_at - now())) / 60 as time_until_appointment_minutes
     FROM appointments a
     LEFT JOIN services s ON a.service_id = s.service_id
     LEFT JOIN users u ON a.user_id = u.user_id
     WHERE a.appointment_id = $1`,
    [appointmentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatAppointmentResponse(result.rows[0]);
};

// ─── LIST APPOINTMENTS ──────────────────────────────────────────────────────

/**
 * Get appointments with multi-filter support
 * Supports filtering by: user, service, status, date range
 */
exports.listAppointments = async ({
  user_id,
  service_id,
  status,
  date_from,
  date_to,
  search,
  sort_by = 'scheduled_at',
  sort_order = 'asc',
  limit = 20,
  offset = 0,
} = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  // Build WHERE clause
  if (user_id) {
    where.push(`a.user_id = $${idx}`);
    params.push(user_id);
    idx++;
  }

  if (service_id) {
    where.push(`a.service_id = $${idx}`);
    params.push(service_id);
    idx++;
  }

  if (status) {
    where.push(`a.status = $${idx}`);
    params.push(status);
    idx++;
  }

  if (date_from) {
    where.push(`a.scheduled_at >= $${idx}`);
    params.push(date_from);
    idx++;
  }

  if (date_to) {
    where.push(`a.scheduled_at <= $${idx}`);
    params.push(date_to);
    idx++;
  }

  if (search) {
    where.push(`(u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.email ILIKE $${idx} OR a.notes ILIKE $${idx} OR CAST(a.appointment_id AS TEXT) ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Validate sort parameters (prevent SQL injection)
  const validSortColumns = ['scheduled_at', 'created_at', 'status'];
  const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'scheduled_at';
  const sortOrderUpper = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const result = await pool.query(
    `SELECT 
       a.*,
       s.name AS service_name,
       s.price AS service_price,
       s.duration_minutes AS service_duration_minutes,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name,
       u.phone AS user_phone
     FROM appointments a
     LEFT JOIN services s ON a.service_id = s.service_id
     LEFT JOIN users u ON a.user_id = u.user_id
     ${whereClause}
     ORDER BY a.${sortColumn} ${sortOrderUpper}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return result.rows.map(row => formatAppointmentResponse(row));
};

/**
 * Get total count of appointments with filters
 */
exports.getAppointmentsCount = async (filters = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (filters.user_id) {
    where.push(`user_id = $${idx}`);
    params.push(filters.user_id);
    idx++;
  }

  if (filters.service_id) {
    where.push(`service_id = $${idx}`);
    params.push(filters.service_id);
    idx++;
  }

  if (filters.status) {
    where.push(`a.status = $${idx}`);
    params.push(filters.status);
    idx++;
  }

  if (filters.search) {
    where.push(`(u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.email ILIKE $${idx} OR a.notes ILIKE $${idx} OR CAST(a.appointment_id AS TEXT) ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT COUNT(a.*) as total FROM appointments a
     LEFT JOIN users u ON a.user_id = u.user_id
     ${whereClause}`,
    params
  );

  return parseInt(result.rows[0].total, 10);
};

// ─── GET USER APPOINTMENTS ──────────────────────────────────────────────────

/**
 * Get all appointments for a specific user
 */
exports.getAppointmentsByUser = async (userId, filters = {}) => {
  const result = await this.listAppointments({
    ...filters,
    user_id: userId,
  });

  return result;
};

/**
 * Get user's upcoming appointments
 */
exports.getUserUpcomingAppointments = async (userId) => {
  const result = await pool.query(
    `SELECT 
       a.*,
       s.name AS service_name,
       s.price AS service_price,
       s.duration_minutes AS service_duration_minutes,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name
     FROM appointments a
     LEFT JOIN services s ON a.service_id = s.service_id
     LEFT JOIN users u ON a.user_id = u.user_id
     WHERE a.user_id = $1
     AND a.status IN ('pending', 'approved')
     AND a.scheduled_at > now()
     ORDER BY a.scheduled_at ASC`,
    [userId]
  );

  return result.rows.map(row => formatAppointmentResponse(row));
};

// ─── GET SERVICE APPOINTMENTS ───────────────────────────────────────────────

/**
 * Get all appointments for a specific service
 */
exports.getAppointmentsByService = async (serviceId, filters = {}) => {
  const result = await this.listAppointments({
    ...filters,
    service_id: serviceId,
  });

  return result;
};

// ─── GET APPOINTMENTS BY DATE RANGE ──────────────────────────────────────────

/**
 * Get appointments within date range with optional filters
 */
exports.getAppointmentsByDateRange = async (startDate, endDate, filters = {}) => {
  return this.listAppointments({
    ...filters,
    date_from: startDate,
    date_to: endDate,
  });
};

// ─── UPDATE APPOINTMENT ─────────────────────────────────────────────────────

/**
 * Update appointment (notes, status, or reschedule)
 */
exports.updateAppointment = async (appointmentId, updates) => {
  const { scheduled_at, status, notes } = updates;

  // Get current appointment for validation
  const currentAppt = await this.getAppointmentById(appointmentId);
  if (!currentAppt) {
    throw new AppError('Appointment not found', 404);
  }

  // Cannot update completed or cancelled appointments
  if (['completed', 'cancelled'].includes(currentAppt.status)) {
    throw new AppError(
      `Cannot update ${currentAppt.status} appointment`,
      400
    );
  }

  const setClauses = [];
  const params = [];
  let idx = 1;

  // If rescheduling
  if (scheduled_at) {
    // Check conflicts with new time
    const estimatedEndAt = calculateEstimatedEnd(
      scheduled_at,
      currentAppt.service_duration_minutes
    );

    const conflictResult = await pool.query(
      `SELECT COUNT(*) as conflict_count FROM appointments
       WHERE service_id = $1
       AND appointment_id != $2
       AND status NOT IN ('cancelled', 'completed')
       AND scheduled_at < $3
       AND estimated_end_at > $4`,
      [
        currentAppt.service_id,
        appointmentId,
        estimatedEndAt,
        new Date(scheduled_at),
      ]
    );

    if (parseInt(conflictResult.rows[0].conflict_count, 10) > 0) {
      throw new AppError(
        'Time slot not available. Service is booked during this time.',
        409
      );
    }

    setClauses.push(`scheduled_at = $${idx++}`);
    params.push(scheduled_at);
    setClauses.push(`estimated_end_at = $${idx++}`);
    params.push(estimatedEndAt);
  }

  // Update status with validation
  if (status !== undefined) {
    // Validate status transition
    const validTransitions = {
      'pending': ['approved', 'cancelled'],
      'approved': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': [],
    };

    if (!validTransitions[currentAppt.status]?.includes(status)) {
      throw new AppError(
        `Cannot transition from ${currentAppt.status} to ${status}`,
        400
      );
    }

    setClauses.push(`status = $${idx++}`);
    params.push(status);
  }

  // Update notes
  if (notes !== undefined) {
    setClauses.push(`notes = $${idx++}`);
    params.push(notes || null);
  }

  if (setClauses.length === 0) {
    return currentAppt;
  }

  // Always update timestamp
  setClauses.push(`updated_at = now()`);
  params.push(appointmentId);

  const result = await pool.query(
    `UPDATE appointments SET ${setClauses.join(', ')} WHERE appointment_id = $${idx} RETURNING *`,
    params
  );

  return this.getAppointmentById(appointmentId);
};

// ─── RESCHEDULE APPOINTMENT ────────────────────────────────────────────────

/**
 * Reschedule appointment to new date/time
 */
exports.rescheduleAppointment = async (appointmentId, newScheduledAt, reason) => {
  return this.updateAppointment(appointmentId, {
    scheduled_at: newScheduledAt,
    notes: reason ? `Rescheduled: ${reason}` : 'Rescheduled',
  });
};

// ─── UPDATE STATUS ──────────────────────────────────────────────────────────

/**
 * Update appointment status with state machine validation
 */
exports.updateStatus = async (appointmentId, newStatus, reason) => {
  return this.updateAppointment(appointmentId, {
    status: newStatus,
    notes: reason ? `Status changed: ${reason}` : undefined,
  });
};

// ─── CANCEL APPOINTMENT ─────────────────────────────────────────────────────

/**
 * Cancel appointment
 */
exports.cancelAppointment = async (appointmentId, reason) => {
  const appointment = await this.getAppointmentById(appointmentId);

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  // Cannot cancel completed appointments
  if (appointment.status === 'completed') {
    throw new AppError('Cannot cancel completed appointment', 400);
  }

  // Cannot cancel already cancelled appointments
  if (appointment.status === 'cancelled') {
    throw new AppError('Appointment already cancelled', 400);
  }

  const cancelNote = reason 
    ? `Cancelled: ${reason}`
    : `Cancelled on ${new Date().toISOString()}`;

  const result = await pool.query(
    `UPDATE appointments 
     SET status = 'cancelled', notes = $1, updated_at = now()
     WHERE appointment_id = $2 
     RETURNING *`,
    [cancelNote, appointmentId]
  );

  return this.getAppointmentById(appointmentId);
};

// ─── AVAILABILITY & CONFLICT CHECKING ────────────────────────────────────────

/**
 * Check if time slot is available for service
 * Returns true if no conflicts
 */
exports.checkAvailability = async (serviceId, scheduledAt, durationMinutes) => {
  const estimatedEnd = calculateEstimatedEnd(scheduledAt, durationMinutes);

  const result = await pool.query(
    `SELECT COUNT(*) as conflict_count FROM appointments
     WHERE service_id = $1
     AND status NOT IN ('cancelled', 'completed')
     AND scheduled_at < $2
     AND estimated_end_at > $3`,
    [serviceId, estimatedEnd, new Date(scheduledAt)]
  );

  return parseInt(result.rows[0].conflict_count, 10) === 0;
};

/**
 * Get available time slots for a service on a given date
 */
exports.getAvailableSlots = async (serviceId, date, slotDuration = 30) => {
  const service = await pool.query(
    'SELECT * FROM services WHERE service_id = $1',
    [serviceId]
  );

  if (service.rows.length === 0) {
    throw new AppError('Service not found', 404);
  }

  // Get all appointments for this date/service
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const appointments = await pool.query(
    `SELECT scheduled_at, estimated_end_at FROM appointments
     WHERE service_id = $1
     AND status NOT IN ('cancelled', 'completed')
     AND scheduled_at >= $2
     AND scheduled_at <= $3
     ORDER BY scheduled_at ASC`,
    [serviceId, startOfDay, endOfDay]
  );

  // Generate slots (assume business hours 9 AM - 5 PM)
  const slots = [];
  const current = new Date(startOfDay);
  current.setUTCHours(9, 0, 0, 0); // 9 AM start

  const endHour = new Date(startOfDay);
  endHour.setUTCHours(17, 0, 0, 0); // 5 PM end

  while (current < endHour) {
    const slotEnd = new Date(current);
    slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

    // Check if this slot conflicts with any appointment
    const hasConflict = appointments.rows.some(appt => 
      current < appt.estimated_end_at && slotEnd > appt.scheduled_at
    );

    if (!hasConflict) {
      slots.push({
        start_time: current.toISOString(),
        end_time: slotEnd.toISOString(),
        available: true,
      });
    }

    current.setMinutes(current.getMinutes() + slotDuration);
  }

  return slots;
};

// ─── STATISTICS & REPORTING ────────────────────────────────────────────────

/**
 * Get appointment statistics for reporting
 */
exports.getAppointmentStats = async (filters = {}) => {
  let whereClause = '';
  let params = [];
  let idx = 1;

  if (filters.service_id) {
    whereClause = `WHERE service_id = $${idx}`;
    params.push(filters.service_id);
    idx++;
  }

  if (filters.user_id) {
    const condition = whereClause ? ` AND user_id = $${idx}` : `WHERE user_id = $${idx}`;
    whereClause += condition;
    params.push(filters.user_id);
    idx++;
  }

  const result = await pool.query(
    `SELECT
       COUNT(*) as total_appointments,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
       ROUND(
         (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::numeric / 
           NULLIF(COUNT(*), 0) * 100), 2
       ) as completion_rate_percent
     FROM appointments
     ${whereClause}`,
    params
  );

  return result.rows[0];
};

/**
 * Get service utilization statistics
 */
exports.getServiceUtilization = async (serviceId) => {
  const result = await pool.query(
    `SELECT
       s.service_id,
       s.name as service_name,
       s.price,
       COUNT(a.appointment_id) as total_appointments,
       SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
       SUM(CASE WHEN a.status = 'completed' THEN s.price ELSE 0 END) as total_revenue,
       COUNT(DISTINCT a.user_id) as unique_customers
     FROM services s
     LEFT JOIN appointments a ON s.service_id = a.service_id
     WHERE s.service_id = $1
     GROUP BY s.service_id, s.name, s.price`,
    [serviceId]
  );

  return result.rows[0] || null;
};

/**
 * Get peak hours for appointments
 */
exports.getPeakHours = async (limit = 10) => {
  const result = await pool.query(
    `SELECT
       EXTRACT(HOUR FROM scheduled_at)::INT as hour,
       COUNT(*) as appointment_count,
       ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM appointments) * 100, 2) as percentage
     FROM appointments
     WHERE status NOT IN ('cancelled')
     GROUP BY EXTRACT(HOUR FROM scheduled_at)
     ORDER BY appointment_count DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
};

/**
 * Get user's booking frequency
 */
exports.getUserBookingFrequency = async (userId) => {
  const result = await pool.query(
    `SELECT
       COUNT(*) as total_bookings,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
       COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
       ROUND(
         (COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric / 
           NULLIF(COUNT(*), 0) * 100), 2
       ) as completion_rate_percent,
       MIN(created_at) as first_booking_date,
       MAX(created_at) as last_booking_date
     FROM appointments
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0] || null;
};

// ─── AUTO-COMPLETE LOGIC ────────────────────────────────────────────────────

/**
 * Auto-complete appointments that have passed their estimated end time
 * Should be run periodically (e.g., every 30 minutes)
 */
exports.autoCompleteExpiredAppointments = async () => {
  const result = await pool.query(
    `UPDATE appointments
     SET status = 'completed', updated_at = now()
     WHERE status = 'approved'
     AND estimated_end_at < now()
     AND user_id IS NOT NULL
     RETURNING *`,
  );

  return result.rows;
};

/**
 * Mark appointments as overdue/completed if outside window
 */
exports.getExpiredAppointments = async () => {
  const result = await pool.query(
    `SELECT *
     FROM appointments
     WHERE status IN ('pending', 'approved')
     AND estimated_end_at < now()`
  );

  return result.rows;
};
