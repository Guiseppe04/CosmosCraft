/**
 * Appointment Service Layer
 * Business logic for appointments with full transaction support
 * Path: server/services/appointmentService.js
 */

const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const NON_BLOCKING_APPOINTMENT_STATUSES = ['cancelled', 'rejected'];
const MAX_APPOINTMENTS_PER_DAY = 10;

const HOLIDAYS = [
  '01-01',
  '04-02',
  '04-03',
  '04-09',
  '05-01',
  '06-12',
  '08-31',
  '11-30',
  '12-25',
  '12-30',
];

function isHoliday(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return HOLIDAYS.includes(`${month}-${day}`);
}

/**
 * Generate a sequential reference code for an appointment.
 * Format: APT-{YYYYMMDD}-{0001}
 * Sequence resets per scheduled_at date and includes ALL statuses
 * so numbers are never reused, even for cancelled appointments.
 */
async function generateReferenceCode(client, scheduledAt) {
  // Extract the date portion (YYYYMMDD) from scheduled_at
  const date = new Date(scheduledAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;

  // Count existing appointments for this date (include all statuses)
  const countRes = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM appointments
     WHERE scheduled_at::date = ($1::timestamptz)::date`,
    [scheduledAt]
  );

  const nextSequence = Number(countRes.rows?.[0]?.count || 0) + 1;
  const paddedSequence = String(nextSequence).padStart(4, '0');

  return `APT-${datePart}-${paddedSequence}`;
}

function normalizeGuitarDetails(guitarDetails = {}) {
  const source = (guitarDetails && typeof guitarDetails === 'object') ? guitarDetails : {};
  const guitars = Array.isArray(source.guitars) ? source.guitars : [];

  if (guitars.length > 0) {
    const normalizedGuitars = guitars.map((entry) => ({
      brand: entry?.brand || '',
      model: entry?.model || '',
      type: String(entry?.type || '').toLowerCase(),
      serial: entry?.serial || 'N/A',
      notes: entry?.notes || '',
    }));

    const firstGuitar = normalizedGuitars[0] || {};

    return {
      ...source,
      brand: source.brand || firstGuitar.brand || '',
      model: source.model || firstGuitar.model || '',
      type: String(source.type || firstGuitar.type || '').toLowerCase(),
      serial: source.serial || firstGuitar.serial || 'N/A',
      notes: source.notes || firstGuitar.notes || '',
      guitars: normalizedGuitars,
    };
  }

  return {
    ...source,
    type: String(source.type || '').toLowerCase(),
    serial: source.serial || 'N/A',
  };
}

async function assertNoScheduleConflict(client, scheduledAt, excludeAppointmentId = null) {
   const scheduledDate = new Date(scheduledAt);

   const dayOfWeek = scheduledDate.getDay();
   if (dayOfWeek === 0) {
     throw new AppError('Selected appointment date is unavailable (Sunday closure)', 409);
   }

   if (isHoliday(scheduledDate)) {
     throw new AppError('Selected appointment date is unavailable (holiday)', 409);
   }

   const unavailableRes = await client.query(
     `SELECT id FROM unavailable_dates WHERE date = ($1::timestamptz)::date LIMIT 1`,
     [scheduledAt]
   );

   if (unavailableRes.rows.length > 0) {
     throw new AppError('Selected appointment date is unavailable', 409);
   }

   const dayCount = await getActiveAppointmentCountForDate(client, scheduledAt, excludeAppointmentId);
   if (dayCount >= MAX_APPOINTMENTS_PER_DAY) {
     throw new AppError('Selected date is fully booked', 409);
   }

   const params = [scheduledAt];
   let query = `
     SELECT appointment_id
     FROM appointments
     WHERE date_trunc('minute', scheduled_at) = date_trunc('minute', $1::timestamptz)
       AND lower(status::text) NOT IN (${NON_BLOCKING_APPOINTMENT_STATUSES.map((_, index) => `$${index + 2}`).join(', ')})
   `;

   params.push(...NON_BLOCKING_APPOINTMENT_STATUSES);

   if (excludeAppointmentId) {
     params.push(excludeAppointmentId);
     query += ` AND appointment_id <> $${params.length}`;
   }

   query += ' LIMIT 1';

   const conflictRes = await client.query(query, params);
   if (conflictRes.rows.length > 0) {
     throw new AppError('Selected appointment schedule is no longer available', 409);
   }
 }

async function getActiveAppointmentCountForDate(db, date, excludeAppointmentId = null) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const params = [startOfDay, endOfDay, ...NON_BLOCKING_APPOINTMENT_STATUSES];
  let query = `
    SELECT COUNT(*)::int AS active_count
    FROM appointments
    WHERE scheduled_at >= $1
      AND scheduled_at <= $2
      AND lower(status::text) NOT IN (${NON_BLOCKING_APPOINTMENT_STATUSES.map((_, index) => `$${index + 3}`).join(', ')})
  `;

  if (excludeAppointmentId) {
    params.push(excludeAppointmentId);
    query += ` AND appointment_id <> $${params.length}`;
  }

  const result = await db.query(query, params);
  return Number(result.rows?.[0]?.active_count || 0);
}

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
    reference_code: appointment.reference_code || null,
    user_id: appointment.user_id,
    user_email: appointment.user_email,
    user_name: appointment.user_name,
    user_phone: appointment.user_phone,
    appointment_type: appointment.appointment_type || 'service_in_shop',
    order_id: appointment.order_id || null,
    customer_name: appointment.customer_name || null,
    customer_email: appointment.customer_email || null,
    customer_phone: appointment.customer_phone || null,
    services: parsedServices,
    service_name: appointment.service_name || null,
    service_names: appointment.service_names || null,
    location_id: appointment.location_id,
    guitar_details: parsedGuitarDetails,
    scheduled_at: appointment.scheduled_at,
    estimated_end_at: appointment.estimated_end_at,
    status: appointment.status,
    payment_status: appointment.payment_status || null,
    payment_method: appointment.payment_method || null,
    payment_proof_url: appointment.payment_proof_url || null,
    notes: appointment.notes,
    reason: appointment.reason || null,
    confirmation_notes: appointment.confirmation_notes || null,
    time_until_appointment_minutes: appointment.time_until_appointment_minutes || null,
    created_at: appointment.created_at,
    updated_at: appointment.updated_at,
  };
}

exports.createAppointment = async ({ appointment_type = 'service_in_shop', services = [], location_id, guitar_details, scheduled_at, notes, user_id, order_id = null, confirmation_notes = null, payment_method = null, payment_proof_url = null }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let customerName = '';
    let customerEmail = '';
    let customerPhone = '';

    if (user_id) {
      const userResult = await client.query('SELECT first_name, last_name, email, phone FROM users WHERE user_id = $1', [user_id]);
      if (userResult.rows.length === 0) throw new AppError('User not found', 400);
      const user = userResult.rows[0];
      customerName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      customerEmail = user.email || '';
      customerPhone = user.phone || '';
    }

    await assertNoScheduleConflict(client, scheduled_at);

    const normalizedGuitarDetails = normalizeGuitarDetails(guitar_details || {});

    // Generate the sequential reference code for this appointment
    const referenceCode = await generateReferenceCode(client, scheduled_at);

    const appointmentResult = await client.query(
      `INSERT INTO appointments (user_id, appointment_type, order_id, services, location_id, guitar_details, scheduled_at, status, payment_method, payment_proof_url, notes, confirmation_notes, customer_name, customer_email, customer_phone, reference_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12, $13, $14, $15, now(), now())
       RETURNING *`,
      [
        user_id || null,
        appointment_type,
        order_id,
        JSON.stringify(Array.isArray(services) ? services : []),
        location_id || null,
        JSON.stringify(normalizedGuitarDetails),
        scheduled_at,
        payment_method || null,
        payment_proof_url || null,
        notes || null,
        confirmation_notes || null,
        customerName,
        customerEmail,
        customerPhone,
        referenceCode,
      ]
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

exports.autoMarkNoShows = async () => {
  // Lazy sweep: transition confirmed appointments past 1 hour after scheduled_at to no_show.
  // Admins can still manually override back to another status afterward.
  const result = await pool.query(
    `UPDATE appointments
     SET status = 'no_show', updated_at = now()
     WHERE status = 'confirmed'
       AND scheduled_at < now() - interval '1 hour'
     RETURNING appointment_id, reference_code`
  );
  return result.rows || [];
};

exports.getAppointmentById = async (appointmentId) => {
  await this.autoMarkNoShows();
  const result = await pool.query(
    `SELECT 
       a.*,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name,
       u.phone AS user_phone,
       s.service_name,
       s.service_names,
       EXTRACT(EPOCH FROM (a.scheduled_at - now())) / 60 as time_until_appointment_minutes
     FROM appointments a
     LEFT JOIN users u ON a.user_id = u.user_id
     LEFT JOIN LATERAL (
       SELECT
         string_agg(s.name, ', ') AS service_name,
         jsonb_agg(s.name ORDER BY s.name) AS service_names
       FROM services s
       WHERE s.service_id IN (
         SELECT (jsonb_array_elements_text(a.services))::int
       )
     ) s ON true
     WHERE a.appointment_id = $1`,
    [appointmentId]
  );
  if (result.rows.length === 0) return null;
  return formatAppointmentResponse(result.rows[0]);
};

exports.listAppointments = async ({ user_id, appointment_type, status, date_from, date_to, search, sort_by = 'scheduled_at', sort_order = 'asc', limit = 20, offset = 0 } = {}) => {
  await this.autoMarkNoShows();
  let where = [];
  let params = [];
  let idx = 1;

  if (user_id) { where.push(`a.user_id = $${idx++}`); params.push(user_id); }
  if (appointment_type) { where.push(`a.appointment_type = $${idx++}`); params.push(appointment_type); }
  if (status) { where.push(`a.status = $${idx++}`); params.push(status); }
  if (date_from) { where.push(`a.scheduled_at >= $${idx++}`); params.push(date_from); }
  if (date_to) { where.push(`a.scheduled_at <= $${idx++}`); params.push(date_to); }
  if (search) {
    where.push(`(u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.email ILIKE $${idx} OR a.notes ILIKE $${idx} OR a.reference_code ILIKE $${idx} OR CAST(a.appointment_id AS TEXT) ILIKE $${idx})`);
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
       u.phone AS user_phone,
       s.service_name,
       s.service_names
     FROM appointments a
     LEFT JOIN users u ON a.user_id = u.user_id
     LEFT JOIN LATERAL (
       SELECT
         string_agg(s.name, ', ') AS service_name,
         jsonb_agg(s.name ORDER BY s.name) AS service_names
       FROM services s
       WHERE s.service_id IN (
         SELECT (jsonb_array_elements_text(a.services))::int
       )
     ) s ON true
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
  if (filters.appointment_type) { where.push(`a.appointment_type = $${idx++}`); params.push(filters.appointment_type); }
  if (filters.status) { where.push(`a.status = $${idx++}`); params.push(filters.status); }
  if (filters.search) {
    where.push(`(u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.email ILIKE $${idx} OR a.notes ILIKE $${idx} OR a.reference_code ILIKE $${idx} OR CAST(a.appointment_id AS TEXT) ILIKE $${idx})`);
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
     WHERE a.user_id = $1
       AND a.status::text IN ('pending', 'approved', 'confirmed', 'ready_for_pickup')
       AND a.scheduled_at > now()
     ORDER BY a.scheduled_at ASC`,
    [userId]
  );
  return result.rows.map(row => formatAppointmentResponse(row));
};

exports.getAppointmentsByDateRange = async (startDate, endDate, filters = {}) => this.listAppointments({ ...filters, date_from: startDate, date_to: endDate });

exports.updateAppointment = async (appointmentId, updates) => {
  const { scheduled_at, status, notes, reason, confirmation_notes, appointment_type, services, location_id, guitar_details, payment_method } = updates;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentRes = await client.query(
      'SELECT * FROM appointments WHERE appointment_id = $1 FOR UPDATE',
      [appointmentId]
    );

    if (currentRes.rows.length === 0) {
      throw new AppError('Appointment not found', 404);
    }

    const currentAppt = formatAppointmentResponse(currentRes.rows[0]);
    const setClauses = [];
    const params = [];
    let idx = 1;

    if (scheduled_at) {
      await assertNoScheduleConflict(client, scheduled_at, appointmentId);
      setClauses.push(`scheduled_at = $${idx++}`);
      params.push(scheduled_at);
    }
    if (status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      params.push(status);
    }
    if (notes !== undefined) {
      setClauses.push(`notes = $${idx++}`);
      params.push(notes || null);
    }
    if (reason !== undefined) {
      setClauses.push(`reason = $${idx++}`);
      params.push(reason || null);
    }
    if (confirmation_notes !== undefined) {
      setClauses.push(`confirmation_notes = $${idx++}`);
      params.push(confirmation_notes || null);
    }
    if (appointment_type !== undefined) {
      setClauses.push(`appointment_type = $${idx++}`);
      params.push(appointment_type);
    }
    if (services !== undefined) {
      setClauses.push(`services = $${idx++}`);
      params.push(JSON.stringify(Array.isArray(services) ? services : []));
    }
    if (location_id !== undefined) {
      setClauses.push(`location_id = $${idx++}`);
      params.push(location_id || null);
    }
    if (guitar_details !== undefined) {
      const normalizedGuitarDetails = normalizeGuitarDetails(guitar_details || {});
      setClauses.push(`guitar_details = $${idx++}`);
      params.push(JSON.stringify(normalizedGuitarDetails));
    }
    if (payment_method !== undefined) {
      setClauses.push(`payment_method = $${idx++}`);
      params.push(payment_method || null);
    }

    if (setClauses.length === 0) {
      await client.query('COMMIT');
      return currentAppt;
    }

    setClauses.push(`updated_at = now()`);
    params.push(appointmentId);

    await client.query(
      `UPDATE appointments SET ${setClauses.join(', ')} WHERE appointment_id = $${idx} RETURNING *`,
      params
    );

    await client.query('COMMIT');
    return this.getAppointmentById(appointmentId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.rescheduleAppointment = async (appointmentId, newScheduledAt, reason) =>
  this.updateAppointment(appointmentId, {
    scheduled_at: newScheduledAt,
    ...(reason !== undefined && reason !== null ? { reason } : {}),
  });

exports.updateStatus = async (appointmentId, newStatus, reason) =>
  this.updateAppointment(appointmentId, {
    status: newStatus,
    ...(reason !== undefined && reason !== null ? { reason } : {}),
  });

exports.cancelAppointment = async (appointmentId, reason) => {
  const appointment = await this.getAppointmentById(appointmentId);
  if (!appointment) throw new AppError('Appointment not found', 404);
  const cancelReason = reason || `Cancelled on ${new Date().toISOString()}`;
  await pool.query(
    `UPDATE appointments SET status = 'cancelled', reason = $1, updated_at = now() WHERE appointment_id = $2`,
    [cancelReason, appointmentId]
  );
  return this.getAppointmentById(appointmentId);
};

exports.getAppointmentStats = async (filters = {}) => {
  let whereClause = ''; let params = []; let idx = 1;
  if (filters.user_id) { whereClause = `WHERE user_id = $${idx++}`; params.push(filters.user_id); }
  const result = await pool.query(
    `SELECT
       COUNT(*) as total_appointments,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
       SUM(CASE WHEN status::text IN ('approved', 'confirmed') THEN 1 ELSE 0 END) as approved_count,
       SUM(CASE WHEN status::text = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
       SUM(CASE WHEN status::text = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
       SUM(CASE WHEN status::text = 'ready_for_pickup' THEN 1 ELSE 0 END) as ready_for_pickup_count,
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

// ─── UNAVAILABLE DATES ───────────────────────────────────────────────────────

exports.getUnavailableDates = async () => {
  const result = await pool.query(
    `SELECT
       id,
       date::text AS date,
       reason,
       is_recurring,
       created_by,
       created_at,
       updated_at
     FROM unavailable_dates
     ORDER BY date ASC`
  );
  return result.rows;
};

exports.getAvailableDates = async (dateFrom, dateTo) => {
  const result = await pool.query(
    `SELECT d::date AS date
     FROM generate_series($1::date, $2::date, '1 day'::interval) d
     WHERE EXTRACT(DOW FROM d) != 0
       AND NOT EXISTS (
         SELECT 1 FROM unavailable_dates WHERE date = d::date
       )
       AND (
         SELECT COUNT(*)
         FROM appointments
         WHERE scheduled_at >= d::date
           AND scheduled_at < d::date + interval '1 day'
           AND lower(status::text) NOT IN ('cancelled', 'rejected')
       ) < $3
     ORDER BY d::date ASC`,
    [dateFrom, dateTo, MAX_APPOINTMENTS_PER_DAY]
  );
  return result.rows.map(row => row.date);
};

exports.addUnavailableDate = async (date, reason, userId) => {
  const result = await pool.query(
    `INSERT INTO unavailable_dates (date, reason, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (date) DO UPDATE SET reason = $2, updated_at = now()
     RETURNING
       id,
       date::text AS date,
       reason,
       is_recurring,
       created_by,
       created_at,
       updated_at`,
    [date, reason || null, userId || null]
  );
  return result.rows[0];
};

exports.removeUnavailableDate = async (dateId) => {
  const result = await pool.query(
    `DELETE FROM unavailable_dates
     WHERE id = $1
     RETURNING
       id,
       date::text AS date,
       reason,
       is_recurring,
       created_by,
       created_at,
       updated_at`,
    [dateId]
  );
  return result.rows[0];
};

exports.isDateUnavailable = async (date) => {
  const result = await pool.query(
    `SELECT id FROM unavailable_dates WHERE date = ($1::timestamptz)::date`,
    [date]
  );
  return result.rows.length > 0;
};

// ─── PAYMENT STATUS ──────────────────────────────────────────────────────────

exports.updatePaymentStatus = async (appointmentId, paymentStatus, paymentMethod = null, paymentProofUrl = null) => {
  const setClauses = ['payment_status = $2'];
  const params = [appointmentId, paymentStatus];
  let idx = 3;

  if (paymentMethod !== undefined) {
    setClauses.push(`payment_method = $${idx++}`);
    params.push(paymentMethod);
  }
  if (paymentProofUrl !== undefined) {
    setClauses.push(`payment_proof_url = $${idx++}`);
    params.push(paymentProofUrl);
  }

  setClauses.push('updated_at = now()');

  await pool.query(
    `UPDATE appointments SET ${setClauses.join(', ')} WHERE appointment_id = $${idx} RETURNING *`,
    params
  );
  return this.getAppointmentById(appointmentId);
};

// ─── AVAILABLE SLOTS ─────────────────────────────────────────────────────────

exports.getAvailableSlots = async (serviceId, date, slotDuration = 30) => {
  const dayOfWeek = new Date(date).getDay();
  if (dayOfWeek === 0) return []; // Sunday closed

  // Check if date is unavailable
  const isUnavailable = await this.isDateUnavailable(date);
  if (isUnavailable) return [];

  const activeAppointmentsForDay = await getActiveAppointmentCountForDate(pool, date);
  if (activeAppointmentsForDay >= MAX_APPOINTMENTS_PER_DAY) return [];

  // Get existing appointments for the date
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const appointmentsResult = await pool.query(
    `SELECT scheduled_at, estimated_end_at FROM appointments 
     WHERE scheduled_at >= $1 AND scheduled_at <= $2 AND lower(status::text) NOT IN ('cancelled', 'rejected')`,
    [startOfDay, endOfDay]
  );

  const bookedSlots = appointmentsResult.rows.map(apt => ({
    start: new Date(apt.scheduled_at),
    end: new Date(
      apt.estimated_end_at
      || new Date(new Date(apt.scheduled_at).getTime() + slotDuration * 60 * 1000)
    )
  }));

  // Generate available slots (9 AM to 6 PM)
  const slots = [];
  const openingHour = 9;
  const closingHour = 18;

  for (let hour = openingHour; hour < closingHour; hour++) {
    for (let min = 0; min < 60; min += slotDuration) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, min, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

      // Check if slot conflicts with any booked appointment
      const isBooked = bookedSlots.some(booked =>
        (slotStart >= booked.start && slotStart < booked.end) ||
        (slotEnd > booked.start && slotEnd <= booked.end) ||
        (slotStart <= booked.start && slotEnd >= booked.end)
      );

      if (!isBooked && slotStart > new Date()) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          formatted_start: slotStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          formatted_end: slotEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        });
      }
    }
  }

  return slots;
};

exports.checkAvailability = async (serviceId, scheduledAt, durationMinutes) => {
  const date = new Date(scheduledAt);
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return false;

  const dateStr = date.toISOString().slice(0, 10);
  const isUnavailable = await this.isDateUnavailable(dateStr);
  if (isUnavailable) return false;

  const activeAppointmentsForDay = await getActiveAppointmentCountForDate(pool, scheduledAt);
  if (activeAppointmentsForDay >= MAX_APPOINTMENTS_PER_DAY) return false;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const appointmentsResult = await pool.query(
    `SELECT scheduled_at, estimated_end_at FROM appointments 
     WHERE scheduled_at >= $1 AND scheduled_at <= $2 AND lower(status::text) NOT IN ('cancelled', 'rejected')`,
    [startOfDay, endOfDay]
  );

  const slotStart = new Date(scheduledAt);
  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + (durationMinutes || 60));

  for (const apt of appointmentsResult.rows) {
    const bookedStart = new Date(apt.scheduled_at);
    const bookedEnd = new Date(
      apt.estimated_end_at || new Date(bookedStart.getTime() + (durationMinutes || 60) * 60 * 1000)
    );

    if ((slotStart >= bookedStart && slotStart < bookedEnd) ||
        (slotEnd > bookedStart && slotEnd <= bookedEnd) ||
        (slotStart <= bookedStart && slotEnd >= bookedEnd)) {
      return false;
    }
  }

  return true;
};

exports.getDailyAppointmentLoad = async (date, excludeAppointmentId = null) => {
  const day = new Date(date);
  const isUnavailable = await this.isDateUnavailable(day);
  const count = await getActiveAppointmentCountForDate(pool, day, excludeAppointmentId);

  return {
    date: day.toISOString().slice(0, 10),
    active_appointments: count,
    max_appointments: MAX_APPOINTMENTS_PER_DAY,
    is_unavailable: Boolean(isUnavailable),
    is_fully_booked: count >= MAX_APPOINTMENTS_PER_DAY,
  };
};
