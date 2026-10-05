/**
 * Appointment Service Layer
 * Business logic for appointments with full transaction support
 * Path: server/services/appointmentService.js
 */

const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { lockAppointmentCapacity } = require('../middleware/appointmentCapacityLock');

const NON_BLOCKING_APPOINTMENT_STATUSES = ['cancelled', 'rejected', 'rescheduled_by_customer'];

// E-wallet / bank transfer methods (e_wallet, e_bank, gcash, bank_transfer, ...)
// are prepaid: the appointment can only be confirmed ('confirmed') after the
// payment has been reviewed and approved. Cash is the only method that may be
// confirmed without an approved payment.
const APPOINTMENT_APPROVED_PAYMENT_STATUSES = ['approved', 'verified', 'paid', 'confirmed'];
const isApprovedAppointmentPayment = (status) => APPOINTMENT_APPROVED_PAYMENT_STATUSES.includes(String(status || '').toLowerCase());
const isPrepaidPaymentMethod = (method) => Boolean(String(method || '').trim()) && String(method).trim().toLowerCase() !== 'cash';
const assertPaymentApprovedBeforeConfirmation = (appointment) => {
  if (isPrepaidPaymentMethod(appointment.payment_method) && !isApprovedAppointmentPayment(appointment.payment_status)) {
    throw new AppError(
      `This appointment cannot be confirmed until the ${appointment.payment_method} payment has been reviewed and approved.`,
      409
    );
  }
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Statuses that end an appointment's life. A customer can no longer cancel once
// one of these is reached. Mirrors isTerminalStatus in AppointmentCard.jsx.
const CUSTOMER_UNCANCELLABLE_STATUSES = [
  'ready_for_pickup',
  'completed',
  'cancelled',
  'rejected',
  'no_show',
  'rescheduled_by_customer',
];

// Also cover pickup appointments whose build/fulfillment progressed separately.
const RELATED_PICKUP_READY_SQL = `EXISTS (
  SELECT 1 FROM projects p
  WHERE (p.order_id = a.order_id OR p.pickup_appointment_id = a.appointment_id)
    AND p.fulfillment_status IN ('ready_for_pickup', 'picked_up', 'received')
) OR EXISTS (
  SELECT 1 FROM fulfillment_requests fr
  WHERE (fr.order_id = a.order_id OR fr.pickup_appointment_id = a.appointment_id)
    AND fr.status IN ('ready_for_pickup', 'completed')
) OR EXISTS (
  SELECT 1 FROM orders o WHERE o.order_id = a.order_id AND o.status::text = 'ready_for_pickup'
)`;

const assertCustomerCanCancel = (appointment) => {
  if (CUSTOMER_UNCANCELLABLE_STATUSES.includes(String(appointment.status || '').toLowerCase()) || appointment.related_pickup_ready) {
    throw new AppError('This appointment can no longer be cancelled because it is ready for pickup or already closed.', 400);
  }
  if (['approved', 'paid', 'verified', 'confirmed', 'refunded'].includes(String(appointment.payment_status || '').toLowerCase())) {
    throw new AppError('An approved payment cannot be cancelled directly. Please use the appointment refund process or contact the shop for assistance.', 400);
  }
};

// ─── STATUS TRANSITION RULES ─────────────────────────────────────────────────

/**
 * Defines the valid status transitions for each appointment type.
 * `null` in the appointmentType key means the rule applies to ALL types.
 */
const STATUS_TRANSITIONS = {
  pending: [
    { to: 'confirmed', types: null },
    { to: 'cancelled', types: null },
  ],
  confirmed: [
    { to: 'in_progress', types: null },
    { to: 'cancelled', types: null },
    { to: 'no_show', types: null },
  ],
  in_progress: [
    { to: 'completed', types: ['service_home'] },
    { to: 'ready_for_pickup', types: ['service_in_shop'] },
    { to: 'cancelled', types: null },
  ],
  ready_for_pickup: [
    { to: 'completed', types: ['service_in_shop'] },
    { to: 'cancelled', types: null },
  ],
  // Terminal statuses — no transitions allowed
  completed: [],
  cancelled: [],
  no_show: [],
  rescheduled_by_customer: [],
};

/**
 * Validates that the requested status transition is allowed for the given
 * appointment type. Throws HTTP 409 Conflict on invalid transitions.
 *
 * @param {string} currentStatus - The appointment's current status
 * @param {string} nextStatus    - The requested new status
 * @param {string} appointmentType - 'service_in_shop' | 'service_home' | 'pickup'
 */
function assertValidAppointmentStatusTransition(currentStatus, nextStatus, appointmentType) {
  // Same-status update is a no-op — allowed silently
  if (currentStatus === nextStatus) return;

  const allowed = STATUS_TRANSITIONS[currentStatus];

  if (!allowed) {
    throw new AppError(
      `Unknown current status '${currentStatus}'. Cannot transition to '${nextStatus}'.`,
      409
    );
  }

  const match = allowed.find((rule) => {
    if (rule.to !== nextStatus) return false;
    // If types is null the rule applies to all appointment types
    if (rule.types === null) return true;
    return rule.types.includes(appointmentType);
  });

  if (!match) {
    throw new AppError(
      `Invalid status transition: '${currentStatus}' → '${nextStatus}' is not allowed` +
      (appointmentType ? ` for appointment type '${appointmentType}'` : '') +
      '.',
      409
    );
  }
}

async function getActiveStaffCount(db = pool) {
  const result = await db.query(
    `SELECT COUNT(DISTINCT u.user_id)::int AS staff_count
     FROM users u
     WHERE u.is_active = true
       AND u.deleted_at IS NULL
       AND (
         EXISTS (
           SELECT 1
           FROM user_roles ur
           JOIN roles r ON r.role_id = ur.role_id
           WHERE ur.user_id = u.user_id
             AND r.name = 'staff'
             AND (ur.is_active = true OR ur.expires_at > now())
         )
         OR (
           u.role::text = 'staff'
           AND NOT EXISTS (
             SELECT 1 FROM user_roles ur WHERE ur.user_id = u.user_id
           )
         )
       )`
  );
  return Number(result.rows?.[0]?.staff_count || 0);
}

const { isHoliday, appointmentDateKey } = require('../utils/philippineHolidays');

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

   const dayOfWeek = new Date(`${appointmentDateKey(scheduledDate)}T00:00:00Z`).getUTCDay();
   if (dayOfWeek === 0) {
     const sundayOverride = await client.query(
       `SELECT id FROM unavailable_dates
        WHERE date = ($1::timestamptz AT TIME ZONE 'Asia/Manila')::date AND is_open_override = TRUE LIMIT 1`,
       [scheduledAt]
     );
     if (sundayOverride.rows.length === 0) {
       throw new AppError('Selected appointment date is unavailable (Sunday closure)', 409);
     }
   }

   // Check for holiday — but allow if admin has created an open override
   if (isHoliday(scheduledDate)) {
     const overrideRes = await client.query(
       `SELECT id FROM unavailable_dates
        WHERE date = ($1::timestamptz AT TIME ZONE 'Asia/Manila')::date AND is_open_override = TRUE LIMIT 1`,
       [scheduledAt]
     );
     if (overrideRes.rows.length === 0) {
       throw new AppError('Selected appointment date is unavailable (holiday)', 409);
     }
   }

   // Block if admin has explicitly marked this date unavailable (non-override)
   const unavailableRes = await client.query(
     `SELECT id FROM unavailable_dates
      WHERE date = ($1::timestamptz AT TIME ZONE 'Asia/Manila')::date AND is_open_override = FALSE LIMIT 1`,
     [scheduledAt]
   );

   if (unavailableRes.rows.length > 0) {
     throw new AppError('Selected appointment date is unavailable', 409);
   }

   const dayCount = await getActiveAppointmentCountForDate(client, scheduledAt, excludeAppointmentId);
   const capacity = await getActiveStaffCount(client);
   if (capacity === 0 || dayCount >= capacity) {
     throw new AppError('Selected date is fully booked', 409);
   }

   const params = [scheduledAt];
   let query = `
     SELECT COUNT(*)::int AS booking_count
     FROM appointments
     WHERE date_trunc('minute', scheduled_at) = date_trunc('minute', $1::timestamptz)
       AND lower(status::text) NOT IN (${NON_BLOCKING_APPOINTMENT_STATUSES.map((_, index) => `$${index + 2}`).join(', ')})
   `;

   params.push(...NON_BLOCKING_APPOINTMENT_STATUSES);

   if (excludeAppointmentId) {
     params.push(excludeAppointmentId);
     query += ` AND appointment_id <> $${params.length}`;
   }

   const conflictRes = await client.query(query, params);
   if (Number(conflictRes.rows[0]?.booking_count || 0) >= capacity) {
     throw new AppError('This time slot is fully booked. Please select another available time.', 409);
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

  const calculatedTotal = Array.isArray(appointment.service_details) && appointment.service_details.length > 0
    ? appointment.service_details.reduce((sum, s) => sum + (Number(s.price) || 0), 0)
    : (Number(appointment.total_amount) || null);

  return {
    appointment_id: appointment.appointment_id,
    reference_code: appointment.reference_code || null,
    rescheduled_from: appointment.rescheduled_from || null,
    approved_payment_amount: appointment.approved_payment_amount || null,
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
    service_details: appointment.service_details || null,
    total_amount: calculatedTotal,
    amount_paid: calculatedTotal,
    location_id: appointment.location_id,
    customer_address: appointment.customer_address || appointment.address || null,
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

// ─── SERVICE VALIDATION & DURATION ──────────────────────────────────────────

/**
 * Validates that every submitted service ID exists, is active, and is not
 * deleted. Returns the loaded service rows (for duration calculation).
 *
 * @param {import('pg').PoolClient|import('pg').Pool} db
 * @param {Array<string|number>} serviceIds
 * @returns {Promise<Array<{service_id:number, name:string, duration_minutes:number, price:string}>>}
 */
async function validateAndLoadServices(db, serviceIds) {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new AppError('services must be a non-empty array of service IDs', 400);
  }

  const ids = serviceIds.map((id) => parseInt(id, 10));
  if (ids.some((id) => Number.isNaN(id))) {
    throw new AppError('All service IDs must be valid integers', 400);
  }

  const result = await db.query(
    `SELECT service_id, name, duration_minutes, price
     FROM services
     WHERE service_id = ANY($1::int[])
       AND is_active = true
       AND deleted_at IS NULL`,
    [ids]
  );

  if (result.rows.length !== ids.length) {
    const foundIds = new Set(result.rows.map((r) => r.service_id));
    const missing = ids.filter((id) => !foundIds.has(id));
    throw new AppError(
      `Service ID(s) not found or inactive: ${missing.join(', ')}`,
      422
    );
  }

  return result.rows;
}

/**
 * Calculates total appointment duration in minutes from an array of service rows.
 * @param {Array<{duration_minutes:number}>} serviceRows
 * @returns {number}
 */
function calculateTotalDuration(serviceRows) {
  return serviceRows.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
}

exports.createAppointment = async ({ appointment_type = 'service_in_shop', services = [], location_id, guitar_details, scheduled_at, notes, user_id, order_id = null, confirmation_notes = null, payment_method = null, payment_proof_url = null, address_id = null, contact_number = null }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockAppointmentCapacity(client);

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

    // The contact number captured on the booking form wins over the profile phone
    // so the number the customer typed for this appointment is the one on record.
    const trimmedContactNumber = String(contact_number || '').trim();
    if (trimmedContactNumber) {
      customerPhone = trimmedContactNumber;
    }

    await assertNoScheduleConflict(client, scheduled_at);

    const normalizedGuitarDetails = normalizeGuitarDetails(guitar_details || {});

    // ── Service validation: load from DB, reject invalid/inactive IDs ─────────
    // Only validate for service appointment types (not pickup)
    let serviceIds = [];
    let totalDurationMinutes = 0;
    if (appointment_type !== 'pickup' && Array.isArray(services) && services.length > 0) {
      const serviceRows = await validateAndLoadServices(client, services);
      serviceIds = serviceRows.map((s) => s.service_id);
      totalDurationMinutes = calculateTotalDuration(serviceRows);
    } else {
      serviceIds = Array.isArray(services) ? services.map((id) => parseInt(id, 10)) : [];
    }

    // ── estimated_end_at: scheduled_at + total service duration ───────────────
    const estimatedEndAt = totalDurationMinutes > 0
      ? new Date(new Date(scheduled_at).getTime() + totalDurationMinutes * 60 * 1000).toISOString()
      : null;

    // Generate the sequential reference code for this appointment
    const referenceCode = await generateReferenceCode(client, scheduled_at);

    const appointmentResult = await client.query(
      `INSERT INTO appointments (user_id, appointment_type, order_id, services, location_id, guitar_details, scheduled_at, estimated_end_at, status, payment_method, payment_status, payment_proof_url, notes, confirmation_notes, customer_name, customer_email, customer_phone, reference_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, 'pending', $10, $11, $12, $13, $14, $15, $16, now(), now())
       RETURNING *`,
      [
        user_id || null,
        appointment_type,
        order_id,
        JSON.stringify(serviceIds),
        location_id || null,
        JSON.stringify(normalizedGuitarDetails),
        scheduled_at,
        estimatedEndAt,
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
  await require('./paymentSettingsService').ensurePaymentSettingsTable();
  const settings = await pool.query('SELECT no_show_grace_minutes FROM payment_settings WHERE id = 1');
  const graceMinutes = settings.rows[0]?.no_show_grace_minutes ?? 30;
  const result = await pool.query(
    `WITH overdue AS (
       SELECT appointment_id, status AS previous_status
       FROM appointments
       WHERE (status = 'pending' AND scheduled_at < now())
          OR (status = 'confirmed' AND scheduled_at <= now() - ($1 * interval '1 minute'))
       FOR UPDATE
     )
     UPDATE appointments a
     SET status = 'no_show', updated_at = now()
     FROM overdue
     WHERE a.appointment_id = overdue.appointment_id
     RETURNING a.*, overdue.previous_status`,
    [graceMinutes]
  );
  for (const row of result.rows || []) {
    require('./socketService').emitToUserAndStaff(row.user_id, 'appointment:updated', {
      appointment: formatAppointmentResponse(row),
      action: 'no_show',
    });
  }

  // The sweep runs without an actor, so these rows are recorded as automatic
  // transitions rather than disappearing from the audit trail entirely.
  for (const row of result.rows || []) {
    const previousStatus = row.previous_status;
    const appliedGrace = previousStatus === 'pending' ? 0 : graceMinutes;
    await require('./auditService').logAppointmentEvent({
      userId: null,
      action: 'APPOINTMENT_NO_SHOW',
      entityId: row.appointment_id,
      entityType: 'appointment',
      status: 'no_show',
      previousStatus,
      details: {
        from: previousStatus,
        to: 'no_show',
        automatic: true,
        note: `Marked automatically ${appliedGrace} minutes after the scheduled time`,
        grace_minutes: appliedGrace,
      },
      context: {
        appointmentId: row.appointment_id,
        referenceCode: row.reference_code,
        previousStatus,
        automatic: true,
      },
    });
  }

  return result.rows || [];
};

/**
 * `appointments.appointment_id` is a uuid. A value that is not a uuid can never
 * match a row, and letting it reach Postgres raises 22P02 ("invalid input syntax
 * for type uuid"), which surfaces as a 500. Reject it up front so a mistyped or
 * unmatched path behaves like the lookup it actually is.
 */
const assertAppointmentId = (appointmentId) => {
  const value = String(appointmentId || '').trim();
  if (!UUID_PATTERN.test(value)) {
    throw new AppError('Appointment not found', 404);
  }
  return value;
};

exports.getAppointmentById = async (appointmentId) => {
  assertAppointmentId(appointmentId);
  await this.autoMarkNoShows();
  const result = await pool.query(
    `SELECT 
       a.*,
       (${RELATED_PICKUP_READY_SQL}) AS related_pickup_ready,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name,
       u.phone AS user_phone,
       s.service_name,
       s.service_names,
       s.service_details,
       COALESCE(
         NULLIF(TRIM(CONCAT_WS(', ', addr.line1, addr.line2, addr.barangay, addr.city, addr.province, addr.postal_code)), ''),
         CASE WHEN a.appointment_type = 'service_home' THEN a.location_id ELSE NULL END
       ) AS customer_address,
       EXTRACT(EPOCH FROM (a.scheduled_at - now())) / 60 as time_until_appointment_minutes
     FROM appointments a
     LEFT JOIN users u ON a.user_id = u.user_id
     LEFT JOIN LATERAL (
       SELECT
         string_agg(s.name, ', ') AS service_name,
         jsonb_agg(s.name ORDER BY s.name) AS service_names,
         jsonb_agg(
           jsonb_build_object(
             'service_id', s.service_id,
             'name', s.name,
             'price', s.price,
             'duration_minutes', s.duration_minutes
           ) ORDER BY s.name
         ) AS service_details
       FROM services s
       WHERE s.service_id IN (
         SELECT el::int
         FROM jsonb_array_elements_text(COALESCE(NULLIF(a.services, 'null'::jsonb), '[]'::jsonb)) AS el
         WHERE el ~ '^[0-9]+$'
       )
     ) s ON true
     LEFT JOIN addresses addr ON (
       a.appointment_type = 'service_home'
       AND a.location_id IS NOT NULL
       AND addr.address_id::text = a.location_id
     )
     WHERE a.appointment_id = $1`,
    [appointmentId]
  );
  if (result.rows.length === 0) return null;
  return formatAppointmentResponse(result.rows[0]);
};

exports.listAppointments = async ({ user_id, appointment_type, status, date_from, date_to, payment_method, search, sort_by = 'created_at', sort_order = 'desc', limit = 20, offset = 0 } = {}) => {
  await this.autoMarkNoShows();
  let where = [];
  let params = [];
  let idx = 1;

  if (user_id) { where.push(`a.user_id = $${idx++}`); params.push(user_id); }
  if (appointment_type) { where.push(`a.appointment_type = $${idx++}`); params.push(appointment_type); }
  if (status) { where.push(`a.status = $${idx++}`); params.push(status); }
  if (date_from) { where.push(`a.scheduled_at >= $${idx++}`); params.push(date_from); }
  if (date_to) { where.push(`a.scheduled_at <= $${idx++}`); params.push(date_to); }
  if (payment_method) { where.push(`a.payment_method = $${idx++}`); params.push(payment_method); }
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
       (${RELATED_PICKUP_READY_SQL}) AS related_pickup_ready,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name,
       u.phone AS user_phone,
       s.service_name,
       s.service_names,
       s.service_details,
       COALESCE(
         NULLIF(TRIM(CONCAT_WS(', ', addr.line1, addr.line2, addr.barangay, addr.city, addr.province, addr.postal_code)), ''),
         CASE WHEN a.appointment_type = 'service_home' THEN a.location_id ELSE NULL END
       ) AS customer_address
     FROM appointments a
     LEFT JOIN users u ON a.user_id = u.user_id
     LEFT JOIN LATERAL (
       SELECT
         string_agg(s.name, ', ') AS service_name,
         jsonb_agg(s.name ORDER BY s.name) AS service_names,
         jsonb_agg(
           jsonb_build_object(
             'service_id', s.service_id,
             'name', s.name,
             'price', s.price,
             'duration_minutes', s.duration_minutes
           ) ORDER BY s.name
         ) AS service_details
       FROM services s
       WHERE s.service_id IN (
         SELECT el::int
         FROM jsonb_array_elements_text(COALESCE(NULLIF(a.services, 'null'::jsonb), '[]'::jsonb)) AS el
         WHERE el ~ '^[0-9]+$'
       )
     ) s ON true
     LEFT JOIN addresses addr ON (
       a.appointment_type = 'service_home'
       AND a.location_id IS NOT NULL
       AND addr.address_id::text = a.location_id
     )
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
  if (filters.payment_method) { where.push(`a.payment_method = $${idx++}`); params.push(filters.payment_method); }
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
  // 'Upcoming' = the appointment is not yet terminal and has not started.
  // pending  → waiting for staff confirmation
  // confirmed → scheduled but not yet started
  // in_progress and ready_for_pickup are active/on-going, intentionally excluded
  // from the 'upcoming' list to avoid confusion with truly future appointments.
  const result = await pool.query(
    `SELECT 
       a.*,
       u.email AS user_email,
       u.first_name || ' ' || u.last_name AS user_name
     FROM appointments a
     LEFT JOIN users u ON a.user_id = u.user_id
     WHERE a.user_id = $1
       AND a.status::text IN ('pending', 'confirmed')
       AND a.scheduled_at > now()
     ORDER BY a.scheduled_at ASC`,
    [userId]
  );
  return result.rows.map(row => formatAppointmentResponse(row));
};

/**
 * Builds the audit context for an appointment event.
 *
 * Appointments are reachable by their reference code in support conversations
 * but their id is an opaque UUID, so the code, the customer and the booking
 * time travel with the audit row.
 */
const appointmentAuditContext = (appointment) => ({
  appointmentId: appointment.appointment_id,
  referenceCode: appointment.reference_code,
  appointmentType: appointment.appointment_type,
  scheduledAt: appointment.scheduled_at,
  customerName: appointment.user_name,
  customerEmail: appointment.user_email,
  contactNumber: appointment.customer_phone,
  status: appointment.status,
});

exports.getAppointmentsByDateRange = async (startDate, endDate, filters = {}) => this.listAppointments({ ...filters, date_from: startDate, date_to: endDate });

exports.updateAppointment = async (appointmentId, updates, actorId = null) => {
  assertAppointmentId(appointmentId);
  const { scheduled_at, status, notes, reason, confirmation_notes, appointment_type, services, location_id, guitar_details, payment_method, contact_number } = updates;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await lockAppointmentCapacity(client);

    const currentRes = await client.query(
      `SELECT a.*,
              u.email AS user_email,
              u.first_name || ' ' || u.last_name AS user_name
       FROM appointments a
       LEFT JOIN users u ON u.user_id = a.user_id
       WHERE a.appointment_id = $1 FOR UPDATE OF a`,
      [appointmentId]
    );

    if (currentRes.rows.length === 0) {
      throw new AppError('Appointment not found', 404);
    }

    const currentAppt = formatAppointmentResponse(currentRes.rows[0]);
    if (currentAppt.status === 'rescheduled_by_customer') throw new AppError('Historical appointments cannot be changed', 409);
    // Prepaid e-wallet / bank transfer bookings can only be confirmed after the
    // payment has been reviewed and approved by the shop.
    if (status !== undefined && String(status).toLowerCase() === 'confirmed') {
      assertPaymentApprovedBeforeConfirmation(currentAppt);
    }
    let targetId = appointmentId;
    if (scheduled_at && actorId === currentAppt.user_id) {
      if (!['pending', 'confirmed', 'no_show'].includes(currentAppt.status)) throw new AppError('This appointment cannot be rescheduled', 409);
      if (new Date(scheduled_at).getTime() === new Date(currentAppt.scheduled_at).getTime()) throw new AppError('Choose a different schedule', 400);
      const refund = await client.query('SELECT 1 FROM appointment_refunds WHERE appointment_id = $1', [appointmentId]);
      if (refund.rows.length) throw new AppError('An appointment with a refund request cannot be rescheduled', 409);
      await assertNoScheduleConflict(client, scheduled_at, appointmentId);
      if (currentAppt.payment_status === 'approved' && services !== undefined) {
        const originalServices = [...(currentAppt.services || [])].map(String).sort();
        const requestedServices = [...services].map(String).sort();
        if (JSON.stringify(originalServices) !== JSON.stringify(requestedServices)) throw new AppError('Services cannot change when rescheduling an approved payment', 409);
      }
      const reference = await generateReferenceCode(client, scheduled_at);
      const successor = await client.query(`INSERT INTO appointments
        (user_id, appointment_type, order_id, services, location_id, guitar_details, scheduled_at, estimated_end_at,
         status, payment_method, payment_status, payment_proof_url, notes, customer_name, customer_email, customer_phone,
         reference_code, rescheduled_from, approved_payment_amount)
        SELECT user_id, appointment_type, order_id, services, location_id, guitar_details, $2,
          CASE WHEN estimated_end_at IS NULL THEN NULL ELSE $2::timestamptz + (estimated_end_at - scheduled_at) END,
          CASE WHEN payment_status::text = 'approved' THEN 'confirmed'::appointment_status_enum ELSE 'pending'::appointment_status_enum END,
          payment_method, payment_status, payment_proof_url, notes, customer_name, customer_email, customer_phone,
          $3, appointment_id, approved_payment_amount FROM appointments WHERE appointment_id = $1 RETURNING appointment_id`,
        [appointmentId, scheduled_at, reference]);
      targetId = successor.rows[0].appointment_id;
      await client.query("UPDATE appointments SET status = 'rescheduled_by_customer', updated_at = now() WHERE appointment_id = $1", [appointmentId]);
      await require('./appointmentRefundService').recordEvent(client, currentAppt, actorId, 'rescheduled_by_customer', currentAppt.status,
        { old_schedule: currentAppt.scheduled_at, new_schedule: scheduled_at, new_appointment_id: targetId });
      await require('./appointmentRefundService').notify(client, currentAppt.user_id, 'Appointment rescheduled',
        `Previous schedule: ${currentAppt.scheduled_at}. New schedule: ${scheduled_at}.`, targetId, true);
    }
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
    const paymentApproved = ['approved', 'paid', 'verified', 'confirmed'].includes(String(currentAppt.payment_status || '').toLowerCase());
    if (scheduled_at && currentAppt.status === 'no_show' && status === undefined && targetId === appointmentId) {
      setClauses.push(`status = $${idx++}`);
      params.push(paymentApproved ? 'confirmed' : 'pending');
    }
    if (payment_method !== undefined && !(scheduled_at && paymentApproved)) {
      setClauses.push(`payment_method = $${idx++}`);
      params.push(payment_method || null);
    }
    if (contact_number !== undefined) {
      const trimmedContactNumber = String(contact_number || '').trim();
      setClauses.push(`customer_phone = $${idx++}`);
      params.push(trimmedContactNumber || null);
    }

    if (setClauses.length === 0) {
      await client.query('COMMIT');
      return currentAppt;
    }

    setClauses.push(`updated_at = now()`);
    params.push(targetId);

    const updateRes = await client.query(
      `UPDATE appointments SET ${setClauses.join(', ')} WHERE appointment_id = $${idx} RETURNING *`,
      params
    );

    const updatedAppt = formatAppointmentResponse(updateRes.rows[0]);

    await require('./auditService').logAppointmentEvent({
      userId: actorId,
      action: updatedAppt.status !== currentAppt.status ? `APPOINTMENT_${updatedAppt.status}` : 'UPDATE',
      entityId: appointmentId,
      entityType: 'appointment',
      status: updatedAppt.status,
      previousStatus: currentAppt.status,
      details: {
        updated_fields: Object.keys(updates),
        previous: {
          scheduled_at: currentAppt.scheduled_at,
          status: currentAppt.status,
          appointment_type: currentAppt.appointment_type,
          notes: currentAppt.notes,
          reason: currentAppt.reason,
          confirmation_notes: currentAppt.confirmation_notes,
          payment_method: currentAppt.payment_method,
          customer_phone: currentAppt.customer_phone,
        },
        updated: {
          scheduled_at: updatedAppt.scheduled_at,
          status: updatedAppt.status,
          appointment_type: updatedAppt.appointment_type,
          notes: updatedAppt.notes,
          reason: updatedAppt.reason,
          confirmation_notes: updatedAppt.confirmation_notes,
          payment_method: updatedAppt.payment_method,
          customer_phone: updatedAppt.customer_phone,
        },
      },
      context: {
        ...appointmentAuditContext(updatedAppt),
        previousStatus: currentAppt.status,
      },
      changes: require('./auditContext').buildChanges(
        {
          scheduled_at: currentAppt.scheduled_at,
          status: currentAppt.status,
          appointment_type: currentAppt.appointment_type,
          notes: currentAppt.notes,
          reason: currentAppt.reason,
          confirmation_notes: currentAppt.confirmation_notes,
          payment_method: currentAppt.payment_method,
          customer_phone: currentAppt.customer_phone,
        },
        {
          scheduled_at: updatedAppt.scheduled_at,
          status: updatedAppt.status,
          appointment_type: updatedAppt.appointment_type,
          notes: updatedAppt.notes,
          reason: updatedAppt.reason,
          confirmation_notes: updatedAppt.confirmation_notes,
          payment_method: updatedAppt.payment_method,
          customer_phone: updatedAppt.customer_phone,
        }
      ),
      executor: client,
    });

    await client.query('COMMIT');
    return this.getAppointmentById(targetId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.rescheduleAppointment = async (appointmentId, newScheduledAt, reason, actorId = null) =>
  this.updateAppointment(appointmentId, {
    scheduled_at: newScheduledAt,
    ...(reason !== undefined && reason !== null ? { reason } : {}),
  }, actorId);

exports.updateStatus = async (appointmentId, newStatus, reason, actorId = null) => {
  assertAppointmentId(appointmentId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Retrieve the current appointment (with row-lock to prevent races)
    const currentRes = await client.query(
      `SELECT a.appointment_id, a.status, a.appointment_type, a.reference_code,
              a.scheduled_at, a.user_id, a.payment_method, a.payment_status,
              u.email AS user_email,
              u.first_name || ' ' || u.last_name AS user_name
       FROM appointments a
       LEFT JOIN users u ON u.user_id = a.user_id
       WHERE a.appointment_id = $1 FOR UPDATE OF a`,
      [appointmentId]
    );

    // 2. Verify appointment exists
    if (currentRes.rows.length === 0) {
      throw new AppError('Appointment not found', 404);
    }

    const { status: currentStatus, appointment_type: appointmentType } = currentRes.rows[0];
    const currentRow = currentRes.rows[0];

    // 3. Validate the requested transition (throws 409 on invalid)
    assertValidAppointmentStatusTransition(currentStatus, newStatus, appointmentType);

    // Prepaid e-wallet / bank transfer bookings can only be confirmed once the
    // payment has been reviewed and approved by the shop.
    if (String(newStatus).toLowerCase() === 'confirmed') {
      assertPaymentApprovedBeforeConfirmation(currentRow);
    }

    // 4. Same-status → no-op, return current data immediately
    if (currentStatus === newStatus) {
      await client.query('COMMIT');
      return this.getAppointmentById(appointmentId);
    }

    // 5. Perform the update
    const params = [newStatus, appointmentId];
    let sql = `UPDATE appointments SET status = $1, updated_at = now()`;
    if (reason !== undefined && reason !== null) {
      sql += `, reason = $3`;
      params.push(reason);
    }
    sql += ` WHERE appointment_id = $2`;
    await client.query(sql, params);

    await require('./auditService').logAppointmentEvent({
      userId: actorId,
      action: `APPOINTMENT_${newStatus}`,
      entityId: appointmentId,
      entityType: 'appointment',
      status: newStatus,
      previousStatus: currentStatus,
      details: { from: currentStatus, to: newStatus, reason },
      context: {
        ...appointmentAuditContext({ ...currentRow, status: newStatus }),
        previousStatus: currentStatus,
        reason,
      },
      executor: client,
    });

    await require('./appointmentRefundService').notify(client, currentRow.user_id, 'Appointment status updated', `Your appointment is now ${newStatus.replace(/_/g, ' ')}.`, appointmentId);
    await client.query('COMMIT');

    // 6. Return the formatted appointment response
    return this.getAppointmentById(appointmentId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.cancelAppointment = async (appointmentId, reason, { forCustomer = false, actorId = null } = {}) => {
  const appointment = await this.getAppointmentById(appointmentId);
  if (!appointment) throw new AppError('Appointment not found', 404);

  // Customers are held to a stricter rule than staff/admin, who still need to be
  // able to cancel or reconcile appointments that already elapsed.
  //   - an elapsed appointment can only be rescheduled, never cancelled
  //   - a settled appointment can no longer be cancelled by its owner
  // Staff/admin (forCustomer = false) bypass both checks.
  if (forCustomer) {
    // Checked before status because getAppointmentById() auto-flags elapsed
    // 'confirmed' appointments to 'no_show', and the reschedule guidance is the
    // more actionable message for the customer.
    const scheduledAt = appointment.scheduled_at ? new Date(appointment.scheduled_at) : null;
    if (scheduledAt && !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() < Date.now()) {
      throw new AppError('This appointment is past due and can no longer be cancelled. Please reschedule it instead.', 400);
    }

    const status = String(appointment.status || '').toLowerCase();
    if (CUSTOMER_UNCANCELLABLE_STATUSES.includes(status)) {
      throw new AppError(`Cannot cancel a ${status.replace(/_/g, ' ')} appointment`, 400);
    }
    assertCustomerCanCancel(appointment);
  }

  const cancelReason = reason || `Cancelled on ${new Date().toISOString()}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (forCustomer) {
      const locked = await client.query(
        `SELECT a.*, (${RELATED_PICKUP_READY_SQL}) AS related_pickup_ready
         FROM appointments a WHERE a.appointment_id = $1 FOR UPDATE OF a`,
        [appointmentId]
      );
      if (!locked.rows[0]) throw new AppError('Appointment not found', 404);
      assertCustomerCanCancel(locked.rows[0]);
    }
    await client.query(
      `UPDATE appointments SET status = 'cancelled', reason = $1, updated_at = now() WHERE appointment_id = $2`,
      [cancelReason, appointmentId]
    );

    await require('./auditService').logAppointmentEvent({
      userId: actorId,
      action: 'APPOINTMENT_CANCELLED',
      entityId: appointmentId,
      entityType: 'appointment',
      status: 'cancelled',
      previousStatus: appointment.status,
      details: { from: appointment.status, to: 'cancelled', reason: cancelReason },
      context: {
        ...appointmentAuditContext(appointment),
        previousStatus: appointment.status,
        reason: cancelReason,
      },
      executor: client,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return this.getAppointmentById(appointmentId);
};

exports.getAppointmentStats = async (filters = {}) => {
  let whereClause = ''; let params = []; let idx = 1;
  if (filters.user_id) { whereClause = `WHERE user_id = $${idx++}`; params.push(filters.user_id); }
  const result = await pool.query(
    `SELECT
       COUNT(*) as total_appointments,
       SUM(CASE WHEN status::text = 'pending' THEN 1 ELSE 0 END) as pending_count,
       SUM(CASE WHEN status::text = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
       SUM(CASE WHEN status::text = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
       SUM(CASE WHEN status::text = 'ready_for_pickup' THEN 1 ELSE 0 END) as ready_for_pickup_count,
       SUM(CASE WHEN status::text = 'completed' THEN 1 ELSE 0 END) as completed_count,
       SUM(CASE WHEN status::text = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
       SUM(CASE WHEN status::text = 'rescheduled_by_customer' THEN 1 ELSE 0 END) as rescheduled_count,
       SUM(CASE WHEN status::text = 'no_show' THEN 1 ELSE 0 END) as no_show_count
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
       is_open_override,
       created_by,
       created_at,
       updated_at
     FROM unavailable_dates
     WHERE is_open_override = FALSE
     ORDER BY date ASC`
  );
  return result.rows;
};

exports.getOpenOverrides = async () => {
  const result = await pool.query(
    `SELECT
       id,
       date::text AS date,
       reason,
       is_open_override,
       created_by,
       created_at,
       updated_at
     FROM unavailable_dates
     WHERE is_open_override = TRUE
     ORDER BY date ASC`
  );
  return result.rows;
};

exports.getAvailableDates = async (dateFrom, dateTo) => {
  const capacity = await getActiveStaffCount(pool);
  if (capacity === 0) return [];
  const result = await pool.query(
    `SELECT d::date AS date,
       EXISTS (SELECT 1 FROM unavailable_dates WHERE date = d::date AND is_open_override = TRUE) AS is_open_override
     FROM generate_series($1::date, $2::date, '1 day'::interval) d
     WHERE (EXTRACT(DOW FROM d) != 0
       OR EXISTS (
         SELECT 1 FROM unavailable_dates WHERE date = d::date AND is_open_override = TRUE
       ))
       AND NOT EXISTS (
         SELECT 1 FROM unavailable_dates WHERE date = d::date AND is_open_override = FALSE
       )
       AND (
         SELECT COUNT(*)
         FROM appointments
         WHERE scheduled_at >= d::date
           AND scheduled_at < d::date + interval '1 day'
           AND lower(status::text) NOT IN ('cancelled', 'rejected', 'rescheduled_by_customer')
       ) < $3
     ORDER BY d::date ASC`,
    [dateFrom, dateTo, capacity]
  );
  return result.rows.filter(row => row.is_open_override || !isHoliday(new Date(row.date))).map(row => row.date);
};

exports.getAppointmentCapacity = async () => {
  const activeStaffCount = await getActiveStaffCount(pool);
  return {
    active_staff_count: activeStaffCount,
    appointment_capacity: activeStaffCount,
  };
};

exports.getOccupiedDates = async (dateFrom, dateTo) => {
  const capacity = await getActiveStaffCount(pool);
  const result = await pool.query(
    `SELECT d::date::text AS date
     FROM generate_series($1::date, $2::date, '1 day'::interval) d
     WHERE (
       SELECT COUNT(*) FROM appointments
       WHERE (scheduled_at AT TIME ZONE 'Asia/Manila')::date = d::date
         AND lower(status::text) NOT IN ('cancelled', 'rejected', 'rescheduled_by_customer')
     ) >= $3
     ORDER BY d`,
    [dateFrom, dateTo, capacity]
  );
  return result.rows.map(row => row.date);
};

exports.addUnavailableDate = async (date, reason, userId) => {
  const result = await pool.query(
    `INSERT INTO unavailable_dates (date, reason, created_by, is_open_override)
     VALUES ($1, $2, $3, FALSE)
     ON CONFLICT (date) DO UPDATE
       SET reason = $2, is_open_override = FALSE, updated_at = now()
     RETURNING
       id,
       date::text AS date,
       reason,
       is_recurring,
       is_open_override,
       created_by,
       created_at,
       updated_at`,
    [date, reason || null, userId || null]
  );
  return result.rows[0];
};

exports.addOpenOverride = async (date, userId) => {
  const result = await pool.query(
    `INSERT INTO unavailable_dates (date, reason, created_by, is_open_override)
     VALUES ($1, 'Holiday open override', $2, TRUE)
     ON CONFLICT (date) DO UPDATE
       SET is_open_override = TRUE, reason = 'Holiday open override', updated_at = now()
     RETURNING
       id,
       date::text AS date,
       reason,
       is_open_override,
       created_by,
       created_at,
       updated_at`,
    [date, userId || null]
  );
  return result.rows[0];
};

exports.removeOpenOverride = async (dateId) => {
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateId).trim());
  const query = isDate
    ? `DELETE FROM unavailable_dates
       WHERE date = $1 AND is_open_override = TRUE
       RETURNING id, date::text AS date`
    : `DELETE FROM unavailable_dates
       WHERE id = $1 AND is_open_override = TRUE
       RETURNING id, date::text AS date`;

  const result = await pool.query(query, [dateId]);
  return result.rows[0];
};

exports.removeUnavailableDate = async (dateId) => {
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateId).trim());
  const query = isDate
    ? `DELETE FROM unavailable_dates
       WHERE date = $1 AND is_open_override = FALSE
       RETURNING
         id,
         date::text AS date,
         reason,
         is_recurring,
         created_by,
         created_at,
         updated_at`
    : `DELETE FROM unavailable_dates
       WHERE id = $1
       RETURNING
         id,
         date::text AS date,
         reason,
         is_recurring,
         created_by,
         created_at,
         updated_at`;

  const result = await pool.query(query, [dateId]);
  return result.rows[0];
};

/**
 * Reads one schedule entry by date or by id.
 *
 * Used before a mutation so the audit row can record what the entry looked like
 * beforehand (an upsert of an already-closed date still produces a real
 * before -> after change instead of a bare "updated").
 */
exports.getScheduleEntry = async (dateOrId) => {
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateOrId).trim());
  const result = await pool.query(
    `SELECT
       id,
       date::text AS date,
       reason,
       is_recurring,
       is_open_override,
       created_by,
       created_at,
       updated_at
     FROM unavailable_dates
     WHERE ${isDate ? 'date = $1::timestamptz::date' : 'id = $1'}
     LIMIT 1`,
    [dateOrId]
  );
  return result.rows[0] || null;
};

exports.isDateUnavailable = async (date) => {
  const day = new Date(date);
  const dateKey = appointmentDateKey(day);
  const result = await pool.query(
    `SELECT id, is_open_override FROM unavailable_dates WHERE date = $1::date`,
    [dateKey]
  );
  if (result.rows.some(row => !row.is_open_override)) return true;
  const hasOpenOverride = result.rows.some(row => row.is_open_override);
  const isSunday = new Date(`${dateKey}T00:00:00Z`).getUTCDay() === 0;
  if (isSunday) return !hasOpenOverride;
  return isHoliday(day) && !hasOpenOverride;
};

// ─── PAYMENT STATUS ──────────────────────────────────────────────────────────

exports.updatePaymentStatus = async (appointmentId, paymentStatus, paymentMethod = null, paymentProofUrl = null, actorId = null) => {
  assertAppointmentId(appointmentId);
  const setClauses = ['payment_status = $2'];
  const params = [appointmentId, paymentStatus];
  let idx = 3;

  if (paymentMethod !== undefined && paymentMethod !== null) {
    setClauses.push(`payment_method = $${idx++}`);
    params.push(paymentMethod);
  }
  if (paymentProofUrl !== undefined && paymentProofUrl !== null) {
    setClauses.push(`payment_proof_url = $${idx++}`);
    params.push(paymentProofUrl);
  }

  setClauses.push('updated_at = now()');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const previousRes = await client.query(
      `SELECT a.payment_status, a.status, a.approved_payment_amount, a.reference_code, a.appointment_type, a.scheduled_at,
              a.user_id, u.email AS user_email,
              u.first_name || ' ' || u.last_name AS user_name
       FROM appointments a
       LEFT JOIN users u ON u.user_id = a.user_id
       WHERE a.appointment_id = $1 FOR UPDATE OF a`,
      [appointmentId]
    );

    const lockedAppointment = previousRes.rows[0];
    if (!lockedAppointment) throw new AppError('Appointment not found', 404);
    if (lockedAppointment.status === 'rescheduled_by_customer') throw new AppError('Historical appointment payments cannot be changed', 409);
    if (lockedAppointment.payment_status === 'refunded' || paymentStatus === 'refunded') throw new AppError('Refunded payments must be managed through Refund Management', 409);
    const refund = await client.query('SELECT 1 FROM appointment_refunds WHERE appointment_id = $1', [appointmentId]);
    if (refund.rows.length) throw new AppError('Payment is locked because a refund request exists', 409);

    if (paymentStatus === 'approved') {
      const amountResult = await client.query(`SELECT SUM(s.price) AS amount FROM appointments a JOIN services s ON s.service_id IN (SELECT el::int FROM jsonb_array_elements_text(a.services) el WHERE el ~ '^[0-9]+$') WHERE a.appointment_id = $1`, [appointmentId]);
      const approved = { total_amount: lockedAppointment.approved_payment_amount || amountResult.rows[0]?.amount };
      if (!Number(approved?.total_amount)) throw new AppError('Cannot approve a payment without a valid amount', 400);
      setClauses.push(`approved_payment_amount = $${idx++}`);
      params.push(approved.total_amount);
    }
    const updateRes = await client.query(
      `UPDATE appointments SET ${setClauses.join(', ')} WHERE appointment_id = $1 RETURNING *`,
      params
    );

    const previous = previousRes.rows[0];
    const updated = updateRes.rows[0];

    if (previous) {
      await require('./appointmentRefundService').notify(client, previous.user_id, 'Appointment payment reviewed', `Your appointment payment is ${paymentStatus}.`, appointmentId);
      await require('./auditService').logAppointmentEvent({
        userId: actorId,
        action: 'PAYMENT',
        entityId: appointmentId,
        entityType: 'appointment',
        status: paymentStatus,
        previousStatus: previous.payment_status,
        details: {
          from: previous.payment_status,
          to: paymentStatus,
          payment_method: paymentMethod,
          has_payment_proof: Boolean(paymentProofUrl),
        },
        context: {
          ...appointmentAuditContext(updated),
          previousStatus: previous.payment_status,
          paymentStatus,
          method: paymentMethod || updated.payment_method,
        },
        executor: client,
      });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return this.getAppointmentById(appointmentId);
};

// ─── AVAILABLE SLOTS ─────────────────────────────────────────────────────────

exports.getAvailableSlots = async (serviceId, date, slotDuration = 30) => {
  // Check if date is unavailable (Sundays stay closed unless opened via an override)
  const isUnavailable = await this.isDateUnavailable(date);
  if (isUnavailable) return [];

  const capacity = await getActiveStaffCount(pool);
  const activeAppointmentsForDay = await getActiveAppointmentCountForDate(pool, date);
  if (capacity === 0 || activeAppointmentsForDay >= capacity) return [];

  // Get existing appointments for the date
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const appointmentsResult = await pool.query(
    `SELECT scheduled_at, estimated_end_at FROM appointments 
     WHERE scheduled_at >= $1 AND scheduled_at <= $2 AND lower(status::text) NOT IN ('cancelled', 'rejected', 'rescheduled_by_customer')`,
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
      const overlappingBookings = bookedSlots.filter(booked =>
        (slotStart >= booked.start && slotStart < booked.end) ||
        (slotEnd > booked.start && slotEnd <= booked.end) ||
        (slotStart <= booked.start && slotEnd >= booked.end)
      ).length;

      if (overlappingBookings < capacity && slotStart > new Date()) {
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
  const dateStr = appointmentDateKey(date);
  const isUnavailable = await this.isDateUnavailable(dateStr);
  if (isUnavailable) return false;

  const capacity = await getActiveStaffCount(pool);
  const activeAppointmentsForDay = await getActiveAppointmentCountForDate(pool, scheduledAt);
  if (capacity === 0 || activeAppointmentsForDay >= capacity) return false;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const appointmentsResult = await pool.query(
    `SELECT scheduled_at, estimated_end_at FROM appointments 
     WHERE scheduled_at >= $1 AND scheduled_at <= $2 AND lower(status::text) NOT IN ('cancelled', 'rejected', 'rescheduled_by_customer')`,
    [startOfDay, endOfDay]
  );

  const slotStart = new Date(scheduledAt);
  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + (durationMinutes || 60));

  let overlappingBookings = 0;
  for (const apt of appointmentsResult.rows) {
    const bookedStart = new Date(apt.scheduled_at);
    const bookedEnd = new Date(
      apt.estimated_end_at || new Date(bookedStart.getTime() + (durationMinutes || 60) * 60 * 1000)
    );

    if ((slotStart >= bookedStart && slotStart < bookedEnd) ||
        (slotEnd > bookedStart && slotEnd <= bookedEnd) ||
        (slotStart <= bookedStart && slotEnd >= bookedEnd)) {
      overlappingBookings += 1;
    }
  }

  return overlappingBookings < capacity;
};

exports.getDailyAppointmentLoad = async (date, excludeAppointmentId = null) => {
  const day = new Date(date);
  const isUnavailable = await this.isDateUnavailable(day);
  const count = await getActiveAppointmentCountForDate(pool, day, excludeAppointmentId);
  const capacity = await getActiveStaffCount(pool);

  return {
    date: day.toISOString().slice(0, 10),
    active_appointments: count,
    active_staff_count: capacity,
    max_appointments: capacity,
    is_unavailable: Boolean(isUnavailable),
    is_fully_booked: capacity === 0 || count >= capacity,
  };
};

// ─── REFUND REQUESTS ──────────────────────────────────────────────────────────

const appointmentRefundService = require('./appointmentRefundService');
exports.createRefundRequest = appointmentRefundService.create;
exports.getRefundRequestsByAppointment = appointmentRefundService.forAppointment;
exports.getRefundRequestById = appointmentRefundService.get;
exports.getAllRefundRequests = appointmentRefundService.list;
