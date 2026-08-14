const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const defaultWorkflowService = require('./defaultWorkflowService');
const inventoryService = require('./inventoryService');
const { generateRefundRequestNumber } = require('../utils/orderNumber');
let projectArchiveColumnsReadyPromise = null;

const ensureProjectArchiveColumns = async () => {
  if (projectArchiveColumnsReadyPromise) return projectArchiveColumnsReadyPromise;

  projectArchiveColumnsReadyPromise = (async () => {
    const checkRes = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'projects'
         AND table_schema = current_schema()
         AND column_name IN ('deleted_at', 'deleted_by')`
    );

    const existing = new Set(checkRes.rows.map((row) => row.column_name));

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
  if (normalized === 'on_hold') return 'on_hold'

  return null
}

const generateCustomBuildId = async () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${yy}${mm}${dd}`;

  // Find the highest existing sequence number for today
  const res = await pool.query(
    `SELECT custom_build_id FROM projects 
     WHERE custom_build_id LIKE $1 
     ORDER BY custom_build_id DESC LIMIT 1`,
    [`CMB-${datePrefix}-%`]
  );

  let nextSeq = 1;
  if (res.rows.length > 0) {
    const lastId = res.rows[0].custom_build_id;
    const lastSeq = parseInt(lastId.split('-')[2], 10);
    if (!Number.isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `CMB-${datePrefix}-${String(nextSeq).padStart(4, '0')}`;
};

const PROJECT_BASE_SELECT = `
  SELECT
    p.*,
    p.title AS name,
    p.notes AS description,
    p.claimed_by,
    p.claimed_at,
    p.custom_build_id,
    o.user_id AS customer_id,
    o.order_number,
    o.payment_plan AS order_payment_plan,
    o.total_amount AS order_total_amount,
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
    ) AS customer_name,
    claim_user.first_name AS claimed_first_name,
    claim_user.last_name AS claimed_last_name,
    claim_user.role AS claimed_role,
    refund_latest.refund_request_id,
    refund_latest.refund_status,
    refund_latest.refund_amount_requested,
    refund_latest.refund_reason,
    refund_latest.refund_requested_at,
    refund_latest.refund_decided_at,
    refund_latest.refund_decided_by,
    refund_decider.first_name AS refund_decided_by_name
  FROM projects p
  JOIN orders o ON o.order_id = p.order_id
  LEFT JOIN addresses a ON a.address_id = o.shipping_address_id
  LEFT JOIN users u ON u.user_id = o.user_id
  LEFT JOIN users claim_user ON claim_user.user_id = p.claimed_by
  LEFT JOIN LATERAL (
    SELECT refund_request_id,
           status AS refund_status,
           amount_requested AS refund_amount_requested,
           reason AS refund_reason,
           created_at AS refund_requested_at,
           reviewed_at AS refund_decided_at,
           reviewed_by AS refund_decided_by
    FROM refund_requests rr
    WHERE rr.project_id = p.project_id
      AND rr.deleted_at IS NULL
    ORDER BY rr.created_at DESC
    LIMIT 1
  ) refund_latest ON TRUE
  LEFT JOIN users refund_decider ON refund_decider.user_id = refund_latest.refund_decided_by
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

const REQUIRED_PART_FIELD_MAP = [
  ['body_wood', 'body'],
  ['neck_wood', 'neck'],
  ['fingerboard_wood', 'fretboard'],
  ['bridge_type', 'bridge'],
  ['pickups', 'pickups'],
  ['color', 'finish'],
  ['finish_type', 'finish'],
];

const PART_TYPE_TO_BUILDER_TYPE_MAPPING = {
  body_wood: 'bodyWood',
  neck_wood: 'neck',
  fingerboard_wood: 'fretboard',
  bridge_type: 'bridge',
  pickups: 'pickups',
  color: 'bodyFinish',
  finish_type: 'finishType',
};

const getPartStockStatus = (stock, quantity = 1) => {
  const normalizedStock = Number(stock);
  const normalizedQuantity = Number(quantity) || 1;

  if (!Number.isFinite(normalizedStock)) return 'unknown';
  if (normalizedStock <= 0) return 'out_of_stock';
  if (normalizedStock < normalizedQuantity) return 'low_stock';
  return 'in_stock';
};

const buildPartKey = (part = {}) => {
  const base = [
    part?.source || 'unknown',
    part?.category || 'other',
    part?.name || 'unnamed',
    part?.customization_id || 'global',
    part?.product_id || 'none',
  ];
  if (part?.part_type) {
    base.push(part.part_type);
  }

  return base
    .filter(Boolean)
    .join('::')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const buildRequiredPartsPayload = (customization = {}, linkedParts = []) => {
  const requiredParts = [];
  const customizationId = customization?.customization_id || null;

  REQUIRED_PART_FIELD_MAP.forEach(([fieldName, category]) => {
    const value = customization?.[fieldName];
    if (!value) return;

    const part = {
      customization_id: customizationId,
      name: String(value),
      category,
      quantity: 1,
      source: 'configuration',
      stock: null,
      stock_status: 'unknown',
      needs_purchase: true,
      price: 0,
      part_type: fieldName,
      part_key: buildPartKey({
        source: 'configuration',
        category,
        name: String(value),
        customization_id: customizationId,
        part_type: fieldName,
      }),
      is_received: false,
      received_quantity: 0,
      pending_quantity: 1,
      is_fully_received: false,
      received_at: null,
      received_by: null,
      supplier: null,
    };

    requiredParts.push(part);
  });

  (Array.isArray(linkedParts) ? linkedParts : []).forEach((part) => {
    const quantity = Number(part?.quantity) || 1;
    const stock = part?.stock ?? null;
    const stockStatus = getPartStockStatus(stock, quantity);

    requiredParts.push({
      customization_id: customizationId,
      name: part?.name || part?.part_name || 'Additional part',
      category: 'additional_parts',
      quantity,
      source: 'additional_parts',
      stock,
      stock_status: stockStatus,
      needs_purchase: stockStatus !== 'in_stock',
      price: Number(part?.price) || 0,
      product_id: part?.product_id || null,
      is_active: part?.is_active !== false,
      part_key: buildPartKey({
        source: 'additional_parts',
        category: 'additional_parts',
        name: part?.name || part?.part_name || 'Additional part',
        customization_id: customizationId,
        product_id: part?.product_id || null,
      }),
      is_received: false,
      received_quantity: 0,
      pending_quantity: quantity,
      is_fully_received: false,
      received_at: null,
      received_by: null,
      supplier: null,
    });
  });

  return requiredParts;
};

const getProjectPartReceiptState = (auditRows = []) => {
  const receiptState = new Map();

  (Array.isArray(auditRows) ? auditRows : []).forEach((row) => {
    const details = typeof row?.details === 'string' ? JSON.parse(row.details) : row?.details;
    if (!details || !details.part_key) return;

    const previous = receiptState.get(details.part_key) || { received_quantity: 0 };
    const receivedQuantity = Number(previous.received_quantity || 0) + Number(details.received_quantity || 0);
    
    receiptState.set(details.part_key, {
      received_quantity: receivedQuantity,
      received_at: receivedQuantity > 0 ? (details.received_at || previous.received_at || null) : null,
      received_by: receivedQuantity > 0 ? (details.received_by || previous.received_by || null) : null,
      supplier: receivedQuantity > 0 ? (details.supplier || previous.supplier || null) : null,
    });
  });

  return receiptState;
};

exports.__testOnlyBuildRequiredPartsPayload = buildRequiredPartsPayload;
exports.__testOnlyGetProjectPartReceiptState = getProjectPartReceiptState;

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

  if (normalizedCurrentStatus === 'cancelled' || normalizedCurrentStatus === 'on_hold') {
    return {
      progress,
      status: normalizedCurrentStatus,
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

/**
 * Compute the latest fully-completed build stage (milestone) for a project.
 * A milestone is fully completed only when ALL of its subtasks are completed.
 * Returns { stage_title, completed_at } or { stage_title: null, completed_at: null }
 * when no stage is complete yet.
 */
const getLastCompletedBuildStage = async (db, projectId) => {
  const res = await db.query(
    `SELECT m.title AS stage_title, MAX(s.completed_at) AS completed_at
     FROM project_milestones m
     LEFT JOIN project_subtasks s ON s.milestone_id = m.milestone_id
     WHERE m.project_id = $1
     GROUP BY m.milestone_id, m.title, m.order_index
     HAVING COUNT(s.subtask_id) > 0
        AND COUNT(CASE WHEN s.status = 'completed' THEN 1 END) = COUNT(s.subtask_id)
     ORDER BY m.order_index ASC, MAX(s.completed_at) ASC
     LIMIT 1`,
    [projectId]
  );
  if (res.rows.length === 0) {
    return { stage_title: null, completed_at: null };
  }
  return { stage_title: res.rows[0].stage_title, completed_at: res.rows[0].completed_at };
};

/**
 * Persist the latest completed stage onto the project row so the snapshot
 * survives status changes (including cancellation).
 */
const syncLastCompletedStage = async (db, projectId) => {
  const { stage_title, completed_at } = await getLastCompletedBuildStage(db, projectId);
  await db.query(
    `UPDATE projects
     SET last_completed_stage = $1,
         last_completed_stage_at = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $3`,
    [stage_title, completed_at, projectId]
  );
  return { stage_title, completed_at };
};

/**
 * Freeze the current completed stage into the permanent cancellation columns.
 * Called when an admin approves a cancellation.
 */
const snapshotCancelledStage = async (db, projectId) => {
  const current = await db.query(
    `SELECT last_completed_stage, last_completed_stage_at
     FROM projects
     WHERE project_id = $1`,
    [projectId]
  );
  const row = current.rows[0] || {};
  await db.query(
    `UPDATE projects
     SET cancelled_stage_snapshot = $1,
         cancelled_stage_snapshot_at = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $3`,
    [row.last_completed_stage || null, row.last_completed_stage_at || null, projectId]
  );
};

/**
 * Attach the latest refund request state to a batch of project rows so the
 * project list/table, customer modal, and admin modal always show the same
 * underlying refund data (no divergent copies).
 */
const attachRefundStateToProjects = async (projects) => {
  if (!Array.isArray(projects) || projects.length === 0) return projects;

  const projectIds = projects.map((p) => p.project_id);
  const res = await pool.query(
    `SELECT DISTINCT ON (rr.project_id)
       rr.project_id,
       rr.refund_request_id,
       rr.status AS refund_status,
       rr.amount_requested AS refund_amount_requested,
       rr.reason AS refund_reason,
       rr.created_at AS refund_requested_at,
       rr.reviewed_at AS refund_decided_at,
       rr.reviewed_by AS refund_decided_by,
       u.first_name AS refund_decided_by_name
     FROM refund_requests rr
     LEFT JOIN users u ON u.user_id = rr.reviewed_by
     WHERE rr.project_id = ANY($1::uuid[])
       AND rr.deleted_at IS NULL
     ORDER BY rr.project_id, rr.created_at DESC`,
    [projectIds]
  );

  const refundByProject = res.rows.reduce((acc, row) => {
    acc[row.project_id] = row;
    return acc;
  }, {});

  return projects.map((project) => {
    const refund = refundByProject[project.project_id] || {};
    return {
      ...project,
      refund_request_id: refund.refund_request_id || null,
      refund_status: refund.refund_status || null,
      refund_amount_requested: refund.refund_amount_requested || null,
      refund_reason: refund.refund_reason || null,
      refund_requested_at: refund.refund_requested_at || null,
      refund_decided_at: refund.refund_decided_at || null,
      refund_decided_by: refund.refund_decided_by || null,
      refund_decided_by_name: refund.refund_decided_by_name || null,
    };
  });
};

exports.getAllProjects = async (params = {}) => {
  await ensureProjectArchiveColumns();

  const {
    search,
    status,
    assigned_to,
    guitar_type,
    date_from,
    date_to,
    due_date_from,
    due_date_to,
    completion_percentage,
    sort_by = 'updated_at',
    sort_dir = 'desc',
    page = 1,
    page_size = 20,
    include_tasks = false,
    user_id = null,
  } = params;

  const limit = Math.min(Math.max(Number(page_size) || 20, 1), 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const allowedSortColumns = [
    'updated_at',
    'created_at',
    'project_name',
    'customer_name',
    'progress',
    'estimated_completion_date',
    'status',
  ];
  const orderBy = allowedSortColumns.includes(sort_by) ? sort_by : 'updated_at';
  const orderDir = sort_dir === 'asc' ? 'ASC' : 'DESC';

  const where = ['p.deleted_at IS NULL'];
  const queryParams = [];
  let idx = 1;

  if (user_id) {
    where.push(`o.user_id = $${idx++}`);
    queryParams.push(user_id);
  }

  if (status) {
    where.push(`p.status = $${idx++}`);
    queryParams.push(status);
  }

  if (assigned_to) {
    where.push(
      `(p.claimed_by = $${idx++} OR EXISTS (SELECT 1 FROM project_team_members ptm WHERE ptm.project_id = p.project_id AND ptm.user_id = $${idx++}))`
    );
    queryParams.push(assigned_to, assigned_to);
  }

  if (guitar_type) {
    where.push(`c.guitar_type::text ILIKE $${idx++}`);
    queryParams.push(`%${guitar_type}%`);
  }

  if (date_from) {
    where.push(`p.created_at >= $${idx++}`);
    queryParams.push(date_from);
  }

  if (date_to) {
    where.push(`p.created_at <= $${idx++}`);
    queryParams.push(date_to);
  }

  if (due_date_from) {
    where.push(`p.estimated_completion_date >= $${idx++}`);
    queryParams.push(due_date_from);
  }

  if (due_date_to) {
    where.push(`p.estimated_completion_date <= $${idx++}`);
    queryParams.push(due_date_to);
  }

  if (completion_percentage !== undefined && completion_percentage !== '') {
    const num = Number(completion_percentage);
    if (!Number.isNaN(num)) {
      where.push(`p.progress = $${idx++}`);
      queryParams.push(num);
    }
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  let searchClause = '';
  if (search && String(search).trim()) {
    const term = `%${String(search).trim().toLowerCase()}%`;
    searchClause = `AND (
      p.title ILIKE $${idx++}
      OR p.project_id::TEXT ILIKE $${idx++}
      OR LOWER(u.first_name || ' ' || u.last_name) ILIKE $${idx++}
      OR LOWER(claim_user.first_name || ' ' || claim_user.last_name) ILIKE $${idx++}
      OR p.status::TEXT ILIKE $${idx++}
      OR EXISTS (SELECT 1 FROM order_items oi_search JOIN customizations c_search ON c_search.customization_id = oi_search.customization_id WHERE oi_search.order_id = o.order_id AND c_search.guitar_type::text ILIKE $${idx++})
      OR o.order_number ILIKE $${idx++}
      OR EXISTS (SELECT 1 FROM project_tasks pt_search WHERE pt_search.project_id = p.project_id AND pt_search.task_name ILIKE $${idx++})
      OR p.notes ILIKE $${idx++}
      OR EXISTS (
        SELECT 1 FROM project_subtasks pst
        WHERE pst.milestone_id IN (SELECT milestone_id FROM project_milestones WHERE project_id = p.project_id)
          AND pst.title ILIKE $${idx++}
      )
    )`;
    for (let i = 0; i < 10; i++) {
      queryParams.push(term);
    }
  }

  const sortColumn =
    orderBy === 'project_name'
      ? `p.title ${orderDir}`
      : orderBy === 'customer_name'
        ? `u.last_name ${orderDir}, u.first_name ${orderDir}`
        : orderBy === 'progress'
          ? `p.progress ${orderDir}`
          : orderBy === 'estimated_completion_date'
            ? `p.estimated_completion_date ${orderDir} NULLS LAST`
            : orderBy === 'status'
              ? `p.status ${orderDir}`
              : `p.${orderBy} ${orderDir}`;

  const totalQuery = `
    SELECT COUNT(DISTINCT p.project_id)::int AS total
    FROM projects p
    JOIN orders o ON o.order_id = p.order_id
    LEFT JOIN users u ON u.user_id = o.user_id
    LEFT JOIN users claim_user ON claim_user.user_id = p.claimed_by
    ${whereClause}
    ${searchClause}
  `;

  const totalResult = await pool.query(totalQuery, queryParams);
  const total = totalResult.rows[0]?.total || 0;

  const dataQuery = `
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
        CASE WHEN COALESCE(u.first_name, '') <> '' AND COALESCE(u.last_name, '') <> '' THEN ' ' ELSE '' END,
        COALESCE(u.last_name, '')
      ) AS customer_name,
      claim_user.first_name AS claimed_first_name,
      claim_user.last_name AS claimed_last_name,
      claim_user.role AS claimed_role,
      (
        SELECT MAX(c2.guitar_type)
        FROM order_items oi2
        JOIN customizations c2 ON c2.customization_id = oi2.customization_id
        WHERE oi2.order_id = o.order_id
      ) AS guitar_type
    FROM projects p
    JOIN orders o ON o.order_id = p.order_id
    LEFT JOIN addresses a ON a.address_id = o.shipping_address_id
    LEFT JOIN users u ON u.user_id = o.user_id
    LEFT JOIN users claim_user ON claim_user.user_id = p.claimed_by
    ${whereClause}
    ${searchClause}
    ORDER BY ${sortColumn}
    LIMIT $${idx++} OFFSET $${idx++}
  `;

  const dataResult = await pool.query(dataQuery, [...queryParams, limit, offset]);
  const projects = dataResult.rows;

  if (projects.length === 0) {
    return {
      projects: [],
      pagination: { page, page_size: limit, total, total_pages: 1 },
    };
  }

  const projectIds = projects.map((p) => p.project_id);

  let taskStatsByProject = {};
  if (include_tasks === true || include_tasks === 'true') {
    const taskStatsRes = await pool.query(
      `SELECT
        pm.project_id,
        COUNT(*)::int AS total,
        COUNT(CASE WHEN ps.status = 'completed' THEN 1 END)::int AS completed
      FROM project_subtasks ps
      JOIN project_milestones pm ON ps.milestone_id = pm.milestone_id
      WHERE pm.project_id = ANY($1)
      GROUP BY pm.project_id`,
      [projectIds]
    );
    taskStatsByProject = taskStatsRes.rows.reduce((acc, row) => {
      acc[row.project_id] = { total: row.total, completed: row.completed };
      return acc;
    }, {});
  }

  const customizationRes = await pool.query(
    `SELECT DISTINCT
       oi.order_id,
       c.customization_id,
       c.guitar_type
     FROM order_items oi
     JOIN customizations c ON c.customization_id = oi.customization_id
     WHERE oi.order_id = ANY(
       SELECT order_id FROM projects WHERE project_id = ANY($1)
     )`,
    [projectIds]
  );

  const customizationsByOrder = customizationRes.rows.reduce((acc, row) => {
    if (!acc[row.order_id]) acc[row.order_id] = [];
    acc[row.order_id].push(row);
    return acc;
  }, {});

  const enrichedProjects = projects.map((project) => {
    const taskStats = taskStatsByProject[project.project_id] || { total: 0, completed: 0 };
    const progress = Math.max(
      0,
      Math.min(100, Number.isFinite(Number(project.progress)) ? Number(project.progress) : 0)
    );
    const tracking = buildProjectTaskTracking(taskStats, project.status);
    const orderCustomizations = customizationsByOrder[project.order_id] || [];
    const primaryGuitarType = orderCustomizations[0]?.guitar_type || project.guitar_type || null;

    return {
      ...project,
      progress: tracking.progress || progress,
      status: tracking.status || project.status,
      task_summary: tracking.task_summary,
      customization_ids: orderCustomizations.map((c) => c.customization_id),
      primary_customization_id: orderCustomizations[0]?.customization_id || null,
      guitar_type: primaryGuitarType,
      items: [],
      payment_method: null,
      payment: null,
    };
  });

  const projectsWithRefund = await attachRefundStateToProjects(enrichedProjects);

  return {
    projects: projectsWithRefund,
    pagination: {
      page,
      page_size: limit,
      total,
      total_pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

exports.getAllArchivedProjects = async (params = {}) => {
  await ensureProjectArchiveColumns();

  const {
    search,
    status,
    assigned_to,
    guitar_type,
    date_from,
    date_to,
    due_date_from,
    due_date_to,
    completion_percentage,
    sort_by = 'updated_at',
    sort_dir = 'desc',
    page = 1,
    page_size = 20,
    include_tasks = false,
    user_id = null,
  } = params;

  const limit = Math.min(Math.max(Number(page_size) || 20, 1), 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const allowedSortColumns = [
    'updated_at',
    'created_at',
    'project_name',
    'customer_name',
    'progress',
    'estimated_completion_date',
    'status',
  ];
  const orderBy = allowedSortColumns.includes(sort_by) ? sort_by : 'updated_at';
  const orderDir = sort_dir === 'asc' ? 'ASC' : 'DESC';

  const where = ['p.deleted_at IS NOT NULL'];
  const queryParams = [];
  let idx = 1;

  if (user_id) {
    where.push(`o.user_id = $${idx++}`);
    queryParams.push(user_id);
  }

  if (status) {
    where.push(`p.status = $${idx++}`);
    queryParams.push(status);
  }

  if (assigned_to) {
    where.push(
      `(p.claimed_by = $${idx++} OR EXISTS (SELECT 1 FROM project_team_members ptm WHERE ptm.project_id = p.project_id AND ptm.user_id = $${idx++}))`
    );
    queryParams.push(assigned_to, assigned_to);
  }

  if (guitar_type) {
    where.push(`c.guitar_type::text ILIKE $${idx++}`);
    queryParams.push(`%${guitar_type}%`);
  }

  if (date_from) {
    where.push(`p.created_at >= $${idx++}`);
    queryParams.push(date_from);
  }

  if (date_to) {
    where.push(`p.created_at <= $${idx++}`);
    queryParams.push(date_to);
  }

  if (due_date_from) {
    where.push(`p.estimated_completion_date >= $${idx++}`);
    queryParams.push(due_date_from);
  }

  if (due_date_to) {
    where.push(`p.estimated_completion_date <= $${idx++}`);
    queryParams.push(due_date_to);
  }

  if (completion_percentage !== undefined && completion_percentage !== '') {
    const num = Number(completion_percentage);
    if (!Number.isNaN(num)) {
      where.push(`p.progress = $${idx++}`);
      queryParams.push(num);
    }
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  let searchClause = '';
  if (search && String(search).trim()) {
    const term = `%${String(search).trim().toLowerCase()}%`;
    searchClause = `AND (
      p.title ILIKE $${idx++}
      OR p.project_id::TEXT ILIKE $${idx++}
      OR LOWER(u.first_name || ' ' || u.last_name) ILIKE $${idx++}
      OR LOWER(claim_user.first_name || ' ' || claim_user.last_name) ILIKE $${idx++}
      OR p.status::TEXT ILIKE $${idx++}
      OR EXISTS (SELECT 1 FROM order_items oi_search JOIN customizations c_search ON c_search.customization_id = oi_search.customization_id WHERE oi_search.order_id = o.order_id AND c_search.guitar_type::text ILIKE $${idx++})
      OR o.order_number ILIKE $${idx++}
      OR EXISTS (SELECT 1 FROM project_tasks pt_search WHERE pt_search.project_id = p.project_id AND pt_search.task_name ILIKE $${idx++})
      OR p.notes ILIKE $${idx++}
      OR EXISTS (
        SELECT 1 FROM project_subtasks pst
        WHERE pst.milestone_id IN (SELECT milestone_id FROM project_milestones WHERE project_id = p.project_id)
          AND pst.title ILIKE $${idx++}
      )
    )`;
    for (let i = 0; i < 10; i++) {
      queryParams.push(term);
    }
  }

  const sortColumn =
    orderBy === 'project_name'
      ? `p.title ${orderDir}`
      : orderBy === 'customer_name'
        ? `u.last_name ${orderDir}, u.first_name ${orderDir}`
        : orderBy === 'progress'
          ? `p.progress ${orderDir}`
          : orderBy === 'estimated_completion_date'
            ? `p.estimated_completion_date ${orderDir} NULLS LAST`
            : orderBy === 'status'
              ? `p.status ${orderDir}`
              : `p.${orderBy} ${orderDir}`;

  const totalQuery = `
    SELECT COUNT(DISTINCT p.project_id)::int AS total
    FROM projects p
    JOIN orders o ON o.order_id = p.order_id
    LEFT JOIN users u ON u.user_id = o.user_id
    LEFT JOIN users claim_user ON claim_user.user_id = p.claimed_by
    ${whereClause}
    ${searchClause}
  `;

  const totalResult = await pool.query(totalQuery, queryParams);
  const total = totalResult.rows[0]?.total || 0;

  const dataQuery = `
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
        CASE WHEN COALESCE(u.first_name, '') <> '' AND COALESCE(u.last_name, '') <> '' THEN ' ' ELSE '' END,
        COALESCE(u.last_name, '')
      ) AS customer_name,
      claim_user.first_name AS claimed_first_name,
      claim_user.last_name AS claimed_last_name,
      claim_user.role AS claimed_role,
      (
        SELECT MAX(c2.guitar_type)
        FROM order_items oi2
        JOIN customizations c2 ON c2.customization_id = oi2.customization_id
        WHERE oi2.order_id = o.order_id
      ) AS guitar_type
    FROM projects p
    JOIN orders o ON o.order_id = p.order_id
    LEFT JOIN addresses a ON a.address_id = o.shipping_address_id
    LEFT JOIN users u ON u.user_id = o.user_id
    LEFT JOIN users claim_user ON claim_user.user_id = p.claimed_by
    ${whereClause}
    ${searchClause}
    ORDER BY ${sortColumn}
    LIMIT $${idx++} OFFSET $${idx++}
  `;

  const dataResult = await pool.query(dataQuery, [...queryParams, limit, offset]);
  const projects = dataResult.rows;

  if (projects.length === 0) {
    return {
      projects: [],
      pagination: { page, page_size: limit, total, total_pages: 1 },
    };
  }

  const projectIds = projects.map((p) => p.project_id);

  let taskStatsByProject = {};
  if (include_tasks === true || include_tasks === 'true') {
    const taskStatsRes = await pool.query(
      `SELECT
        pm.project_id,
        COUNT(*)::int AS total,
        COUNT(CASE WHEN ps.status = 'completed' THEN 1 END)::int AS completed
      FROM project_subtasks ps
      JOIN project_milestones pm ON ps.milestone_id = pm.milestone_id
      WHERE pm.project_id = ANY($1)
      GROUP BY pm.project_id`,
      [projectIds]
    );
    taskStatsByProject = taskStatsRes.rows.reduce((acc, row) => {
      acc[row.project_id] = { total: row.total, completed: row.completed };
      return acc;
    }, {});
  }

  const customizationRes = await pool.query(
    `SELECT DISTINCT
       oi.order_id,
       c.customization_id,
       c.guitar_type
     FROM order_items oi
     JOIN customizations c ON c.customization_id = oi.customization_id
     WHERE oi.order_id = ANY(
       SELECT order_id FROM projects WHERE project_id = ANY($1)
     )`,
    [projectIds]
  );

  const customizationsByOrder = customizationRes.rows.reduce((acc, row) => {
    if (!acc[row.order_id]) acc[row.order_id] = [];
    acc[row.order_id].push(row);
    return acc;
  }, {});

  const enrichedProjects = projects.map((project) => {
    const taskStats = taskStatsByProject[project.project_id] || { total: 0, completed: 0 };
    const progress = Math.max(
      0,
      Math.min(100, Number.isFinite(Number(project.progress)) ? Number(project.progress) : 0)
    );
    const tracking = buildProjectTaskTracking(taskStats, project.status);
    const orderCustomizations = customizationsByOrder[project.order_id] || [];
    const primaryGuitarType = orderCustomizations[0]?.guitar_type || project.guitar_type || null;

    return {
      ...project,
      progress: tracking.progress || progress,
      status: tracking.status || project.status,
      task_summary: tracking.task_summary,
      customization_ids: orderCustomizations.map((c) => c.customization_id),
      primary_customization_id: orderCustomizations[0]?.customization_id || null,
      guitar_type: primaryGuitarType,
      items: [],
      payment_method: null,
      payment: null,
    };
  });

  const projectsWithRefund = await attachRefundStateToProjects(enrichedProjects);

  return {
    projects: projectsWithRefund,
    pagination: {
      page,
      page_size: limit,
      total,
      total_pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

exports.getArchivedProjects = async (params = {}) => {
  const result = await exports.getAllArchivedProjects({ ...params, include_tasks: true });
  return result.projects;
};

exports.getProjects = async (params = {}) => {
  const result = await exports.getAllProjects({ ...params, include_tasks: true });
  return result.projects;
};

exports.getProjectById = async (projectId) => {
  await ensureProjectArchiveColumns();
  const result = await pool.query(
    `${PROJECT_BASE_SELECT}
     WHERE p.project_id = $1
       AND p.deleted_at IS NULL`,
    [projectId]
  );
  if (result.rows.length === 0) return null;
  const trackedProject = await applyProjectTaskTracking(pool, result.rows[0], { persist: true });
  return attachFulfillmentDetails(trackedProject);
};

exports.getMyProjects = async (userId, params = {}) => {
  await ensureProjectArchiveColumns();
  const result = await exports.getAllProjects({ ...params, user_id: userId, include_tasks: true });
  const projects = result.projects;
  for (let p of projects) {
    Object.assign(p, attachFulfillmentDetails(p));
  }
  return { projects, pagination: result.pagination };
};

exports.createProject = async (projectData) => {
  await ensureProjectArchiveColumns();
  const { order_id, orderId, title, name, status, description, notes, estimated_completion_date } = projectData;
  const projectOrderId = order_id || orderId
  const projectTitle = title || name
  const normalizedStatus = normalizeProjectStatus(status) || 'not_started'

  // Generate unique custom_build_id
  const customBuildId = await generateCustomBuildId();

  const result = await pool.query(
    `INSERT INTO projects (order_id, title, status, notes, estimated_completion_date, custom_build_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [projectOrderId, projectTitle, normalizedStatus, notes ?? description ?? null, estimated_completion_date || null, customBuildId]
  );
  const createdProject = result.rows[0];
  const projectId = createdProject.project_id;

  // Apply default workflow for new projects when no milestones exist yet.
  const milestoneCountRes = await pool.query(
    'SELECT COUNT(*) FROM project_milestones WHERE project_id = $1',
    [projectId]
  );
  if (parseInt(milestoneCountRes.rows[0].count, 10) === 0) {
    await defaultWorkflowService.applyDefaultWorkflowToProject(projectId, null);
  }

  // If the order is on installment plan, create the installment schedule
  try {
    const orderRes = await pool.query(
      `SELECT payment_plan, total_amount, initial_payment_percentage, installment_tenure_months
       FROM orders WHERE order_id = $1`,
      [projectOrderId]
    );
    if (orderRes.rows.length > 0) {
      const order = orderRes.rows[0];
      if (order.payment_plan === 'installment') {
        const installmentService = require('./installmentService');
        const totalAmount = Number(order.total_amount) || 0;
        const initialPaymentPercentage = Number(order.initial_payment_percentage) || 0.50;
        const tenureMonths = Number(order.installment_tenure_months) || 6;
        
        await installmentService.createInstallmentSchedule(
          pool,
          projectId,
          totalAmount,
          initialPaymentPercentage,
          tenureMonths,
          0.03
        );
      }
    }
  } catch (err) {
    console.warn('Could not create installment schedule:', err.message);
    // Non-blocking - project is still created
  }

  return { ...createdProject, name: createdProject.title, description: createdProject.notes };
};

exports.updateProject = async (projectId, projectData) => {
  await ensureProjectArchiveColumns();
  const { title, name, status, description, notes, estimated_completion_date } = projectData;
  const normalizedStatus = normalizeProjectStatus(status)

  const existingRes = await pool.query(
    `SELECT status FROM projects WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  if (existingRes.rows.length === 0) return null;
  const existingStatus = normalizeProjectStatus(existingRes.rows[0].status);
  const updatedStatus = normalizedStatus || existingStatus;

  const result = await pool.query(
    `UPDATE projects 
     SET title = COALESCE($1, title),
         status = COALESCE($2, status),
         notes = COALESCE($3, notes),
         estimated_completion_date = COALESCE($4, estimated_completion_date),
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $5
       AND deleted_at IS NULL
     RETURNING *`,
    [title || name, updatedStatus, notes ?? description, estimated_completion_date || null, projectId]
  );
  if (result.rows.length === 0) return null;

  if (updatedStatus === 'in_progress' && existingStatus !== 'in_progress') {
    const milestoneCountRes = await pool.query(
      'SELECT COUNT(*) FROM project_milestones WHERE project_id = $1',
      [projectId]
    );
    if (parseInt(milestoneCountRes.rows[0].count, 10) === 0) {
      await defaultWorkflowService.applyDefaultWorkflowToProject(projectId, null);
    }
  }

  return { ...result.rows[0], name: result.rows[0].title, description: result.rows[0].notes };
};

exports.cancelProject = async (projectId, userId, userRole) => {
  await ensureProjectArchiveColumns();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const projectResult = await client.query(
      `SELECT p.project_id, p.order_id, p.status, p.progress, o.user_id AS customer_id
       FROM projects p
       JOIN orders o ON o.order_id = p.order_id
       WHERE p.project_id = $1
         AND p.deleted_at IS NULL
       FOR UPDATE`,
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

    const normalizedStatus = normalizeProjectStatus(project.status);
    if (!isPrivileged && normalizedStatus !== 'not_started') {
      throw new AppError('This project has already started. Please use the Current Build Claim flow to request cancellation.', 400);
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

    const paymentRes = await client.query(
      `SELECT payment_id, amount, status FROM payments
       WHERE order_id = $1 AND status NOT IN ('rejected', 'cancelled', 'refunded')
       ORDER BY created_at DESC
       LIMIT 1`,
      [project.order_id]
    );
    const latestPayment = paymentRes.rows[0] || null;

    if (latestPayment) {
      const existingRefundRes = await client.query(
        `SELECT refund_request_id, status FROM refund_requests
         WHERE project_id = $1
           AND status IN ('pending', 'approved', 'pending_payment_verification')
           AND deleted_at IS NULL
         LIMIT 1`,
        [projectId]
      );

      if (existingRefundRes.rows.length === 0) {
        let refundStatus = 'pending';
        let amountRequested = Number(latestPayment.amount);

        if (latestPayment.status === 'verified') {
          refundStatus = 'pending';
        } else if (['pending', 'for_verification'].includes(latestPayment.status)) {
          refundStatus = 'pending_payment_verification';
        } else {
          amountRequested = 0;
          refundStatus = null;
        }

        if (refundStatus && amountRequested > 0) {
          const requestNumber = await generateRefundRequestNumber(client, 'RF');

          await client.query(
            `INSERT INTO refund_requests (
               order_id, user_id, project_id, payment_id, reason, customer_notes,
               amount_requested, build_stage_at_request, status, request_number
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              project.order_id,
              userId,
              projectId,
              latestPayment.payment_id,
              'Automatic refund request from project cancellation',
              null,
              amountRequested,
              null,
              refundStatus,
              requestNumber,
            ]
          );

          await logActivity(client, projectId, userId, 'refund_requested', {
            refund_request_reason: 'Automatic refund request from project cancellation',
            amount_requested: amountRequested,
            refund_status: refundStatus,
            payment_status_at_cancel: latestPayment.status,
          });
        }
      }
    }

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
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $1
       AND deleted_at IS NULL
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
     SET deleted_at = NULL,
         deleted_by = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $1
       AND deleted_at IS NOT NULL
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
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, actionType, 'project', projectId, JSON.stringify(details)]
  );
};

exports.getProjectRequiredParts = async (projectId) => {
  await ensureProjectArchiveColumns();
  const client = await pool.connect();
  try {
    const pResult = await client.query(
      `${PROJECT_BASE_SELECT}
       WHERE p.project_id = $1
         AND p.deleted_at IS NULL`,
      [projectId]
    );
    if (pResult.rows.length === 0) return null;

    const project = pResult.rows[0];
    const customizationResult = await client.query(
      `SELECT DISTINCT
         c.customization_id,
         c.created_at,
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
       ORDER BY c.created_at ASC, c.customization_id ASC`,
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
           p.product_id,
           p.is_active,
           i.stock
         FROM customization_parts cp
         LEFT JOIN products p ON p.product_id = cp.product_id
         LEFT JOIN inventory i ON i.product_id = cp.product_id
         WHERE cp.customization_id = ANY($1::uuid[])
         ORDER BY cp.created_at ASC`,
        [customizationIds]
      );
      linkedParts = linkedPartsResult.rows;
    }

    const requiredParts = customizationResult.rows.flatMap((customization) => buildRequiredPartsPayload(
      customization,
      linkedParts.filter((part) => part.customization_id === customization.customization_id)
    ));

    const receiptsResult = await client.query(
      `SELECT details
       FROM audit_logs
       WHERE entity_type = 'project'
         AND entity_id = $1
         AND action = 'project_part_received'
       ORDER BY created_at ASC`,
      [projectId]
    );

    const receiptState = getProjectPartReceiptState(receiptsResult.rows);

    let builderPartsLookup = null;
    let productsByNameLookup = null;
    try {
      const columnCheck = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'guitar_builder_parts' AND column_name = 'product_id'`
      );
      if (columnCheck.rows.length === 0) {
        console.warn('[projectService] guitar_builder_parts.product_id column missing. Stock/price lookup will still work but inventory sync requires migration 005.');
      }
      if (customizationResult.rows.length > 0) {
        const guitarTypes = [...new Set(customizationResult.rows.map(r => r.guitar_type).filter(Boolean))];
        if (guitarTypes.length > 0) {
          const lowercasedTypes = guitarTypes.map(t => t.toLowerCase());
          const builderRes = await client.query(
            `SELECT gbp.part_id, gbp.guitar_type, gbp.type_mapping, gbp.name, gbp.price, gbp.stock
             FROM guitar_builder_parts gbp
             WHERE LOWER(gbp.guitar_type) = ANY($1::text[])
               AND gbp.is_active = true`,
            [lowercasedTypes]
          );
          console.log(`[projectService] Found ${builderRes.rows.length} active builder parts for guitar types: ${lowercasedTypes.join(', ')}`);
          if (builderRes.rows.length > 0 && builderRes.rows.length <= 50) {
            console.log('[projectService] Builder parts:', builderRes.rows.map(r => `${r.guitar_type}|${r.type_mapping}|${r.name}|stock=${r.stock}|price=${r.price}`).join(' || '));
          }
          builderPartsLookup = new Map();
          for (const row of builderRes.rows) {
            const mapKey = `${(row.guitar_type || '').toLowerCase()}::${(row.type_mapping || '').toLowerCase()}`;
            if (!builderPartsLookup.has(mapKey)) {
              builderPartsLookup.set(mapKey, []);
            }
            builderPartsLookup.get(mapKey).push(row);
          }

          const productNames = [...new Set(builderRes.rows.map(r => r.name).filter(Boolean))];
          if (productNames.length > 0) {
            const productsRes = await client.query(
              `SELECT name, price FROM products WHERE name = ANY($1::text[]) AND is_active = true`,
              [productNames]
            );
            productsByNameLookup = new Map();
            for (const row of productsRes.rows) {
              productsByNameLookup.set(row.name.toLowerCase(), row.price);
            }
            console.log(`[projectService] Loaded ${productsByNameLookup.size} product prices from products table`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load builder parts lookup:', err.message);
      builderPartsLookup = null;
      productsByNameLookup = null;
    }

    const enrichedParts = [];
    for (const part of requiredParts) {
      let enrichedPart = { ...part };

      if (enrichedPart.source === 'configuration' && builderPartsLookup) {
        const customization = customizationResult.rows.find(c => c.customization_id === enrichedPart.customization_id);
        if (customization?.guitar_type) {
          const builderTypeMapping = PART_TYPE_TO_BUILDER_TYPE_MAPPING[enrichedPart.part_type];
          if (builderTypeMapping) {
            const mapKey = `${(customization.guitar_type || '').toLowerCase()}::${builderTypeMapping.toLowerCase()}`;
            const candidates = builderPartsLookup.get(mapKey) || [];
            const match = candidates.find(p =>
              (p.name || '').toLowerCase().includes((enrichedPart.name || '').toLowerCase())
            );
            if (match) {
              const productPrice = productsByNameLookup?.get((match.name || '').toLowerCase());
              const finalPrice = match.price > 0 ? match.price : (productPrice || 0);
              console.log(`[projectService] MATCHED part "${enrichedPart.name}" (${enrichedPart.part_type}) → builder part "${match.name}" stock=${match.stock} price=${finalPrice}${productPrice ? ' (from products table)' : ''}`);
              enrichedPart.product_id = enrichedPart.product_id || null;
              enrichedPart.stock = match.stock ?? null;
              enrichedPart.price = finalPrice;
              enrichedPart.stock_status = getPartStockStatus(match.stock, enrichedPart.quantity);
              enrichedPart.needs_purchase = enrichedPart.stock_status !== 'in_stock';
            } else {
              const fallbackCandidates = builderPartsLookup.get(`${(customization.guitar_type || '').toLowerCase()}::${(enrichedPart.name || '').toLowerCase().split(' ')[0] || ''}`) || [];
              const fallbackMatch = fallbackCandidates.find(p =>
                (p.name || '').toLowerCase().includes((enrichedPart.name || '').toLowerCase())
              );
              if (fallbackMatch) {
                const productPrice = productsByNameLookup?.get((fallbackMatch.name || '').toLowerCase());
                const finalPrice = fallbackMatch.price > 0 ? fallbackMatch.price : (productPrice || 0);
                console.log(`[projectService] FALLBACK MATCHED part "${enrichedPart.name}" → "${fallbackMatch.name}" stock=${fallbackMatch.stock} price=${finalPrice}`);
                enrichedPart.product_id = enrichedPart.product_id || null;
                enrichedPart.stock = fallbackMatch.stock ?? null;
                enrichedPart.price = finalPrice;
                enrichedPart.stock_status = getPartStockStatus(fallbackMatch.stock, enrichedPart.quantity);
                enrichedPart.needs_purchase = enrichedPart.stock_status !== 'in_stock';
              } else if (candidates.length > 0) {
                console.warn(`[projectService] NO MATCH for part "${enrichedPart.name}" (type: ${enrichedPart.part_type}, key: ${mapKey}). Candidates: ${candidates.map(c => c.name).join(' | ')}`);
              } else {
                console.warn(`[projectService] NO CANDIDATES for part "${enrichedPart.name}" (type: ${enrichedPart.part_type}, key: ${mapKey}). All keys: ${[...builderPartsLookup.keys()].join(', ')}`);
              }
            }
          }
        }
      }

      const receipt = receiptState.get(enrichedPart.part_key) || null;
      const receivedQuantity = Number(receipt?.received_quantity || 0);
      const requiredQuantity = Number(enrichedPart.quantity) || 1;
      const pendingQuantity = Math.max(requiredQuantity - receivedQuantity, 0);
      const isFullyReceived = pendingQuantity === 0 && requiredQuantity > 0;

      enrichedParts.push({
        ...enrichedPart,
        is_received: receivedQuantity > 0,
        received_quantity: receivedQuantity,
        pending_quantity: pendingQuantity,
        is_fully_received: isFullyReceived,
        received_at: receipt?.received_at || null,
        received_by: receipt?.received_by || null,
        supplier: receipt?.supplier || null,
      });
    }

    return enrichedParts;
  } finally {
    client.release();
  }
};

exports.requestProjectProcurement = async (projectId, userId) => {
  const requiredParts = await exports.getProjectRequiredParts(projectId);
  if (requiredParts === null) {
    throw new AppError('Project not found', 404);
  }

  const purchaseItems = requiredParts.filter((part) => part.needs_purchase);
  if (purchaseItems.length === 0) {
    return {
      required_parts: requiredParts,
      purchase_items: [],
      requested_at: new Date(),
      message: 'No procurement required for this project.',
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'UPDATE',
        'project',
        projectId,
        JSON.stringify({
          procurement_requested: true,
          purchase_count: purchaseItems.length,
          requested_at: new Date().toISOString(),
        }),
      ]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    required_parts: requiredParts,
    purchase_items: purchaseItems,
    requested_at: new Date(),
  };
};

exports.receiveProjectRequiredPart = async (projectId, partKey, payload = {}, userId) => {
  const requiredParts = await exports.getProjectRequiredParts(projectId);
  if (requiredParts === null) {
    throw new AppError('Project not found', 404);
  }

  const part = requiredParts.find((candidate) => candidate.part_key === partKey);
  if (!part) {
    throw new AppError('Required part not found', 404);
  }

  const receivedQuantity = Math.max(1, Number(payload.quantity) || Number(part.quantity) || 1);

  if (part.product_id) {
    await inventoryService.deductStock(part.product_id, receivedQuantity, {
      notes: `Project required part received for ${part.name}`,
      createdBy: userId,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'project_part_received',
        'project',
        projectId,
        JSON.stringify({
          part_key: part.part_key,
          part_name: part.name,
          quantity: Number(receivedQuantity),
          received_quantity: Number(receivedQuantity),
          received_at: new Date().toISOString(),
          received_by: userId,
          supplier: null,
          product_id: part.product_id || null,
        }),
      ]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const refreshedParts = await exports.getProjectRequiredParts(projectId);
  const refreshedPart = refreshedParts.find((candidate) => candidate.part_key === partKey);
  const allPartsReceived = refreshedParts.every((candidate) => candidate.is_fully_received);

  if (allPartsReceived) {
    const currentProjectRes = await pool.query(
      `SELECT status, progress FROM projects WHERE project_id = $1`,
      [projectId]
    );

    if (currentProjectRes.rows.length > 0) {
      const currentProject = currentProjectRes.rows[0];
      const nextStatus = normalizeProjectStatus(currentProject.status) === 'completed' ? 'completed' : 'in_progress';
      await pool.query(
        `UPDATE projects
         SET status = $1,
             progress = GREATEST(COALESCE(progress, 0), 100),
             updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $2`,
        [nextStatus, projectId]
      );

      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'project_ready_for_assembly',
          'project',
          projectId,
          JSON.stringify({
            all_parts_received: true,
            status: nextStatus,
            received_at: new Date().toISOString(),
          }),
        ]
      );
    }
  }

  return {
    part: refreshedPart || part,
    quantity_received: Number(receivedQuantity),
    stock_updated: Boolean(part.product_id),
    all_parts_received: allPartsReceived,
  };
};

exports.toggleProjectRequiredPart = async (projectId, partKey, received, userId) => {
  const requiredParts = await exports.getProjectRequiredParts(projectId);
  if (requiredParts === null) {
    throw new AppError('Project not found', 404);
  }

  const part = requiredParts.find((candidate) => candidate.part_key === partKey);
  if (!part) {
    throw new AppError('Required part not found', 404);
  }

  const quantity = Number(part.quantity) || 1;

  if (received) {
    if (part.product_id) {
      await inventoryService.deductStock(part.product_id, quantity, {
        notes: `Project required part received for ${part.name}`,
        createdBy: userId,
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'project_part_received',
          'project',
          projectId,
          JSON.stringify({
            part_key: part.part_key,
            part_name: part.name,
            quantity,
            received_quantity: quantity,
            received_at: new Date().toISOString(),
            received_by: userId,
            supplier: null,
            product_id: part.product_id || null,
          }),
        ]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    const projectRes = await pool.query(
      `SELECT progress, status FROM projects WHERE project_id = $1`,
      [projectId]
    );
    const projectProgress = Number(projectRes.rows[0]?.progress || 0);
    const projectStatus = projectRes.rows[0]?.status || '';

    if (projectProgress >= 100 || normalizeProjectStatus(projectStatus) === 'completed') {
      throw new AppError('Cannot uncheck part: project has already progressed beyond the stage that consumes this part.', 400);
    }

    if (part.product_id) {
      await inventoryService.addStock(part.product_id, quantity, {
        notes: `Project required part unchecked for ${part.name}`,
        createdBy: userId,
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'project_part_unreceived',
          'project',
          projectId,
          JSON.stringify({
            part_key: part.part_key,
            part_name: part.name,
            quantity,
            received_quantity: -quantity,
            received_at: null,
            received_by: null,
            supplier: null,
            product_id: part.product_id || null,
          }),
        ]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const refreshedParts = await exports.getProjectRequiredParts(projectId);
  const refreshedPart = refreshedParts.find((candidate) => candidate.part_key === partKey);

  return {
    part: refreshedPart || part,
    received,
    stock_updated: Boolean(part.product_id),
  };
};

exports.getProjectHierarchy = async (projectId) => {
  await ensureProjectArchiveColumns();
  const client = await pool.connect();
  try {
    const pResult = await client.query(
      `${PROJECT_BASE_SELECT}
       WHERE p.project_id = $1
         AND p.deleted_at IS NULL`,
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
    project.required_parts = customizationResult.rows.flatMap((customization) => buildRequiredPartsPayload(
      customization,
      linkedParts.filter((part) => part.customization_id === customization.customization_id)
    ));

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
         AND p.deleted_at IS NULL`,
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

const ensureProjectHoldCancelColumns = async () => {
  try {
    // Always ensure 'on_hold' is a valid value in the project_status_enum
    await pool.query(`ALTER TYPE project_status_enum ADD VALUE IF NOT EXISTS 'on_hold'`).catch(() => {});
    // Ensure audit_logs action check constraint allows hold/cancel related actions
    await pool.query(`
      ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
        CHECK (action IN (
          'project_claimed', 'project_unclaimed', 'project_reassigned', 'project_cancelled',
          'project_resumed', 'build_released',
          'hold_requested', 'hold_approved', 'hold_rejected',
          'cancel_requested', 'cancel_approved', 'cancel_rejected',
          'milestone_created', 'milestone_updated', 'milestone_deleted',
          'subtask_created', 'subtask_deleted', 'subtask_status_changed',
          'fulfillment_updated',
          'refund_requested', 'refund_approved', 'refund_rejected',
          'refund_processing', 'refund_refunded'
        ));
    `).catch(() => {});
    // Check if hold_reason column exists, if not add all hold/cancel columns
    const checkRes = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'projects'
         AND table_schema = current_schema()
         AND column_name = 'hold_reason'`
    );
    if (checkRes.rows.length === 0) {
      await pool.query(`ALTER TABLE projects ADD COLUMN hold_reason TEXT`);
      await pool.query(`ALTER TABLE projects ADD COLUMN hold_option VARCHAR(50) CHECK (hold_option IS NULL OR hold_option IN ('resume_later', 'hold_before_next_step'))`);
      await pool.query(`ALTER TABLE projects ADD COLUMN hold_at_step VARCHAR(200)`);
      await pool.query(`ALTER TABLE projects ADD COLUMN hold_requested_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE projects ADD COLUMN hold_approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL`);
      await pool.query(`ALTER TABLE projects ADD COLUMN hold_approved_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE projects ADD COLUMN resumed_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE projects ADD COLUMN cancel_option VARCHAR(50) CHECK (cancel_option IS NULL OR cancel_option IN ('ship_unfinished', 'pickup_unfinished'))`);
      await pool.query(`ALTER TABLE projects ADD COLUMN cancel_reason TEXT`);
      await pool.query(`ALTER TABLE projects ADD COLUMN cancel_requested_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE projects ADD COLUMN cancel_approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL`);
      await pool.query(`ALTER TABLE projects ADD COLUMN cancel_approved_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE projects ADD COLUMN shipped_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE projects ADD COLUMN ready_for_pickup_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE projects ADD COLUMN picked_up_at TIMESTAMPTZ`);
      console.log('Added hold/cancel columns to projects table');
    }
  } catch (err) {
    console.warn('Could not add hold/cancel columns:', err.message);
  }
};

let holdCancelColumnsEnsured = false;

const ensureSubtaskStatusConstraint = async () => {
  try {
    // Widen the CHECK constraint to include 'in_progress'
    await pool.query(`
      ALTER TABLE project_subtasks DROP CONSTRAINT IF EXISTS project_subtasks_status_check;
    `);
    await pool.query(`
      ALTER TABLE project_subtasks ADD CONSTRAINT project_subtasks_status_check 
        CHECK (status IN ('pending', 'in_progress', 'completed'));
    `);
  } catch (err) {
    // Constraint may already exist or not exist, that's fine
    console.warn('Could not update subtask constraint:', err.message);
  }
};

let subtaskConstraintEnsured = false;

exports.updateSubtaskStatus = async (subtaskId, data, userId, userRole) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Ensure the subtask status constraint allows 'in_progress'
    if (!subtaskConstraintEnsured) {
      await ensureSubtaskStatusConstraint();
      subtaskConstraintEnsured = true;
    }
    const sRes = await client.query(`
      SELECT s.*, m.project_id, m.order_index AS milestone_order, m.title AS milestone_title
      FROM project_subtasks s
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

    // --- SEQUENTIAL PROGRESSION CHECK ---
    if (status === 'completed' && subtask.status !== 'completed') {
      // Ensure hold/cancel columns exist before querying them
      if (!holdCancelColumnsEnsured) {
        await ensureProjectHoldCancelColumns();
        holdCancelColumnsEnsured = true;
      }
      // Check if this project is on hold
      const projectRes = await client.query(
        `SELECT status, hold_reason FROM projects WHERE project_id = $1`,
        [subtask.project_id]
      );
      if (projectRes.rows.length > 0) {
        const projectStatus = normalizeProjectStatus(projectRes.rows[0].status);
        if (projectStatus === 'on_hold') {
          throw new Error('Cannot update tasks while the project is on hold');
        }
        if (projectStatus === 'cancelled') {
          throw new Error('Project is cancelled. No further updates allowed');
        }
      }

      // Check if previous milestones are all completed (sequential progression)
      const prevMilestones = await client.query(
        `SELECT m.milestone_id, m.status, m.order_index,
                (SELECT COUNT(*) FROM project_subtasks ps WHERE ps.milestone_id = m.milestone_id AND ps.status != 'completed') AS pending_subtasks
         FROM project_milestones m
         WHERE m.project_id = $1 AND m.order_index < $2
         ORDER BY m.order_index ASC`,
        [subtask.project_id, subtask.milestone_order]
      );

      for (const prevMilestone of prevMilestones.rows) {
        const pendingCount = parseInt(prevMilestone.pending_subtasks);
        if (pendingCount > 0) {
          throw new Error(
            `Cannot proceed to "${subtask.milestone_title}" yet. ` +
            `All tasks in "${prevMilestone.title}" must be completed first. ` +
            `(${pendingCount} task${pendingCount > 1 ? 's' : ''} remaining)`
          );
        }
      }

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

    // Update project progress tracking
    const projectData = await client.query(`SELECT * FROM projects WHERE project_id = $1`, [subtask.project_id]);
    if (projectData.rows.length > 0) {
      const stats = await getProjectTaskStats(client, subtask.project_id);
      await applyProjectTaskTracking(client, projectData.rows[0], { stats, persist: true });
    }

    // Sync the latest fully-completed build stage so the snapshot survives
    // status changes (including cancellation).
    await syncLastCompletedStage(client, subtask.project_id);

    if (status && status !== subtask.status) {
      await logActivity(client, subtask.project_id, userId, 'subtask_status_changed', { title: subtask.title, status });
    }

    // ─── BUILD PROJECT → MY PURCHASES TRANSITION ─────────────────────────────
    // When "Ready for Release" subtask is completed, automatically transition the
    // associated order from Build Projects to My Purchases with "To Ship" status
    // (or "Ready for Pickup" if the project has a pickup appointment).
    if (
      status === 'completed' &&
      subtask.status !== 'completed' &&
      subtask.title &&
      String(subtask.title).trim().toLowerCase() === 'ready for release'
    ) {
      // Fetch the project to determine fulfillment method
      const projectData = await client.query(
        `SELECT p.*, o.status AS order_status, o.fulfillment_method
         FROM projects p
         JOIN orders o ON o.order_id = p.order_id
         WHERE p.project_id = $1`,
        [subtask.project_id]
      );

      if (projectData.rows.length > 0) {
        const project = projectData.rows[0];
        const isPickup = String(project.fulfillment_method || '').trim() === 'pickup_appointment';

        // Update the order status to transition it into My Purchases
        // "processing" = "To Ship" in the My Purchase tab
        // For pickup orders, we also set it to "processing" – the existing fulfillment
        // workflow handles the pickup-specific status on top of this.
        const newOrderStatus = isPickup ? 'processing' : 'processing';
        await client.query(
          `UPDATE orders
           SET status = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE order_id = $2
             AND status NOT IN ('cancelled', 'delivered')`,
          [newOrderStatus, project.order_id]
        );

        // Update the project status to 'completed' to reflect release
        await client.query(
          `UPDATE projects
           SET status = 'completed',
               updated_at = CURRENT_TIMESTAMP
           WHERE project_id = $1`,
          [subtask.project_id]
        );

        // Log the release activity
        await logActivity(
          client,
          subtask.project_id,
          userId,
          'build_released',
          {
            order_id: project.order_id,
            new_order_status: newOrderStatus,
            fulfillment_method: project.fulfillment_method,
            is_pickup: isPickup,
          }
        );
      }
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

exports.getSubtaskById = async (subtaskId) => {
  const res = await pool.query(`
    SELECT s.*, u.first_name as assignee_first, u.last_name as assignee_last,
           m.project_id, m.title as milestone_title, m.order_index as milestone_order
    FROM project_subtasks s
    LEFT JOIN users u ON s.assigned_user_id = u.user_id
    JOIN project_milestones m ON s.milestone_id = m.milestone_id
    WHERE s.subtask_id = $1
  `, [subtaskId]);
  return res.rows[0] || null;
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
    FROM audit_logs l
    LEFT JOIN users u ON l.user_id = u.user_id
    WHERE l.entity_type = 'project' AND l.entity_id = $1
    ORDER BY l.created_at DESC
  `, [projectId]);
  return res.rows;
};

// ─── CLAIM / UNCLAIM / REASSIGN ─────────────────────────────────────────────

const ensureClaimColumns = async () => {
  const checkRes = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'projects'
       AND table_schema = current_schema()
       AND column_name IN ('claimed_by', 'claimed_at')`
  );
  const existing = new Set(checkRes.rows.map((row) => row.column_name));
  if (!existing.has('claimed_by')) {
    await pool.query(`ALTER TABLE projects ADD COLUMN claimed_by UUID REFERENCES users(user_id) ON DELETE SET NULL`);
  }
  if (!existing.has('claimed_at')) {
    await pool.query(`ALTER TABLE projects ADD COLUMN claimed_at TIMESTAMPTZ`);
  }
};

const MANUFACTURING_WORKFLOW = [
  {
    title: 'Body',
    order_index: 1,
    subtasks: [
      'Shape Carving',
      'Pickup Cavity',
      'Electronics Cavity',
      'Neck Pocket',
    ],
  },
  {
    title: 'Neck',
    order_index: 2,
    subtasks: [
      'Shape Carving',
      'Installation of Frets',
      'Tuning Peg Holes',
    ],
  },
  {
    title: 'Parts Fitting',
    order_index: 3,
    subtasks: [],
  },
  {
    title: 'Paint Processing, Buffing & Polishing',
    order_index: 4,
    subtasks: [
      'Sanding',
      'Primer',
      'Base Color',
      'Top Coat',
      'Buffing',
      'Polishing',
    ],
  },
  {
    title: 'Assembly & Setup',
    order_index: 5,
    subtasks: [],
  },
  {
    title: 'Release',
    order_index: 6,
    subtasks: [
      'Final Quality Inspection',
      'Ready for Release',
      'Delivered',
    ],
  },
];

/**
 * Initialize the manufacturing workflow milestones and subtasks for a project.
 * Only runs if no milestones exist yet. Uses the database-driven default workflow.
 */
exports.initializeManufacturingWorkflow = async (projectId, userId) => {
  await ensureClaimColumns();
  return defaultWorkflowService.applyDefaultWorkflowToProject(projectId, userId);
};

/**
 * Claim a project:
 * - Staff and Admins can claim
 * - Auto-assigns the user as claimed_by
 * - Changes status from 'not_started' to 'in_progress'
 * - Only one user can claim at a time (must not already be claimed)
 * - Initializes manufacturing workflow if not yet initialized
 */
exports.claimProject = async (projectId, userId, userRole) => {
  await ensureClaimColumns();
  
  if (!['staff', 'admin', 'super_admin'].includes(userRole)) {
    throw new AppError('Only staff and admins can claim projects', 403);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch project
    const pRes = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
    const project = pRes.rows[0];

    // Check if already claimed
    if (project.claimed_by) {
      // Get claimer info
      const claimerRes = await client.query(
        `SELECT first_name, last_name FROM users WHERE user_id = $1`,
        [project.claimed_by]
      );
      const claimerName = claimerRes.rows[0]
        ? `${claimerRes.rows[0].first_name} ${claimerRes.rows[0].last_name}`
        : 'another user';
      throw new AppError(`This project is already claimed by ${claimerName}`, 409);
    }

    // Check project status - only allow claiming not_started projects
    const normalizedStatus = normalizeProjectStatus(project.status);
    if (normalizedStatus !== 'not_started' && normalizedStatus !== 'in_progress') {
      throw new AppError(`Cannot claim a project with status: ${project.status}`, 400);
    }

    // Update project: set claimed_by, claimed_at, change status to in_progress
    await client.query(
      `UPDATE projects
       SET claimed_by = $1,
           claimed_at = CURRENT_TIMESTAMP,
           status = 'in_progress',
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $2`,
      [userId, projectId]
    );

    // Initialize workflow if not yet done (use database-driven defaults)
    const existing = await client.query(
      'SELECT COUNT(*) FROM project_milestones WHERE project_id = $1',
      [projectId]
    );

    if (parseInt(existing.rows[0].count) === 0) {
      await defaultWorkflowService.applyDefaultWorkflowToProject(projectId, userId);
    }

    await logActivity(client, projectId, userId, 'project_claimed', {
      claimed_by: userId,
    });

    await client.query('COMMIT');

    // Return updated project
    const updated = await exports.getProjectById(projectId);
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Unclaim a project (admin feature):
 * - Removes claimed_by and claimed_at
 * - Reverts status to 'not_started' 
 * - Keeps workflow intact
 */
exports.unclaimProject = async (projectId, userId, userRole) => {
  await ensureClaimColumns();

  if (!['admin', 'super_admin'].includes(userRole)) {
    throw new AppError('Only admins can unclaim projects', 403);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
    const project = pRes.rows[0];

    if (!project.claimed_by) {
      throw new AppError('Project is not claimed by anyone', 400);
    }

    // Reset claimed fields and revert status
    await client.query(
      `UPDATE projects
       SET claimed_by = NULL,
           claimed_at = NULL,
           status = 'not_started',
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $1`,
      [projectId]
    );

    await logActivity(client, projectId, userId, 'project_unclaimed', {
      previous_claimed_by: project.claimed_by,
    });

    await client.query('COMMIT');

    const updated = await exports.getProjectById(projectId);
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Reassign a project to another user (admin feature).
 */
exports.reassignProject = async (projectId, newUserId, currentUserId, userRole) => {
  await ensureClaimColumns();

  if (!['admin', 'super_admin'].includes(userRole)) {
    throw new AppError('Only admins can reassign projects', 403);
  }

  // Validate new user exists and is staff/admin
  const newUserRes = await pool.query(
    `SELECT user_id, first_name, last_name, role FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
    [newUserId]
  );
  if (newUserRes.rows.length === 0) throw new AppError('User not found', 404);
  const newUser = newUserRes.rows[0];
  if (!['staff', 'admin', 'super_admin'].includes(newUser.role)) {
    throw new AppError('Can only reassign to staff or admin users', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
    const project = pRes.rows[0];

    const previousClaimedBy = project.claimed_by;

    // Update claim
    await client.query(
      `UPDATE projects
       SET claimed_by = $1,
           claimed_at = CURRENT_TIMESTAMP,
           status = 'in_progress',
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $2`,
      [newUserId, projectId]
    );

    await logActivity(client, projectId, currentUserId, 'project_reassigned', {
      from: previousClaimedBy,
      to: newUserId,
      to_name: `${newUser.first_name} ${newUser.last_name}`,
    });

    await client.query('COMMIT');

    const updated = await exports.getProjectById(projectId);
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get all staff with their currently claimed projects for admin monitoring.
 */
exports.getStaffClaimStatus = async () => {
  const res = await pool.query(`
    SELECT 
      u.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      u.is_active,
      json_agg(
        json_build_object(
          'project_id', p.project_id,
          'title', p.title,
          'status', p.status,
          'progress', p.progress,
          'claimed_at', p.claimed_at,
          'order_number', o.order_number
        )
        ORDER BY p.claimed_at DESC
      ) FILTER (WHERE p.project_id IS NOT NULL) AS claimed_projects
    FROM users u
    LEFT JOIN projects p ON p.claimed_by = u.user_id AND p.deleted_at IS NULL
    LEFT JOIN orders o ON o.order_id = p.order_id
    WHERE u.role IN ('staff', 'admin', 'super_admin')
      AND u.deleted_at IS NULL
    GROUP BY u.user_id, u.first_name, u.last_name, u.email, u.role, u.is_active
    ORDER BY u.first_name ASC
  `);
  return res.rows;
};

// ─── HOLD / RESUME ────────────────────────────────────────────────────────────

/**
 * Customer requests a hold on their project.
 * @param {string} projectId
 * @param {string} userId
 * @param {string} userRole
 * @param {object} data - { reason, hold_option: 'resume_later'|'hold_before_next_step' }
 */
exports.requestProjectHold = async (projectId, userId, userRole, data = {}) => {
  await ensureProjectHoldCancelColumns();
  await ensureClaimColumns();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `${PROJECT_BASE_SELECT} WHERE p.project_id = $1 AND p.deleted_at IS NULL`,
      [projectId]
    );
    if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
    const project = pRes.rows[0];

    const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
    if (!isPrivileged && project.customer_id !== userId) {
      throw new AppError('You do not have access to this project', 403);
    }

    const normalizedStatus = normalizeProjectStatus(project.status);
    if (normalizedStatus === 'cancelled') throw new AppError('Project is already cancelled', 400);
    if (normalizedStatus === 'completed') throw new AppError('Project is already completed', 400);
    if (normalizedStatus === 'on_hold') throw new AppError('Project is already on hold', 400);

    const holdOption = data.hold_option || 'resume_later';
    if (!['resume_later', 'hold_before_next_step'].includes(holdOption)) {
      throw new AppError('Invalid hold option', 400);
    }

    // Find the current build step for reference
    let currentStepName = null;
    const milestones = await client.query(
      `SELECT * FROM project_milestones WHERE project_id = $1 AND status != 'completed' ORDER BY order_index ASC LIMIT 1`,
      [projectId]
    );
    if (milestones.rows.length > 0) {
      currentStepName = milestones.rows[0].title;
    }

    await client.query(
      `UPDATE projects
       SET hold_reason = $1,
           hold_option = $2,
           hold_at_step = $3,
           hold_requested_at = CURRENT_TIMESTAMP,
           status = 'on_hold',
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $4`,
      [data.reason || 'Customer requested hold', holdOption, currentStepName, projectId]
    );

    await logActivity(client, projectId, userId, 'hold_requested', {
      reason: data.reason,
      hold_option: holdOption,
      current_step: currentStepName,
    });

    await client.query('COMMIT');

    const updated = await exports.getProjectById(projectId);
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin approves (or rejects) a hold request.
 */
exports.approveProjectHold = async (projectId, userId, data = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
    const project = pRes.rows[0];

    if (!project.hold_reason) {
      throw new AppError('No hold request exists for this project', 400);
    }

    const action = data.action || 'approve'; // 'approve' or 'reject'

    if (action === 'reject') {
      // Reject the hold - clear hold request and revert status
      await client.query(
        `UPDATE projects
         SET hold_reason = NULL,
             hold_option = NULL,
             hold_at_step = NULL,
             hold_requested_at = NULL,
             hold_approved_by = NULL,
             hold_approved_at = NULL,
             status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $2`,
        [project.status || 'in_progress', projectId]
      );

      await logActivity(client, projectId, userId, 'hold_rejected', {
        reason: data.rejection_reason || 'Rejected by admin',
      });
    } else {
      // Approve the hold
      await client.query(
        `UPDATE projects
         SET hold_approved_by = $1,
             hold_approved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $2`,
        [userId, projectId]
      );

      await logActivity(client, projectId, userId, 'hold_approved', {
        hold_option: project.hold_option,
        hold_at_step: project.hold_at_step,
        reason: project.hold_reason,
      });
    }

    await client.query('COMMIT');

    const updated = await exports.getProjectById(projectId);
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Resume a held project (admin or customer who owns the project).
 */
exports.resumeProject = async (projectId, userId, userRole) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
    const project = pRes.rows[0];

    // Get the customer_id from the order
    const orderRes = await client.query(
      `SELECT user_id FROM orders WHERE order_id = $1`,
      [project.order_id]
    );
    const customerId = orderRes.rows.length > 0 ? orderRes.rows[0].user_id : null;

    const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
    const isOwner = customerId === userId;

    if (!isPrivileged && !isOwner) {
      throw new AppError('You do not have access to this project', 403);
    }

    const normalizedStatus = normalizeProjectStatus(project.status);
    if (normalizedStatus !== 'on_hold') {
      throw new AppError('Project is not on hold', 400);
    }

    await client.query(
      `UPDATE projects
       SET status = 'in_progress',
           hold_reason = NULL,
           hold_option = NULL,
           hold_at_step = NULL,
           hold_requested_at = NULL,
           hold_approved_by = NULL,
           hold_approved_at = NULL,
           resumed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $1`,
      [projectId]
    );

    await logActivity(client, projectId, userId, 'project_resumed', {
      previous_hold_reason: project.hold_reason,
      resumed_at: new Date(),
    });

    await client.query('COMMIT');

    const updated = await exports.getProjectById(projectId);
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── CANCEL WITH OPTIONS ─────────────────────────────────────────────────────

/**
 * Customer requests cancellation with a specific option.
 * @param {string} projectId
 * @param {string} userId
 * @param {string} userRole
 * @param {object} data - { cancel_option: 'ship_unfinished'|'pickup_unfinished', cancel_reason }
 */
exports.requestProjectCancel = async (projectId, userId, userRole, data = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `${PROJECT_BASE_SELECT} WHERE p.project_id = $1 AND p.deleted_at IS NULL`,
      [projectId]
    );
    if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
    const project = pRes.rows[0];

    const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
    if (!isPrivileged && project.customer_id !== userId) {
      throw new AppError('You do not have access to this project', 403);
    }

    const normalizedStatus = normalizeProjectStatus(project.status);
    if (normalizedStatus === 'cancelled') throw new AppError('Project is already cancelled', 400);
    if (normalizedStatus === 'completed') throw new AppError('Project is already completed', 400);

    const cancelOption = data.cancel_option;
    if (!['ship_unfinished', 'pickup_unfinished'].includes(cancelOption)) {
      throw new AppError('Invalid cancellation option. Choose ship_unfinished or pickup_unfinished', 400);
    }

    await client.query(
      `UPDATE projects
       SET cancel_option = $1,
           cancel_reason = $2,
           cancel_requested_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $3`,
      [cancelOption, data.cancel_reason || 'Customer requested cancellation', projectId]
    );

    await logActivity(client, projectId, userId, 'cancel_requested', {
      cancel_option: cancelOption,
      cancel_reason: data.cancel_reason,
    });

    await client.query('COMMIT');

    const updated = await exports.getProjectById(projectId);
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin approves (or rejects) a cancellation request.
 */
exports.approveProjectCancel = async (projectId, userId, data = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `${PROJECT_BASE_SELECT} WHERE p.project_id = $1 AND p.deleted_at IS NULL`,
      [projectId]
    );
    if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
    const project = pRes.rows[0];

    if (!project.cancel_option || !project.cancel_reason) {
      throw new AppError('No cancellation request exists for this project', 400);
    }

    const action = data.action || 'approve';

    if (action === 'reject') {
      // Reject cancellation - clear cancel request
      await client.query(
        `UPDATE projects
         SET cancel_option = NULL,
             cancel_reason = NULL,
             cancel_requested_at = NULL,
             cancel_approved_by = NULL,
             cancel_approved_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $1`,
        [projectId]
      );

      await logActivity(client, projectId, userId, 'cancel_rejected', {
        rejection_reason: data.rejection_reason || 'Rejected by admin',
        previous_cancel_option: project.cancel_option,
      });
    } else {
      // Approve cancellation
      const cancelOption = project.cancel_option;
      let fulfillmentStatus = 'cancelled';

      if (cancelOption === 'ship_unfinished') {
        fulfillmentStatus = 'shipped_unfinished';
        await client.query(
          `UPDATE projects
           SET status = 'cancelled',
               cancel_approved_by = $1,
               cancel_approved_at = CURRENT_TIMESTAMP,
               shipped_at = CURRENT_TIMESTAMP,
               fulfillment_status = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE project_id = $3`,
          [userId, fulfillmentStatus, projectId]
        );
      } else if (cancelOption === 'pickup_unfinished') {
        fulfillmentStatus = 'awaiting_pickup_unfinished';
        await client.query(
          `UPDATE projects
           SET status = 'cancelled',
               cancel_approved_by = $1,
               cancel_approved_at = CURRENT_TIMESTAMP,
               ready_for_pickup_at = CURRENT_TIMESTAMP,
               fulfillment_status = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE project_id = $3`,
          [userId, fulfillmentStatus, projectId]
        );
      }

      // Cancel the order as well
      await client.query(
        `UPDATE orders
         SET status = 'cancelled',
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1 AND status <> 'cancelled'`,
        [project.order_id]
      );

      // Freeze the latest completed build stage so the customer-entitled
      // stage survives the status change to cancelled and is shown forever.
      await syncLastCompletedStage(client, projectId);
      await snapshotCancelledStage(client, projectId);

      await logActivity(client, projectId, userId, 'cancel_approved', {
        cancel_option: cancelOption,
        cancel_reason: project.cancel_reason,
        fulfillment_status: fulfillmentStatus,
      });
    }

    await client.query('COMMIT');

    const updated = await exports.getProjectById(projectId);
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── INSTALLMENT SCHEDULE ─────────────────────────────────────────────────────

let ensureInstallmentTableReady = false;
let ensureInstallmentTablePromise = null;

/**
 * Ensure the project_installment_schedules table exists.
 * This is a safety net in case the migration hasn't been run.
 */
const ensureInstallmentTable = async () => {
  if (ensureInstallmentTableReady) return;
  if (ensureInstallmentTablePromise) return ensureInstallmentTablePromise;

  ensureInstallmentTablePromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_installment_schedules (
          schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
          installment_number INT NOT NULL CHECK (installment_number > 0),
          amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
          due_date DATE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
          paid_at TIMESTAMPTZ,
          payment_id UUID REFERENCES payments(payment_id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(project_id, installment_number)
        );
      `);
      ensureInstallmentTableReady = true;
    } catch (err) {
      // Table might already exist, that's fine
      console.warn('Could not create installment table (may already exist):', err.message);
      ensureInstallmentTableReady = true;
    }
  })();

  return ensureInstallmentTablePromise;
};

/**
 * Get installment schedule for a project.
 */
exports.getInstallmentSchedule = async (projectId, userId, userRole) => {
  await ensureInstallmentTable();

  const pRes = await pool.query(
    `${PROJECT_BASE_SELECT} WHERE p.project_id = $1 AND p.deleted_at IS NULL`,
    [projectId]
  );
  if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
  const project = pRes.rows[0];

  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
  if (!isPrivileged && project.customer_id !== userId) {
    throw new AppError('You do not have access to this project', 403);
  }

  // Get installment schedules
  const scheduleRes = await pool.query(
    `SELECT * FROM project_installment_schedules
     WHERE project_id = $1
     ORDER BY installment_number ASC`,
    [projectId]
  );

  const installments = scheduleRes.rows;

  // If no installments stored yet, compute from order data
  if (installments.length === 0) {
    const orderRes = await pool.query(
      `SELECT total_amount, payment_status, payment_plan, initial_payment_amount, monthly_installment_amount, installment_tenure_months FROM orders WHERE order_id = $1`,
      [project.order_id]
    );
    const order = orderRes.rows[0];
    if (!order) return { installments: [], summary: null, payment_plan: null };

    const totalAmount = Number(order.total_amount) || 0;

    // Determine if this is an installment plan using the same logic as installmentService.js
    // Check: payment_plan field, OR presence of installment data fields
    const hasInstallmentData = Number(order.initial_payment_amount || 0) > 0 || Number(order.monthly_installment_amount || 0) > 0;
    const isInstallmentPlan = order.payment_plan === 'installment' || hasInstallmentData;

    // If the order is full payment (not installment), show the "You paid it in Full Payment" message
    if (!isInstallmentPlan) {
      return {
        installments: [],
        summary: null,
        payment_plan: 'full_payment',
      };
    }

    const monthlyRate = 0.03; // 3% monthly interest (configurable)
    const tenureMonths = 6; // Default 6 months (configurable)

    // Simple installment calculation
    const monthlyPayment = Math.round((totalAmount * (1 + monthlyRate)) / tenureMonths);
    const remainingBalance = totalAmount;
    const today = new Date();

    // Calculate next due date as exactly 1 month from today
    const nextDueDate = new Date(today);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    return {
      installments: [],
      summary: {
        total_amount: totalAmount,
        monthly_payment: monthlyPayment,
        remaining_balance: remainingBalance,
        total_months: tenureMonths,
        remaining_months: tenureMonths,
        paid_count: 0,
        paid_amount: 0,
        next_due_date: nextDueDate.toISOString(),
        interest_rate: monthlyRate,
        last_updated: null,
      },
      payment_plan: 'installment',
    };
  }

  // Calculate summary from actual installment records
  const totalAmount = installments.reduce((sum, inst) => sum + Number(inst.amount), 0);
  const paidCount = installments.filter((inst) => inst.status === 'paid').length;
  const totalCount = installments.length;
  const paidAmount = installments
    .filter((inst) => inst.status === 'paid')
    .reduce((sum, inst) => sum + Number(inst.amount), 0);
  const remainingBalance = totalAmount - paidAmount;
  const remainingMonths = totalCount - paidCount;

  // Find the next unpaid installment
  const nextUnpaid = installments.find((inst) => inst.status === 'pending' || inst.status === 'overdue');

  // Get the latest updated_at from all installments
  const lastUpdated = installments.reduce((latest, inst) => {
    const updated = inst.updated_at || inst.created_at;
    return updated && (!latest || new Date(updated) > new Date(latest)) ? updated : latest;
  }, null);

  return {
    installments,
    payment_plan: 'installment',
    summary: {
      total_amount: totalAmount,
      monthly_payment: installments[0]?.amount || 0,
      remaining_balance: remainingBalance,
      total_months: totalCount,
      remaining_months: remainingMonths,
      next_due_date: nextUnpaid?.due_date || null,
      paid_amount: paidAmount,
      paid_count: paidCount,
      last_updated: lastUpdated,
    },
  };
};
