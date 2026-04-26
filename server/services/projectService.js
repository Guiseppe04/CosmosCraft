const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
let projectArchiveColumnsReadyPromise = null;

const ensureProjectArchiveColumns = async () => {
  if (projectArchiveColumnsReadyPromise) return projectArchiveColumnsReadyPromise;

  projectArchiveColumnsReadyPromise = (async () => {
    const checkRes = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'projects'
         AND table_schema = current_schema()
         AND column_name IN ('is_deleted', 'deleted_at', 'deleted_by')`
    );

    const existing = new Set(checkRes.rows.map((row) => row.column_name));

    if (!existing.has('is_deleted')) {
      await pool.query(`ALTER TABLE projects ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false`);
    }
    if (!existing.has('deleted_at')) {
      await pool.query(`ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMPTZ`);
    }
    if (!existing.has('deleted_by')) {
      await pool.query(`ALTER TABLE projects ADD COLUMN deleted_by UUID REFERENCES users(user_id) ON DELETE SET NULL`);
    }
  })()
    .catch((error) => {
      projectArchiveColumnsReadyPromise = null;
      throw error;
    });

  return projectArchiveColumnsReadyPromise;
};

const normalizeProjectStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '_')

  if (normalized === 'cancelled') return 'cancelled'
  if (normalized === 'completed') return 'completed'
  if (normalized === 'in_progress') return 'in_progress'
  if (normalized === 'not_started' || normalized === 'pending') return 'not_started'

  return null
}

const PROJECT_BASE_SELECT = `
  SELECT
    p.*,
    p.title AS name,
    p.notes AS description,
    o.user_id AS customer_id,
    o.order_number,
    a.line1 AS shipping_line1,
    a.line2 AS shipping_line2,
    a.city AS shipping_city,
    a.province AS shipping_province,
    a.postal_code AS shipping_postal_code,
    a.country AS shipping_country,
    CONCAT(
      COALESCE(u.first_name, ''),
      CASE
        WHEN COALESCE(u.first_name, '') <> '' AND COALESCE(u.last_name, '') <> '' THEN ' '
        ELSE ''
      END,
      COALESCE(u.last_name, '')
    ) AS customer_name
  FROM projects p
  JOIN orders o ON o.order_id = p.order_id
  LEFT JOIN addresses a ON a.address_id = o.shipping_address_id
  LEFT JOIN users u ON u.user_id = o.user_id
`

const LUZON_LOCATION_KEYWORDS = [
  'abra', 'apayao', 'bataan', 'batanes', 'batangas', 'benguet', 'bulacan', 'cagayan',
  'camarines norte', 'camarines sur', 'catanduanes', 'cavite', 'ifugao', 'ilocos norte',
  'ilocos sur', 'isabela', 'kalinga', 'la union', 'laguna', 'marinduque', 'masbate',
  'metro manila', 'metropolitan manila', 'mountain province', 'ncr', 'nueva ecija',
  'nueva vizcaya', 'occidental mindoro', 'oriental mindoro', 'palawan', 'pampanga',
  'pangasinan', 'quezon', 'quirino', 'rizal', 'romblon', 'sorsogon', 'tarlac', 'zambales',
  'albay', 'aurora', 'laguna', 'camarines', 'manila', 'quezon city', 'caloocan', 'las pinas',
  'makati', 'malabon', 'mandaluyong', 'marikina', 'muntinlupa', 'navotas', 'paranaque',
  'pasay', 'pasig', 'pateros', 'san juan', 'taguig', 'valenzuela'
];

const normalizeLocation = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const isLuzonLocation = (project) => {
  const country = String(project.shipping_country || '').trim().toUpperCase();
  if (country && country !== 'PH' && country !== 'PHILIPPINES') {
    return false;
  }

  const haystack = [
    project.shipping_province,
    project.shipping_city,
  ]
    .map(normalizeLocation)
    .filter(Boolean)
    .join(' ');

  if (!haystack) return false;
  return LUZON_LOCATION_KEYWORDS.some((keyword) => haystack.includes(keyword));
};

const buildShippingAddress = (project) => ({
  line1: project.shipping_line1 || null,
  line2: project.shipping_line2 || null,
  city: project.shipping_city || null,
  province: project.shipping_province || null,
  postal_code: project.shipping_postal_code || null,
  country: project.shipping_country || null,
});

const attachFulfillmentDetails = (project, pickupAppointment = null) => {
  const shipping_address = buildShippingAddress(project);
  const shop_delivery_eligible = isLuzonLocation(project);

  return {
    ...project,
    shipping_address,
    fulfillment_method: project.fulfillment_method || null,
    fulfillment_status: project.fulfillment_status || null,
    fulfillment_notes: project.fulfillment_notes || null,
    fulfillment_selected_at: project.fulfillment_selected_at || null,
    pickup_appointment_id: project.pickup_appointment_id || null,
    pickup_appointment: pickupAppointment,
    shop_delivery_eligible,
  };
};

const buildFulfillmentAppointmentNotes = (project, method, notes) => {
  const lines = [
    `Project release for ${project.name || project.title}`,
    `Order ${project.order_number}`,
    `Method: ${method}`,
  ];

  if (notes) lines.push(`Customer notes: ${notes}`);
  return lines.join(' | ');
};

const getProjectTaskStats = async (db, projectId) => {
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(CASE WHEN ps.status = 'completed' THEN 1 END)::int AS completed
     FROM project_subtasks ps
     JOIN project_milestones pm ON ps.milestone_id = pm.milestone_id
     WHERE pm.project_id = $1`,
    [projectId]
  );

  return {
    total: result.rows[0]?.total || 0,
    completed: result.rows[0]?.completed || 0,
  };
};

const buildProjectTaskTracking = ({ total, completed }, currentStatus) => {
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const normalizedCurrentStatus = normalizeProjectStatus(currentStatus);

  if (normalizedCurrentStatus === 'cancelled') {
    return {
      progress,
      status: 'cancelled',
      task_summary: {
        total,
        completed,
        pending: Math.max(total - completed, 0),
      },
    };
  }

  let status = normalizedCurrentStatus || 'not_started';
  if (total > 0) {
    if (completed === total) status = 'completed';
    else if (completed > 0) status = 'in_progress';
    else status = 'not_started';
  }

  return {
    progress,
    status,
    task_summary: {
      total,
      completed,
      pending: Math.max(total - completed, 0),
    },
  };
};

const applyProjectTaskTracking = async (db, project, { stats = null, persist = false } = {}) => {
  const resolvedStats = stats || await getProjectTaskStats(db, project.project_id);
  const tracking = buildProjectTaskTracking(resolvedStats, project.status);

  if (persist) {
    const currentProgress = Number.isFinite(Number(project.progress)) ? Number(project.progress) : 0;
    if (currentProgress !== tracking.progress || project.status !== tracking.status) {
      await db.query(
        `UPDATE projects
         SET progress = $1,
             status = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $3`,
        [tracking.progress, tracking.status, project.project_id]
      );
    }
  }

  return {
    ...project,
    ...tracking,
  };
};

exports.getProjects = async () => {
  await ensureProjectArchiveColumns();
  const result = await pool.query(
    `${PROJECT_BASE_SELECT}
     WHERE COALESCE(p.is_deleted, false) = false
     ORDER BY p.created_at DESC`
  );

  return Promise.all(
    result.rows.map(async (project) => {
      const trackedProject = await applyProjectTaskTracking(pool, project, { persist: true });
      return attachFulfillmentDetails(trackedProject);
    })
  );
};

exports.getProjectById = async (projectId) => {
  await ensureProjectArchiveColumns();
  const result = await pool.query(
    `${PROJECT_BASE_SELECT}
     WHERE p.project_id = $1
       AND COALESCE(p.is_deleted, false) = false`,
    [projectId]
  );
  if (result.rows.length === 0) return null;
  const trackedProject = await applyProjectTaskTracking(pool, result.rows[0], { persist: true });
  return attachFulfillmentDetails(trackedProject);
};

exports.getMyProjects = async (userId) => {
  await ensureProjectArchiveColumns();
  const result = await pool.query(
    `${PROJECT_BASE_SELECT}
     WHERE o.user_id = $1
       AND COALESCE(p.is_deleted, false) = false
     ORDER BY p.created_at DESC`,
    [userId]
  );
  for (let p of result.rows) {
    const stats = await getProjectTaskStats(pool, p.project_id);
    const customizationsRes = await pool.query(
      `SELECT DISTINCT customization_id
       FROM order_items
      WHERE order_id = $1
         AND customization_id IS NOT NULL`,
      [p.order_id]
    );
    const tracking = await applyProjectTaskTracking(pool, p, { stats, persist: true });
    p.customization_ids = customizationsRes.rows.map(row => row.customization_id);
    p.primary_customization_id = p.customization_ids[0] || null;
    p.progress = tracking.progress;
    p.status = tracking.status;
    p.task_summary = tracking.task_summary;
    Object.assign(p, attachFulfillmentDetails(p));
  }
  return result.rows;
};

exports.createProject = async (projectData) => {
  await ensureProjectArchiveColumns();
  const { order_id, orderId, title, name, status, description, notes, estimated_completion_date } = projectData;
  const projectOrderId = order_id || orderId
  const projectTitle = title || name
  const normalizedStatus = normalizeProjectStatus(status) || 'not_started'

  const result = await pool.query(
    `INSERT INTO projects (order_id, title, status, notes, estimated_completion_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [projectOrderId, projectTitle, normalizedStatus, notes ?? description ?? null, estimated_completion_date || null]
  );
  return { ...result.rows[0], name: result.rows[0].title, description: result.rows[0].notes };
};

exports.updateProject = async (projectId, projectData) => {
  await ensureProjectArchiveColumns();
  const { title, name, status, description, notes, estimated_completion_date } = projectData;
  const normalizedStatus = normalizeProjectStatus(status)

  const result = await pool.query(
    `UPDATE projects 
     SET title = COALESCE($1, title),
         status = COALESCE($2, status),
         notes = COALESCE($3, notes),
         estimated_completion_date = COALESCE($4, estimated_completion_date),
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $5
       AND COALESCE(is_deleted, false) = false
     RETURNING *`,
    [title || name, normalizedStatus, notes ?? description, estimated_completion_date || null, projectId]
  );
  if (result.rows.length === 0) return null;
  return { ...result.rows[0], name: result.rows[0].title, description: result.rows[0].notes };
};

exports.cancelProject = async (projectId, userId, userRole) => {
  await ensureProjectArchiveColumns();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const projectResult = await client.query(
      `${PROJECT_BASE_SELECT}
       WHERE p.project_id = $1
         AND COALESCE(p.is_deleted, false) = false`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const project = projectResult.rows[0];
    const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);

    if (!isPrivileged && project.customer_id !== userId) {
      throw new AppError('You do not have access to this project', 403);
    }

    const stats = await getProjectTaskStats(client, projectId);
    const tracking = buildProjectTaskTracking(stats, project.status);

    if (tracking.status === 'cancelled') {
      throw new AppError('Project is already cancelled', 400);
    }

    if (tracking.status === 'completed' || tracking.progress >= 80) {
      throw new AppError('Only projects below 80% progress can be cancelled', 400);
    }

    await client.query(
      `UPDATE projects
       SET status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $1`,
      [projectId]
    );

    await client.query(
      `UPDATE orders
       SET status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1
         AND status <> 'cancelled'`,
      [project.order_id]
    );

    await logActivity(client, projectId, userId, 'project_cancelled', {
      previous_status: tracking.status,
      previous_progress: tracking.progress,
      order_id: project.order_id,
    });

    await client.query('COMMIT');

    return attachFulfillmentDetails({
      ...project,
      progress: tracking.progress,
      status: 'cancelled',
      task_summary: tracking.task_summary,
      updated_at: new Date(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.deleteProject = async (projectId, deletedBy = null) => {
  await ensureProjectArchiveColumns();
  const result = await pool.query(
    `UPDATE projects
     SET is_deleted = true,
         deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $1
       AND COALESCE(is_deleted, false) = false
     RETURNING *`,
    [projectId, deletedBy]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
};

exports.restoreProject = async (projectId) => {
  await ensureProjectArchiveColumns();
  const result = await pool.query(
    `UPDATE projects
     SET is_deleted = false,
         deleted_at = NULL,
         deleted_by = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $1
       AND COALESCE(is_deleted, false) = true
     RETURNING *`,
    [projectId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
};

exports.assignTeam = async (projectId, userIds) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM project_team_members WHERE project_id = $1', [projectId]);
    
    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        await client.query(
          'INSERT INTO project_team_members (project_id, user_id) VALUES ($1, $2)',
          [projectId, userId]
        );
      }
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ─── PROJECT TRACKING & TASKS ───────────────────────────────────────────────

const logActivity = async (client, projectId, userId, actionType, details) => {
  await client.query(
    'INSERT INTO project_activity_logs (project_id, user_id, action_type, details) VALUES ($1, $2, $3, $4)',
    [projectId, userId, actionType, JSON.stringify(details)]
  );
};

exports.getProjectHierarchy = async (projectId) => {
  await ensureProjectArchiveColumns();
  const client = await pool.connect();
  try {
    const pResult = await client.query(
      `${PROJECT_BASE_SELECT}
       WHERE p.project_id = $1
         AND COALESCE(p.is_deleted, false) = false`,
      [projectId]
    );
    if (pResult.rows.length === 0) return null;
    const project = pResult.rows[0];

    // Fetch team members
    const teamResult = await client.query(`
      SELECT ptm.user_id, u.first_name, u.last_name, u.email, u.role
      FROM project_team_members ptm
      JOIN users u ON ptm.user_id = u.user_id
      WHERE ptm.project_id = $1
    `, [projectId]);
    project.team = teamResult.rows;

    const customizationResult = await client.query(
      `SELECT DISTINCT
         c.customization_id,
         c.created_at,
         c.name,
         c.guitar_type,
         c.body_wood,
         c.neck_wood,
         c.fingerboard_wood,
         c.bridge_type,
         c.pickups,
         c.color,
         c.finish_type
       FROM order_items oi
       JOIN customizations c ON c.customization_id = oi.customization_id
       WHERE oi.order_id = $1
      ORDER BY c.created_at ASC`,
      [project.order_id]
    );

    const customizationIds = customizationResult.rows.map((row) => row.customization_id);
    let linkedParts = [];

    if (customizationIds.length > 0) {
      const linkedPartsResult = await client.query(
        `SELECT
           cp.part_id::text AS part_id,
           cp.customization_id,
           cp.part_name AS name,
           cp.quantity,
           cp.price,
           c.guitar_type,
           pi.image_url,
           'additional_parts' AS part_category,
           p.is_active,
           i.stock
         FROM customization_parts cp
         JOIN customizations c ON c.customization_id = cp.customization_id
         LEFT JOIN products p ON p.product_id = cp.product_id
         LEFT JOIN inventory i ON i.product_id = cp.product_id
         LEFT JOIN product_images pi
           ON pi.product_id = cp.product_id
          AND pi.is_primary = true
         WHERE cp.customization_id = ANY($1::uuid[])
         ORDER BY cp.created_at ASC`,
        [customizationIds]
      );

      linkedParts = linkedPartsResult.rows;
    }

    const specFields = [
      ['name', 'model'],
      ['body_wood', 'body'],
      ['neck_wood', 'neck'],
      ['fingerboard_wood', 'fretboard'],
      ['bridge_type', 'bridge'],
      ['pickups', 'pickups'],
      ['color', 'finish'],
      ['finish_type', 'finish'],
    ];

    const configuredParts = customizationResult.rows.flatMap((customization) =>
      specFields.flatMap(([field, category]) => {
        const value = customization[field];
        if (!value) return [];

        return [{
          part_id: `${customization.customization_id}:${field}`,
          customization_id: customization.customization_id,
          name: value,
          guitar_type: customization.guitar_type,
          part_category: category,
          stock: null,
          is_active: true,
          source: 'configuration',
        }];
      })
    );

    project.customization_ids = customizationIds;
    project.parts = [...configuredParts, ...linkedParts];

    // Fetch milestones
    const mResult = await client.query('SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY order_index ASC, created_at ASC', [projectId]);
    const milestones = mResult.rows;

    // Fetch subtasks
    const sResult = await client.query(`
      SELECT s.*, u.first_name as assignee_first, u.last_name as assignee_last
      FROM project_subtasks s
      LEFT JOIN users u ON s.assigned_user_id = u.user_id
      JOIN project_milestones m ON s.milestone_id = m.milestone_id
      WHERE m.project_id = $1
      ORDER BY s.created_at ASC
    `, [projectId]);
    
    let totalSubtasks = 0;
    let completedSubtasks = 0;

    // Group subtasks into milestones
    const milestoneMap = milestones.reduce((acc, m) => {
      m.subtasks = [];
      acc[m.milestone_id] = m;
      return acc;
    }, {});

    sResult.rows.forEach(s => {
      if (milestoneMap[s.milestone_id]) {
        milestoneMap[s.milestone_id].subtasks.push(s);
        totalSubtasks++;
        if (s.status === 'completed') completedSubtasks++;
      }
    });

    project.milestones = Object.values(milestoneMap);

    let pickupAppointment = null;
    if (project.pickup_appointment_id) {
      const pickupResult = await client.query(
        `SELECT appointment_id, appointment_type, order_id, location_id, scheduled_at, status, notes, confirmation_notes
         FROM appointments
         WHERE appointment_id = $1`,
        [project.pickup_appointment_id]
      );
      pickupAppointment = pickupResult.rows[0] || null;
    }

    const trackedProject = await applyProjectTaskTracking(
      client,
      project,
      {
        stats: { total: totalSubtasks, completed: completedSubtasks },
        persist: true,
      }
    );
    return attachFulfillmentDetails(trackedProject, pickupAppointment);
  } finally {
    client.release();
  }
};

exports.submitFulfillmentChoice = async (projectId, userId, userRole, data = {}) => {
  await ensureProjectArchiveColumns();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const projectResult = await client.query(
      `${PROJECT_BASE_SELECT}
       WHERE p.project_id = $1
         AND COALESCE(p.is_deleted, false) = false`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      throw new AppError('Project not found', 404);
    }

    const project = projectResult.rows[0];
    const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
    if (!isPrivileged && project.customer_id !== userId) {
      throw new AppError('You do not have access to this project', 403);
    }

    if (Number(project.progress || 0) < 100) {
      throw new AppError('Fulfillment options unlock once the project is completed', 400);
    }

    const method = String(data.method || '').trim();
    const notes = data.notes?.trim() || null;
    const allowedMethods = ['pickup_appointment', 'external_delivery', 'shop_delivery'];

    if (!allowedMethods.includes(method)) {
      throw new AppError('Invalid fulfillment method', 400);
    }

    const shop_delivery_eligible = isLuzonLocation(project);
    if (method === 'shop_delivery' && !shop_delivery_eligible) {
      throw new AppError('Shop delivery is only available for Luzon addresses', 400);
    }

    let pickupAppointmentId = project.pickup_appointment_id || null;
    let pickupAppointment = null;

    if (method === 'pickup_appointment') {
      if (!data.scheduled_at) {
        throw new AppError('Pickup appointment date and time are required', 400);
      }

      const scheduledAt = new Date(data.scheduled_at);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        throw new AppError('Pickup appointment must be scheduled in the future', 400);
      }

      const appointmentNotes = buildFulfillmentAppointmentNotes(project, 'pickup appointment', notes);
      const appointmentPayload = [
        project.customer_id,
        'pickup',
        project.order_id,
        JSON.stringify([]),
        'shop',
        JSON.stringify({
          project_id: project.project_id,
          project_name: project.name || project.title,
          order_number: project.order_number,
          fulfillment_method: method,
        }),
        scheduledAt.toISOString(),
        appointmentNotes,
        notes,
      ];

      if (pickupAppointmentId) {
        const updatedAppointment = await client.query(
          `UPDATE appointments
           SET user_id = $1,
               appointment_type = $2,
               order_id = $3,
               services = $4,
               location_id = $5,
               guitar_details = $6,
               scheduled_at = $7,
               notes = $8,
               confirmation_notes = $9,
               status = CASE WHEN status = 'cancelled' THEN 'pending' ELSE status END,
               updated_at = now()
           WHERE appointment_id = $10
           RETURNING appointment_id, appointment_type, order_id, location_id, scheduled_at, status, notes, confirmation_notes`,
          [...appointmentPayload, pickupAppointmentId]
        );

        if (updatedAppointment.rows.length > 0) {
          pickupAppointment = updatedAppointment.rows[0];
        } else {
          pickupAppointmentId = null;
        }
      }

      if (!pickupAppointment) {
        const insertedAppointment = await client.query(
          `INSERT INTO appointments (
             user_id, appointment_type, order_id, services, location_id, guitar_details,
             scheduled_at, status, notes, confirmation_notes, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, now(), now())
           RETURNING appointment_id, appointment_type, order_id, location_id, scheduled_at, status, notes, confirmation_notes`,
          appointmentPayload
        );
        pickupAppointment = insertedAppointment.rows[0];
        pickupAppointmentId = pickupAppointment.appointment_id;
      }
    } else if (pickupAppointmentId) {
      await client.query(
        `UPDATE appointments
         SET status = CASE WHEN status IN ('completed', 'cancelled') THEN status ELSE 'cancelled' END,
             notes = COALESCE(notes, '') || CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE ' | ' END || $1,
             updated_at = now()
         WHERE appointment_id = $2`,
        [`Customer switched fulfillment to ${method.replace(/_/g, ' ')}`, pickupAppointmentId]
      );
      pickupAppointmentId = null;
    }

    const fulfillmentStatus = method === 'pickup_appointment'
      ? 'pickup_scheduled'
      : method === 'external_delivery'
      ? 'awaiting_external_pickup'
      : 'shop_delivery_requested';

    await client.query(
      `UPDATE projects
       SET fulfillment_method = $1,
           fulfillment_status = $2,
           fulfillment_notes = $3,
           fulfillment_selected_at = now(),
           pickup_appointment_id = $4,
           updated_at = now()
       WHERE project_id = $5`,
      [method, fulfillmentStatus, notes, pickupAppointmentId, projectId]
    );

    await logActivity(client, projectId, userId, 'fulfillment_updated', { method, fulfillmentStatus });

    await client.query('COMMIT');

    return attachFulfillmentDetails(
      {
        ...project,
        fulfillment_method: method,
        fulfillment_status: fulfillmentStatus,
        fulfillment_notes: notes,
        fulfillment_selected_at: new Date(),
        pickup_appointment_id: pickupAppointmentId,
      },
      pickupAppointment
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.addMilestone = async (projectId, data, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, description, order_index } = data;
    const res = await client.query(
      'INSERT INTO project_milestones (project_id, title, description, order_index) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, title, description, order_index || 0]
    );
    await logActivity(client, projectId, userId, 'milestone_created', { title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.updateMilestone = async (milestoneId, data, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, description, order_index, status } = data;
    const res = await client.query(
      `UPDATE project_milestones 
       SET title = COALESCE($1, title), description = COALESCE($2, description), 
           order_index = COALESCE($3, order_index), status = COALESCE($4, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE milestone_id = $5 RETURNING *`,
      [title, description, order_index, status, milestoneId]
    );
    if (res.rows.length === 0) throw new Error('Milestone not found');
    await logActivity(client, res.rows[0].project_id, userId, 'milestone_updated', { title: res.rows[0].title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.deleteMilestone = async (milestoneId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query('DELETE FROM project_milestones WHERE milestone_id = $1 RETURNING *', [milestoneId]);
    if (res.rows.length === 0) throw new Error('Milestone not found');
    await logActivity(client, res.rows[0].project_id, userId, 'milestone_deleted', { title: res.rows[0].title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.addSubtask = async (milestoneId, data, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mRes = await client.query('SELECT project_id FROM project_milestones WHERE milestone_id = $1', [milestoneId]);
    if (mRes.rows.length === 0) throw new Error('Milestone not found');
    const projectId = mRes.rows[0].project_id;

    const { title, is_customer_updatable, assigned_user_id } = data;
    const res = await client.query(
      'INSERT INTO project_subtasks (milestone_id, title, is_customer_updatable, assigned_user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [milestoneId, title, is_customer_updatable || false, assigned_user_id || null]
    );

    // If milestone was completed, revert to in_progress because a new pending subtask was added
    await client.query("UPDATE project_milestones SET status = 'in_progress' WHERE milestone_id = $1 AND status = 'completed'", [milestoneId]);

    await logActivity(client, projectId, userId, 'subtask_created', { title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.updateSubtaskStatus = async (subtaskId, data, userId, userRole) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sRes = await client.query(`
      SELECT s.*, m.project_id FROM project_subtasks s
      JOIN project_milestones m ON s.milestone_id = m.milestone_id
      WHERE s.subtask_id = $1
    `, [subtaskId]);
    
    if (sRes.rows.length === 0) throw new Error('Subtask not found');
    const subtask = sRes.rows[0];

    // Authorization check
    if (!['super_admin', 'admin', 'staff'].includes(userRole)) {
      if (!subtask.is_customer_updatable) {
        throw new Error('Not authorized to update this subtask');
      }
    }

    const { status, title, assigned_user_id, is_customer_updatable } = data;
    let completedAt = subtask.completed_at;
    let completedBy = subtask.completed_by;

    if (status === 'completed' && subtask.status !== 'completed') {
      completedAt = new Date();
      completedBy = userId;
    } else if (status === 'pending' || status === 'in_progress') {
      completedAt = null;
      completedBy = null;
    }

    const updatedRes = await client.query(
      `UPDATE project_subtasks 
       SET status = COALESCE($1, status),
           title = COALESCE($2, title),
           assigned_user_id = COALESCE($3, assigned_user_id),
           is_customer_updatable = COALESCE($4, is_customer_updatable),
           completed_at = $5,
           completed_by = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE subtask_id = $7 RETURNING *`,
      [status || subtask.status, title, assigned_user_id, is_customer_updatable, completedAt, completedBy, subtaskId]
    );

    const mId = subtask.milestone_id;
    // Auto-complete milestone logic
    const pendingCount = await client.query(`SELECT COUNT(*) FROM project_subtasks WHERE milestone_id = $1 AND status != 'completed'`, [mId]);
    if (parseInt(pendingCount.rows[0].count) === 0) {
      await client.query(`UPDATE project_milestones SET status = 'completed' WHERE milestone_id = $1`, [mId]);
    } else {
      await client.query(`UPDATE project_milestones SET status = 'in_progress' WHERE milestone_id = $1`, [mId]);
    }

    if (status && status !== subtask.status) {
      await logActivity(client, subtask.project_id, userId, 'subtask_status_changed', { title: subtask.title, status });
    }

    await client.query('COMMIT');
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.deleteSubtask = async (subtaskId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`
      DELETE FROM project_subtasks 
      WHERE subtask_id = $1 
      RETURNING *, (SELECT project_id FROM project_milestones WHERE milestone_id = project_subtasks.milestone_id) as project_id
    `, [subtaskId]);
    
    if (res.rows.length === 0) throw new Error('Subtask not found');
    await logActivity(client, res.rows[0].project_id, userId, 'subtask_deleted', { title: res.rows[0].title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getActivityLogs = async (projectId) => {
  const res = await pool.query(`
    SELECT l.*, u.first_name, u.last_name, u.email, u.role
    FROM project_activity_logs l
    LEFT JOIN users u ON l.user_id = u.user_id
    WHERE l.project_id = $1
    ORDER BY l.created_at DESC
  `, [projectId]);
  return res.rows;
};
