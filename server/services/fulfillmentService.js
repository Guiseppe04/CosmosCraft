const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('./notificationService');

const VALID_STATUS_TRANSITIONS = {
  pickup: {
    requested: ['processing'],
    processing: ['ready_for_pickup'],
    ready_for_pickup: ['completed'],
    completed: [],
    cancelled: [],
  },
  pickup_appointment: {
    requested: ['processing'],
    processing: ['ready_for_pickup'],
    ready_for_pickup: ['completed'],
    completed: [],
    cancelled: [],
  },
  delivery: {
    requested: ['processing'],
    processing: ['out_for_delivery'],
    out_for_delivery: ['completed'],
    completed: [],
    cancelled: [],
  },
  shop_delivery: {
    requested: ['processing'],
    processing: ['out_for_delivery'],
    out_for_delivery: ['completed'],
    completed: [],
    cancelled: [],
  },
};

const normalizeMethod = (method) => {
  const m = String(method || '').trim().toLowerCase();
  if (['pickup', 'pickup_appointment', 'pick_up'].includes(m)) return 'pickup';
  if (['delivery', 'shop_delivery', 'courier'].includes(m)) return 'delivery';
  return m;
};

const isLuzonLocation = (address) => {
  if (!address) return false;
  const province = String(address.province || '').toLowerCase();
  const city = String(address.city || '').toLowerCase();
  const region = String(address.region || '').toLowerCase();

  const luzonKeywords = [
    'metro manila', 'ncr', 'cavite', 'laguna', 'batangas', 'rizal', 'quezon',
    'bulacan', 'pampanga', 'bataan', 'zambales', 'tarlac', 'nueva ecija', 'aurora',
    'pangasinan', 'la union', 'ilocos', 'isabela', 'cagayan', 'benguet', 'baguio',
    'camarines', 'albay', 'sorsogon', 'catanduanes', 'masbate', 'marinduque',
    'oriental mindoro', 'occidental mindoro', 'palawan', 'romblon', 'luzon'
  ];

  return luzonKeywords.some((k) => province.includes(k) || city.includes(k) || region.includes(k));
};

/**
 * Submit or update a customer fulfillment request
 */
exports.submitFulfillmentRequest = async (projectId, userId, userRole, data = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch project with order and customer details with lock
    const projectRes = await client.query(
      `SELECT p.*,
              o.order_id, o.order_number, o.status AS order_status, o.order_type, o.customization_status,
              o.user_id AS customer_id, o.payment_status AS order_payment_status,
              o.total_amount, o.shipping_address_id AS order_shipping_address_id,
              u.first_name, u.last_name, u.email, u.phone
       FROM projects p
       JOIN orders o ON o.order_id = p.order_id
       JOIN users u ON u.user_id = o.user_id
       WHERE p.project_id = $1
         AND p.deleted_at IS NULL
       FOR UPDATE OF p`,
      [projectId]
    );

    if (projectRes.rows.length === 0) {
      throw new AppError('Project not found', 404);
    }

    const project = projectRes.rows[0];
    const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
    if (!isPrivileged && project.customer_id !== userId) {
      throw new AppError('You do not have access to this project', 403);
    }

    // 2. Authoritative build completion check
    const progress = Number(project.progress || 0);
    const isCompleted = project.status === 'completed' || progress >= 100 || project.customization_status === 'fulfillment_pending';

    if (!isCompleted) {
      throw new AppError('This custom build is not yet complete.', 400);
    }

    // 3. Validate method
    const rawMethod = String(data.method || data.fulfillment_method || '').trim();
    const method = normalizeMethod(rawMethod);
    if (!['pickup', 'delivery'].includes(method)) {
      throw new AppError('Fulfillment method must be Pickup at Shop or Shop Delivery.', 400);
    }

    // 4. Handle address if delivery
    let deliveryAddressId = data.delivery_address_id || data.address_id || project.fulfillment_address_id || null;
    let deliveryAddressSnapshot = null;

    if (method === 'delivery') {
      if (deliveryAddressId) {
        const addrRes = await client.query(
          `SELECT address_id, label, line1, line2, barangay, city, province, postal_code, country
           FROM addresses 
           WHERE address_id = $1 AND (user_id = $2 OR $3 = true)`,
          [deliveryAddressId, project.customer_id, isPrivileged]
        );
        if (addrRes.rows.length > 0) {
          deliveryAddressSnapshot = addrRes.rows[0];
        }
      }

      if (!deliveryAddressSnapshot && project.order_shipping_address_id) {
        const addrRes = await client.query(
          `SELECT address_id, label, line1, line2, barangay, city, province, postal_code, country
           FROM addresses 
           WHERE address_id = $1`,
          [project.order_shipping_address_id]
        );
        if (addrRes.rows.length > 0) {
          deliveryAddressId = addrRes.rows[0].address_id;
          deliveryAddressSnapshot = addrRes.rows[0];
        }
      }

      if (!deliveryAddressSnapshot && project.fulfillment_address_snapshot) {
        deliveryAddressSnapshot = typeof project.fulfillment_address_snapshot === 'string'
          ? JSON.parse(project.fulfillment_address_snapshot)
          : project.fulfillment_address_snapshot;
      }

      if (!deliveryAddressSnapshot || !deliveryAddressSnapshot.line1 || !deliveryAddressSnapshot.city) {
        throw new AppError('Please add or select a delivery address before requesting Shop Delivery.', 400);
      }

      if (!isLuzonLocation(deliveryAddressSnapshot)) {
        throw new AppError('Shop delivery is currently only available for Luzon addresses. Please choose Pickup at Shop or provide a Luzon address.', 400);
      }
    }

    // 5. Handle appointment if pickup
    let pickupAppointmentId = project.pickup_appointment_id || null;
    let pickupScheduledAt = data.scheduled_at || data.pickup_scheduled_at || null;

    if (method === 'pickup' && pickupScheduledAt) {
      const scheduledDate = new Date(pickupScheduledAt);
      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        throw new AppError('Pickup appointment must be scheduled for a valid future date and time.', 400);
      }
    }

    const notes = data.notes?.trim() || null;

    // 6. Check existing fulfillment request for this order (atomic check)
    const existingReqRes = await client.query(
      `SELECT * FROM fulfillment_requests 
       WHERE order_id = $1 AND status NOT IN ('cancelled')
       FOR UPDATE`,
      [project.order_id]
    );

    let savedRequest;

    if (existingReqRes.rows.length > 0) {
      const existingReq = existingReqRes.rows[0];

      // If active fulfillment has already started, locked!
      if (['processing', 'ready_for_pickup', 'out_for_delivery', 'completed'].includes(existingReq.status)) {
        throw new AppError('Fulfillment has started. Your delivery method can no longer be changed.', 400);
      }

      // Update the existing request in place (Requested state allows preference update)
      const updateRes = await client.query(
        `UPDATE fulfillment_requests
         SET fulfillment_method = $1,
             delivery_address_id = $2,
             delivery_address_snapshot = $3,
             pickup_appointment_id = $4,
             pickup_scheduled_at = $5,
             notes = COALESCE($6, notes),
             updated_at = now()
         WHERE id = $7
         RETURNING *`,
        [
          method,
          method === 'delivery' ? deliveryAddressId : null,
          method === 'delivery' ? JSON.stringify(deliveryAddressSnapshot) : null,
          method === 'pickup' ? pickupAppointmentId : null,
          method === 'pickup' ? pickupScheduledAt : null,
          notes,
          existingReq.id
        ]
      );
      savedRequest = updateRes.rows[0];
    } else {
      // Create fresh fulfillment request
      const insertRes = await client.query(
        `INSERT INTO fulfillment_requests (
           order_id, project_id, user_id, fulfillment_method, status,
           delivery_address_id, delivery_address_snapshot,
           pickup_appointment_id, pickup_scheduled_at, notes, requested_at, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, 'requested', $5, $6, $7, $8, $9, now(), now(), now())
         RETURNING *`,
        [
          project.order_id,
          projectId,
          project.customer_id,
          method,
          method === 'delivery' ? deliveryAddressId : null,
          method === 'delivery' ? JSON.stringify(deliveryAddressSnapshot) : null,
          method === 'pickup' ? pickupAppointmentId : null,
          method === 'pickup' ? pickupScheduledAt : null,
          notes
        ]
      );
      savedRequest = insertRes.rows[0];
    }

    // 7. Synchronize projects and orders
    await client.query(
      `UPDATE projects
       SET fulfillment_method = $1,
           fulfillment_status = 'requested',
           fulfillment_notes = $2,
           fulfillment_selected_at = COALESCE(fulfillment_selected_at, now()),
           fulfillment_address_id = $3,
           fulfillment_address_snapshot = $4,
           pickup_appointment_id = $5,
           updated_at = now()
       WHERE project_id = $6`,
      [
        method,
        notes,
        method === 'delivery' ? deliveryAddressId : null,
        method === 'delivery' ? JSON.stringify(deliveryAddressSnapshot) : null,
        method === 'pickup' ? pickupAppointmentId : null,
        projectId
      ]
    );

    await client.query(
      `UPDATE orders
       SET customization_status = 'fulfillment_in_progress',
           updated_at = now()
       WHERE order_id = $1
         AND customization_status IN ('fulfillment_pending', 'active')`,
      [project.order_id]
    );

    await client.query('COMMIT');

    // 8. Send Notification to customer
    try {
      const methodLabel = method === 'pickup' ? 'Pickup at Shop' : 'Shop Delivery';
      await notificationService.createNotification({
        user_id: project.customer_id,
        title: 'Fulfillment request submitted.',
        message: `Your ${methodLabel} request has been sent to the shop.`,
        type: 'order_update',
        related_entity_id: project.order_id,
        related_entity_type: 'order',
      });
    } catch (notifErr) {
      console.warn('submitFulfillmentRequest: notification error:', notifErr.message);
    }

    return {
      ...savedRequest,
      delivery_address_snapshot: deliveryAddressSnapshot,
      project_title: project.title,
      order_number: project.order_number,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get fulfillment request for a project or order (Customer or Admin)
 */
exports.getFulfillmentRequestByProjectId = async (projectId, userId, userRole) => {
  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);

  const query = `
    SELECT fr.*,
           p.title AS project_title, p.status AS project_status, p.progress AS project_progress,
            COALESCE((
              SELECT MAX(c.guitar_type)
              FROM order_items oi
              JOIN customizations c ON c.customization_id = oi.customization_id
              WHERE oi.order_id = o.order_id
            ), 'acoustic') AS guitar_type, p.notes AS project_notes,
           o.order_number, o.status AS order_status, o.payment_status AS order_payment_status,
           o.total_amount, o.created_at AS order_created_at,
           u.first_name, u.last_name, u.email, u.phone
    FROM fulfillment_requests fr
    JOIN projects p ON p.project_id = fr.project_id
    JOIN orders o ON o.order_id = fr.order_id
    JOIN users u ON u.user_id = fr.user_id
    WHERE fr.project_id = $1
      AND fr.status NOT IN ('cancelled')
      ${isPrivileged ? '' : 'AND fr.user_id = $2'}
    ORDER BY fr.created_at DESC
    LIMIT 1
  `;

  const params = isPrivileged ? [projectId] : [projectId, userId];
  const res = await pool.query(query, params);

  if (res.rows.length === 0) {
    // If no explicit fulfillment_request row yet, check if project is completed
    const projRes = await pool.query(
      `SELECT p.*, o.order_number, o.status AS order_status, o.payment_status AS order_payment_status,
              o.total_amount, o.customization_status, o.user_id AS customer_id,
              u.first_name, u.last_name, u.email, u.phone,
              COALESCE((
                SELECT MAX(c.guitar_type)
                FROM order_items oi
                JOIN customizations c ON c.customization_id = oi.customization_id
                WHERE oi.order_id = o.order_id
              ), 'acoustic') AS guitar_type
       FROM projects p
       JOIN orders o ON o.order_id = p.order_id
       JOIN users u ON u.user_id = o.user_id
       WHERE p.project_id = $1
         ${isPrivileged ? '' : 'AND o.user_id = $2'}`,
      isPrivileged ? [projectId] : [projectId, userId]
    );

    if (projRes.rows.length === 0) return null;
    const p = projRes.rows[0];

    return {
      id: null,
      order_id: p.order_id,
      project_id: p.project_id,
      user_id: p.customer_id,
      fulfillment_method: p.fulfillment_method ? normalizeMethod(p.fulfillment_method) : null,
      status: p.fulfillment_status || 'not_requested',
      delivery_address_id: p.fulfillment_address_id,
      delivery_address_snapshot: p.fulfillment_address_snapshot,
      pickup_appointment_id: p.pickup_appointment_id,
      notes: p.fulfillment_notes,
      requested_at: p.fulfillment_selected_at,
      project_title: p.title,
      project_status: p.status,
      project_progress: p.progress,
      guitar_type: p.guitar_type || 'acoustic',
      order_number: p.order_number,
      order_status: p.order_status,
      order_payment_status: p.order_payment_status,
      total_amount: p.total_amount,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
    };
  }

  const row = res.rows[0];
  return {
    ...row,
    delivery_address_snapshot: typeof row.delivery_address_snapshot === 'string'
      ? JSON.parse(row.delivery_address_snapshot)
      : row.delivery_address_snapshot,
  };
};

/**
 * List all fulfillment requests for Admin / Staff
 */
exports.listFulfillmentRequests = async (filters = {}) => {
  const page = Math.max(1, parseInt(filters.page || 1, 10));
  const limit = Math.max(1, Math.min(100, parseInt(filters.limit || filters.pageSize || 15, 10)));
  const offset = (page - 1) * limit;

  const conditions = ["fr.status NOT IN ('cancelled')"];
  const params = [];

  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`fr.status = $${params.length}`);
  }

  if (filters.method && filters.method !== 'all') {
    params.push(normalizeMethod(filters.method));
    conditions.push(`fr.fulfillment_method = $${params.length}`);
  }

  if (filters.search && filters.search.trim()) {
    params.push(`%${filters.search.trim()}%`);
    conditions.push(`(
      o.order_number ILIKE $${params.length} OR
      p.title ILIKE $${params.length} OR
      u.first_name ILIKE $${params.length} OR
      u.last_name ILIKE $${params.length} OR
      u.email ILIKE $${params.length} OR
      CONCAT(u.first_name, ' ', u.last_name) ILIKE $${params.length}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM fulfillment_requests fr
    JOIN orders o ON o.order_id = fr.order_id
    JOIN projects p ON p.project_id = fr.project_id
    JOIN users u ON u.user_id = fr.user_id
    ${whereClause}
  `;

  const totalRes = await pool.query(countQuery, params);
  const total = parseInt(totalRes.rows[0].total, 10);

  const dataQuery = `
    SELECT fr.*,
           p.title AS project_title, p.status AS project_status, p.progress AS project_progress,
            COALESCE((
              SELECT MAX(c.guitar_type)
              FROM order_items oi
              JOIN customizations c ON c.customization_id = oi.customization_id
              WHERE oi.order_id = o.order_id
            ), 'acoustic') AS guitar_type, p.estimated_completion_date,
           o.order_number, o.status AS order_status, o.payment_status AS order_payment_status,
           o.total_amount, o.created_at AS order_created_at,
           u.first_name, u.last_name, u.email, u.phone
    FROM fulfillment_requests fr
    JOIN orders o ON o.order_id = fr.order_id
    JOIN projects p ON p.project_id = fr.project_id
    JOIN users u ON u.user_id = fr.user_id
    ${whereClause}
    ORDER BY 
      CASE fr.status
        WHEN 'requested' THEN 1
        WHEN 'processing' THEN 2
        WHEN 'ready_for_pickup' THEN 3
        WHEN 'out_for_delivery' THEN 4
        WHEN 'completed' THEN 5
        ELSE 6
      END,
      fr.requested_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const dataRes = await pool.query(dataQuery, [...params, limit, offset]);

  return {
    requests: dataRes.rows.map(r => ({
      ...r,
      delivery_address_snapshot: typeof r.delivery_address_snapshot === 'string'
        ? JSON.parse(r.delivery_address_snapshot)
        : r.delivery_address_snapshot,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

/**
 * Get detailed fulfillment request by ID
 */
exports.getFulfillmentRequestById = async (requestId, userId, userRole) => {
  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);

  const query = `
    SELECT fr.*,
           p.title AS project_title, p.status AS project_status, p.progress AS project_progress,
            COALESCE((
              SELECT MAX(c.guitar_type)
              FROM order_items oi
              JOIN customizations c ON c.customization_id = oi.customization_id
              WHERE oi.order_id = o.order_id
            ), 'acoustic') AS guitar_type, p.notes AS project_notes, p.custom_build_id,
           o.order_number, o.status AS order_status, o.payment_status AS order_payment_status,
           o.payment_reference_number, o.total_amount, o.created_at AS order_created_at,
           u.first_name, u.last_name, u.email, u.phone
    FROM fulfillment_requests fr
    JOIN orders o ON o.order_id = fr.order_id
    JOIN projects p ON p.project_id = fr.project_id
    JOIN users u ON u.user_id = fr.user_id
    WHERE fr.id = $1
      ${isPrivileged ? '' : 'AND fr.user_id = $2'}
  `;

  const params = isPrivileged ? [requestId] : [requestId, userId];
  const res = await pool.query(query, params);

  if (res.rows.length === 0) {
    throw new AppError('Fulfillment request not found', 404);
  }

  const row = res.rows[0];
  return {
    ...row,
    delivery_address_snapshot: typeof row.delivery_address_snapshot === 'string'
      ? JSON.parse(row.delivery_address_snapshot)
      : row.delivery_address_snapshot,
  };
};

/**
 * Admin action: Transition fulfillment status
 */
exports.updateFulfillmentStatus = async (requestId, newStatus, adminNotes, actorId, actorRole) => {
  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(actorRole);
  if (!isPrivileged) {
    throw new AppError('You are not authorized to perform this action.', 403);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT fr.*, o.order_number, o.user_id AS customer_id, p.project_id, p.title AS project_title
       FROM fulfillment_requests fr
       JOIN orders o ON o.order_id = fr.order_id
       JOIN projects p ON p.project_id = fr.project_id
       WHERE fr.id = $1
       FOR UPDATE`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      throw new AppError('Fulfillment request not found', 404);
    }

    const currentReq = reqRes.rows[0];
    const method = normalizeMethod(currentReq.fulfillment_method);
    const currentStatus = currentReq.status;

    // Validate transition
    const allowedNext = VALID_STATUS_TRANSITIONS[method]?.[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      throw new AppError(`This fulfillment status transition is not allowed. (${currentStatus} → ${newStatus})`, 400);
    }

    // Set timestamps based on newStatus
    const startedAt = newStatus === 'processing' ? new Date() : currentReq.started_at;
    const readyForPickupAt = newStatus === 'ready_for_pickup' ? new Date() : currentReq.ready_for_pickup_at;
    const outForDeliveryAt = newStatus === 'out_for_delivery' ? new Date() : currentReq.out_for_delivery_at;
    const completedAt = newStatus === 'completed' ? new Date() : currentReq.completed_at;

    const updateRes = await client.query(
      `UPDATE fulfillment_requests
       SET status = $1,
           admin_notes = COALESCE($2, admin_notes),
           started_at = COALESCE($3, started_at),
           ready_for_pickup_at = COALESCE($4, ready_for_pickup_at),
           out_for_delivery_at = COALESCE($5, out_for_delivery_at),
           completed_at = COALESCE($6, completed_at),
           updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [
        newStatus,
        adminNotes || null,
        startedAt,
        readyForPickupAt,
        outForDeliveryAt,
        completedAt,
        requestId
      ]
    );

    // Synchronize projects table
    await client.query(
      `UPDATE projects
       SET fulfillment_status = $1::varchar,
           ready_for_pickup_at = COALESCE($2, ready_for_pickup_at),
           shipped_at = COALESCE($3, shipped_at),
           picked_up_at = CASE WHEN $1::varchar = 'completed' AND $4::varchar = 'pickup' THEN now() ELSE picked_up_at END,
           updated_at = now()
       WHERE project_id = $5`,
      [
        newStatus,
        readyForPickupAt,
        outForDeliveryAt,
        method,
        currentReq.project_id
      ]
    );

    // Synchronize orders table on completion
    if (newStatus === 'completed') {
      await client.query(
        `UPDATE orders
         SET customization_status = 'fulfilled',
             status = CASE 
               WHEN order_type = 'customization' AND status NOT IN ('delivered', 'received', 'cancelled') THEN 'delivered' 
               ELSE status 
             END,
             delivered_at = COALESCE(delivered_at, now()),
             updated_at = now()
         WHERE order_id = $1`,
        [currentReq.order_id]
      );
    }

    await client.query('COMMIT');

    // Customer Notification
    try {
      let notifTitle = 'Fulfillment Update';
      let notifMessage = `Your custom build fulfillment status is now ${newStatus.replace(/_/g, ' ')}.`;

      if (newStatus === 'processing') {
        notifTitle = 'Fulfillment In Progress';
        notifMessage = 'Your custom build is being prepared for fulfillment.';
      } else if (newStatus === 'ready_for_pickup') {
        notifTitle = 'Ready for Pickup';
        notifMessage = 'Your custom guitar is ready for pickup.';
      } else if (newStatus === 'out_for_delivery') {
        notifTitle = 'Out for Delivery';
        notifMessage = 'Your custom guitar is out for delivery.';
      } else if (newStatus === 'completed') {
        notifTitle = 'Fulfillment Completed';
        notifMessage = 'Your custom build has been successfully fulfilled.';
      }

      await notificationService.createNotification({
        user_id: currentReq.customer_id,
        title: notifTitle,
        message: notifMessage,
        type: 'order_update',
        related_entity_id: currentReq.order_id,
        related_entity_type: 'order',
      });
    } catch (notifErr) {
      console.warn('updateFulfillmentStatus: notification error:', notifErr.message);
    }

    return updateRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
