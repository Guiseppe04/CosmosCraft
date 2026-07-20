/**
 * Service Service Layer
 * Business logic and database queries for services and appointments
 * Path: server/services/serviceService.js
 */

const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

// ─── SERVICES ────────────────────────────────────────────────────────────────

/**
 * Get all services with optional filtering and pagination
 * @param {Object} filters - { search, is_active, sort, order, limit, offset }
 * @returns {Promise<Array>} Services array
 */
exports.getAllServices = async ({
  search,
  is_active,
  sort = 'created_at',
  order = 'asc',
  limit = 20,
  offset = 0,
} = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  // Active filter
  if (is_active !== undefined) {
    where.push(`s.is_active = $${idx}`);
    params.push(is_active);
    idx++;
  }

  // Search filter
  if (search) {
    where.push(`(s.name ILIKE $${idx} OR s.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  // Build WHERE clause
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Validate sort parameter (SQL injection prevention)
  const validSortColumns = ['name', 'price', 'duration_minutes', 'created_at'];
  const sortColumn = validSortColumns.includes(sort) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const result = await pool.query(
    `SELECT * FROM services s
     ${whereClause}
     ORDER BY s.${sortColumn} ${sortOrder}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return result.rows;
};

/**
 * Get total count of services
 */
exports.getServicesCount = async (filters = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (filters.is_active !== undefined) {
    where.push(`is_active = $${idx}`);
    params.push(filters.is_active);
    idx++;
  }

  if (filters.search) {
    where.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT COUNT(*) as total FROM services ${whereClause}`,
    params
  );

  return parseInt(result.rows[0].total, 10);
};

/**
 * Get single service by ID
 */
exports.getServiceById = async (serviceId) => {
  const result = await pool.query(
    'SELECT * FROM services WHERE service_id = $1',
    [serviceId]
  );
  return result.rows[0] || null;
};

/**
 * Create new service
 */
exports.createService = async ({ name, description, price, duration_minutes }) => {
  const result = await pool.query(
    `INSERT INTO services (name, description, price, duration_minutes, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, now(), now())
     RETURNING *`,
    [name, description || null, price, duration_minutes]
  );
  return result.rows[0];
};

/**
 * Update service
 */
exports.updateService = async (serviceId, updates) => {
  const { name, description, price, duration_minutes, is_active } = updates;

  const setClauses = [];
  const params = [];
  let idx = 1;

  if (name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    params.push(name);
  }
  if (description !== undefined) {
    setClauses.push(`description = $${idx++}`);
    params.push(description || null);
  }
  if (price !== undefined) {
    setClauses.push(`price = $${idx++}`);
    params.push(price);
  }
  if (duration_minutes !== undefined) {
    setClauses.push(`duration_minutes = $${idx++}`);
    params.push(duration_minutes);
  }
  if (is_active !== undefined) {
    setClauses.push(`is_active = $${idx++}`);
    params.push(is_active);
  }

  if (setClauses.length === 0) {
    return this.getServiceById(serviceId);
  }

  setClauses.push(`updated_at = now()`);
  params.push(serviceId);

  const result = await pool.query(
    `UPDATE services SET ${setClauses.join(', ')} WHERE service_id = $${idx} RETURNING *`,
    params
  );

  return result.rows[0] || null;
};

/**
 * Soft delete service (set is_active = false)
 */
exports.deleteService = async (serviceId) => {
  const result = await pool.query(
    'UPDATE services SET is_active = false, updated_at = now() WHERE service_id = $1 RETURNING *',
    [serviceId]
  );
  return result.rows[0] || null;
};

// ─── APPOINTMENTS ────────────────────────────────────────────────────────────

/**
 * Get appointments with filtering and pagination
 */
exports.getAllAppointments = async ({
  user_id,
  service_id,
  status,
  start_date,
  end_date,
  limit = 20,
  offset = 0,
} = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

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

  if (start_date) {
    where.push(`a.scheduled_at >= $${idx}`);
    params.push(start_date);
    idx++;
  }

  if (end_date) {
    where.push(`a.scheduled_at <= $${idx}`);
    params.push(end_date);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT a.*,
            s.name AS service_name,
            s.price AS service_price,
            s.duration_minutes,
            u.email AS user_email,
            u.first_name || ' ' || u.last_name AS user_name
     FROM appointments a
     LEFT JOIN services s ON a.service_id = s.service_id
     LEFT JOIN users u ON a.user_id = u.user_id
     ${whereClause}
     ORDER BY a.scheduled_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return result.rows;
};

/**
 * Get single appointment by ID
 */
exports.getAppointmentById = async (appointmentId) => {
  const result = await pool.query(
    `SELECT a.*,
            s.name AS service_name,
            s.price AS service_price,
            s.duration_minutes,
            u.email AS user_email,
            u.first_name || ' ' || u.last_name AS user_name
     FROM appointments a
     LEFT JOIN services s ON a.service_id = s.service_id
     LEFT JOIN users u ON a.user_id = u.user_id
     WHERE a.appointment_id = $1`,
    [appointmentId]
  );
  return result.rows[0] || null;
};

/**
 * Create new appointment
 * Validates service exists and checks for conflicts
 */
exports.createAppointment = async ({ user_id, service_id, scheduled_at, notes }) => {
  // Start transaction
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify service exists
    const serviceResult = await client.query(
      'SELECT * FROM services WHERE service_id = $1 AND is_active = true',
      [service_id]
    );

    if (serviceResult.rows.length === 0) {
      throw new AppError('Service not found or inactive', 404);
    }

    const service = serviceResult.rows[0];
    const estimatedEndAt = new Date(
      new Date(scheduled_at).getTime() + service.duration_minutes * 60000
    );

    // Check for scheduling conflicts (overlapping appointments)
    const conflictResult = await client.query(
      `SELECT COUNT(*) as conflict_count FROM appointments
       WHERE status NOT IN ('cancelled', 'completed')
       AND service_id = $1
       AND scheduled_at < $2
       AND estimated_end_at > $3`,
      [service_id, estimatedEndAt, new Date(scheduled_at)]
    );

    if (parseInt(conflictResult.rows[0].conflict_count, 10) > 0) {
      throw new AppError(
        'Time slot is already booked. Please choose a different time.',
        409
      );
    }

    // Create appointment
    const appointmentResult = await client.query(
      `INSERT INTO appointments (user_id, service_id, scheduled_at, estimated_end_at, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, now(), now())
       RETURNING *`,
      [user_id || null, service_id, scheduled_at, estimatedEndAt, notes || null]
    );

    await client.query('COMMIT');
    return appointmentResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Update appointment
 */
exports.updateAppointment = async (appointmentId, updates) => {
  const { scheduled_at, status, notes } = updates;

  const setClauses = [];
  const params = [];
  let idx = 1;

  // If rescheduling, check for conflicts
  if (scheduled_at) {
    const appointment = await this.getAppointmentById(appointmentId);
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    const durationMs = appointment.duration_minutes * 60000;
    const estimatedEndAt = new Date(new Date(scheduled_at).getTime() + durationMs);

    const conflictResult = await pool.query(
      `SELECT COUNT(*) as conflict_count FROM appointments
       WHERE appointment_id != $1
       AND service_id = $2
       AND status NOT IN ('cancelled', 'completed')
       AND scheduled_at < $3
       AND estimated_end_at > $4`,
      [appointmentId, appointment.service_id, estimatedEndAt, new Date(scheduled_at)]
    );

    if (parseInt(conflictResult.rows[0].conflict_count, 10) > 0) {
      throw new AppError(
        'Time slot is already booked. Please choose a different time.',
        409
      );
    }

    setClauses.push(`scheduled_at = $${idx++}`);
    params.push(scheduled_at);
    setClauses.push(`estimated_end_at = $${idx++}`);
    params.push(estimatedEndAt);
  }

  if (status !== undefined) {
    setClauses.push(`status = $${idx++}`);
    params.push(status);
  }

  if (notes !== undefined) {
    setClauses.push(`notes = $${idx++}`);
    params.push(notes || null);
  }

  if (setClauses.length === 0) {
    return this.getAppointmentById(appointmentId);
  }

  setClauses.push(`updated_at = now()`);
  params.push(appointmentId);

  const result = await pool.query(
    `UPDATE appointments SET ${setClauses.join(', ')} WHERE appointment_id = $${idx} RETURNING *`,
    params
  );

  return result.rows[0] || null;
};

/**
 * Cancel appointment
 */
exports.cancelAppointment = async (appointmentId) => {
  const result = await pool.query(
    `UPDATE appointments SET status = 'cancelled', updated_at = now() WHERE appointment_id = $1 RETURNING *`,
    [appointmentId]
  );
  return result.rows[0] || null;
};

/**
 * Check availability for a given date/time and duration
 * Returns true if time slot is available
 */
exports.checkAvailability = async (service_id, scheduled_at, duration_minutes) => {
  const estimatedEndAt = new Date(
    new Date(scheduled_at).getTime() + duration_minutes * 60000
  );

  const result = await pool.query(
    `SELECT COUNT(*) as conflict_count FROM appointments
     WHERE service_id = $1
     AND status NOT IN ('cancelled', 'completed')
     AND scheduled_at < $2
     AND estimated_end_at > $3`,
    [service_id, estimatedEndAt, new Date(scheduled_at)]
  );

  return parseInt(result.rows[0].conflict_count, 10) === 0;
};

/**
 * Get service statistics
 */
exports.getServiceStats = async (serviceId) => {
  const result = await pool.query(
    `SELECT
       s.service_id,
       s.name,
       s.price,
       COUNT(a.appointment_id) as total_appointments,
       SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
       SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
       SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
       COALESCE(s.price * SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END), 0) as total_revenue
     FROM services s
     LEFT JOIN appointments a ON s.service_id = a.service_id
     WHERE s.service_id = $1
     GROUP BY s.service_id, s.name, s.price`,
    [serviceId]
  );

  return result.rows[0] || null;
};
