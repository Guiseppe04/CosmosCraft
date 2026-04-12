/**
 * Appointment Service Layer
 * Business logic for appointments with full transaction support
 * Path: server/services/appointmentService.js
 */

const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

function formatAppointmentResponse(appointment) {
  // Defensive parsing for postgres JSON strings
  let parsedServices = appointment.services;
  let parsedGuitarDetails = appointment.guitar_details;

  if (typeof parsedServices === 'string') {
    try { parsedServices = JSON.parse(parsedServices); } catch(e){}
  }
  if (typeof parsedGuitarDetails === 'string') {
    try { parsedGuitarDetails = JSON.parse(parsedGuitarDetails); } catch(e){}
  }

  return {
    appointment_id: appointment.appointment_id,
    user_id: appointment.user_id,
    user_email: appointment.user_email,
    user_name: appointment.user_name,
    user_phone: appointment.user_phone,
    services: parsedServices,
    location_id: appointment.location_id,
    guitar_details: parsedGuitarDetails,
    scheduled_at: appointment.scheduled_at,
    estimated_end_at: appointment.estimated_end_at,
    status: appointment.status,
    notes: appointment.notes,
    time_until_appointment_minutes: appointment.time_until_appointment_minutes || null,
    created_at: appointment.created_at,
    updated_at: appointment.updated_at,
  };
}

exports.createAppointment = async ({ services, location_id, guitar_details, scheduled_at, notes, user_id }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (user_id) {
      const userResult = await client.query('SELECT user_id FROM users WHERE user_id = $1', [user_id]);
      if (userResult.rows.length === 0) throw new AppError('User not found', 400);
    }

    const appointmentResult = await client.query(
      `INSERT INTO appointments (user_id, services, location_id, guitar_details, scheduled_at, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'approved', $6, now(), now())
       RETURNING *`,
      [user_id || null, JSON.stringify(services), location_id, JSON.stringify(guitar_details), scheduled_at, notes || null]
    );

    await client.query('COMMIT');
    return this.getAppointmentById(appointmentResult.rows[0].appointment_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getAppointmentById = async (appointmentId) => {
  const result = await pool.query(
    `SELECT 
       a.*,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name,
       u.phone AS user_phone,
       EXTRACT(EPOCH FROM (a.scheduled_at - now())) / 60 as time_until_appointment_minutes
     FROM appointments a
     LEFT JOIN users u ON a.user_id = u.user_id
     WHERE a.appointment_id = $1`,
    [appointmentId]
  );
  if (result.rows.length === 0) return null;
  return formatAppointmentResponse(result.rows[0]);
};

exports.listAppointments = async ({ user_id, status, date_from, date_to, search, sort_by = 'scheduled_at', sort_order = 'asc', limit = 20, offset = 0 } = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (user_id) { where.push(`a.user_id = $${idx++}`); params.push(user_id); }
  if (status) { where.push(`a.status = $${idx++}`); params.push(status); }
  if (date_from) { where.push(`a.scheduled_at >= $${idx++}`); params.push(date_from); }
  if (date_to) { where.push(`a.scheduled_at <= $${idx++}`); params.push(date_to); }
  if (search) {
    where.push(`(u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.email ILIKE $${idx} OR a.notes ILIKE $${idx} OR CAST(a.appointment_id AS TEXT) ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortColumn = ['scheduled_at', 'created_at', 'status'].includes(sort_by) ? sort_by : 'scheduled_at';
  const sortOrderUpper = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const result = await pool.query(
    `SELECT 
       a.*,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name,
       u.phone AS user_phone
     FROM appointments a
     LEFT JOIN users u ON a.user_id = u.user_id
     ${whereClause}
     ORDER BY a.${sortColumn} ${sortOrderUpper}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );
  return result.rows.map(row => formatAppointmentResponse(row));
};

exports.getAppointmentsCount = async (filters = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (filters.user_id) { where.push(`a.user_id = $${idx++}`); params.push(filters.user_id); }
  if (filters.status) { where.push(`a.status = $${idx++}`); params.push(filters.status); }
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

exports.getAppointmentsByUser = async (userId, filters = {}) => this.listAppointments({ ...filters, user_id: userId });

exports.getUserUpcomingAppointments = async (userId) => {
  const result = await pool.query(
    `SELECT 
       a.*,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name
     FROM appointments a
     LEFT JOIN users u ON a.user_id = u.user_id
     WHERE a.user_id = $1 AND a.status IN ('pending', 'approved') AND a.scheduled_at > now()
     ORDER BY a.scheduled_at ASC`,
    [userId]
  );
  return result.rows.map(row => formatAppointmentResponse(row));
};

exports.getAppointmentsByDateRange = async (startDate, endDate, filters = {}) => this.listAppointments({ ...filters, date_from: startDate, date_to: endDate });

exports.updateAppointment = async (appointmentId, updates) => {
  const { scheduled_at, status, notes } = updates;
  const currentAppt = await this.getAppointmentById(appointmentId);
  if (!currentAppt) throw new AppError('Appointment not found', 404);
  
  const setClauses = [];
  const params = [];
  let idx = 1;

  if (scheduled_at) { setClauses.push(`scheduled_at = $${idx++}`); params.push(scheduled_at); }
  if (status !== undefined) { setClauses.push(`status = $${idx++}`); params.push(status); }
  if (notes !== undefined) { setClauses.push(`notes = $${idx++}`); params.push(notes || null); }

  if (setClauses.length === 0) return currentAppt;
  setClauses.push(`updated_at = now()`);
  
  params.push(appointmentId);
  await pool.query(`UPDATE appointments SET ${setClauses.join(', ')} WHERE appointment_id = $${idx} RETURNING *`, params);
  
  return this.getAppointmentById(appointmentId);
};

exports.rescheduleAppointment = async (appointmentId, newScheduledAt, reason) => this.updateAppointment(appointmentId, { scheduled_at: newScheduledAt, notes: reason ? `Rescheduled: ${reason}` : 'Rescheduled' });
exports.updateStatus = async (appointmentId, newStatus, reason) => this.updateAppointment(appointmentId, { status: newStatus, notes: reason ? `Status changed: ${reason}` : undefined });

exports.cancelAppointment = async (appointmentId, reason) => {
  const appointment = await this.getAppointmentById(appointmentId);
  if (!appointment) throw new AppError('Appointment not found', 404);
  const cancelNote = reason ? `Cancelled: ${reason}` : `Cancelled on ${new Date().toISOString()}`;
  await pool.query(`UPDATE appointments SET status = 'cancelled', notes = $1, updated_at = now() WHERE appointment_id = $2`, [cancelNote, appointmentId]);
  return this.getAppointmentById(appointmentId);
};

exports.getAppointmentStats = async (filters = {}) => {
  let whereClause = ''; let params = []; let idx = 1;
  if (filters.user_id) { whereClause = `WHERE user_id = $${idx++}`; params.push(filters.user_id); }
  const result = await pool.query(
    `SELECT
       COUNT(*) as total_appointments,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
     FROM appointments ${whereClause}`, params
  );
  return result.rows[0];
};

exports.getPeakHours = async (limit = 10) => {
  const result = await pool.query(
    `SELECT EXTRACT(HOUR FROM scheduled_at)::INT as hour, COUNT(*) as appointment_count
     FROM appointments WHERE status NOT IN ('cancelled') GROUP BY EXTRACT(HOUR FROM scheduled_at) ORDER BY appointment_count DESC LIMIT $1`, [limit]
  );
  return result.rows;
};

exports.getUserBookingFrequency = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*) as total_bookings, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings
     FROM appointments WHERE user_id = $1`, [userId]
  );
  return result.rows[0] || null;
};
