const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('./notificationService');

// ─── TABLE ENSURANCE ──────────────────────────────────────────────────────────

let tableReady = false;
let tableReadyPromise = null;

const ensureCurrentBuildClaimsTable = async () => {
  if (tableReady) return;
  if (tableReadyPromise) return tableReadyPromise;

  tableReadyPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS current_build_claims (
          claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
          customer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

          -- Progress snapshot at cancellation
          progress_at_cancellation SMALLINT NOT NULL DEFAULT 0,
          current_build_stage VARCHAR(255),
          build_state_snapshot JSONB,

          -- Financial
          amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
          estimated_build_value NUMERIC(12, 2) NOT NULL DEFAULT 0,

          -- Claim method
          claim_method VARCHAR(30) CHECK (claim_method IS NULL OR claim_method IN ('courier', 'pickup')),
          claim_status VARCHAR(50) NOT NULL DEFAULT 'pending_customer_selection'
            CHECK (claim_status IN (
              'not_required',
              'pending_customer_selection',
              'pending_admin_confirmation',
              'ready_for_delivery',
              'courier_arranged',
              'out_for_delivery',
              'ready_for_pickup',
              'picked_up',
              'delivered',
              'received'
            )),

          -- Delivery info (courier)
          delivery_address JSONB,
          recipient_name VARCHAR(200),
          recipient_contact VARCHAR(50),
          delivery_instructions TEXT,
          courier_service VARCHAR(100),
          courier_reference VARCHAR(100),
          delivery_fee NUMERIC(12, 2),
          estimated_delivery_date DATE,

          -- Pickup info
          pickup_location TEXT,
          pickup_instructions TEXT,
          pickup_schedule TIMESTAMPTZ,
          pickup_contact VARCHAR(200),

          -- Admin confirmation
          admin_confirmed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
          admin_confirmed_at TIMESTAMPTZ,
          admin_confirmation_notes TEXT,

          -- Photos (JSONB array of URLs)
          current_state_photos JSONB DEFAULT '[]',

          -- Receipt
          received_at TIMESTAMPTZ,
          received_confirmed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
          pickup_staff_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
          pickup_proof_photo TEXT,

          -- Audit
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          deleted_at TIMESTAMPTZ
        )
      `);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_current_build_claims_project_id ON current_build_claims(project_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_current_build_claims_customer_id ON current_build_claims(customer_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_current_build_claims_order_id ON current_build_claims(order_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_current_build_claims_claim_status ON current_build_claims(claim_status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_current_build_claims_created_at ON current_build_claims(created_at DESC)`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_current_build_claims_unique_project ON current_build_claims(project_id) WHERE deleted_at IS NULL`);

      tableReady = true;
    } catch (err) {
      if (err.code === '42P07' || err.code === '42710') {
        tableReady = true;
      } else {
        tableReadyPromise = null;
        throw err;
      }
    }
  })();

  return tableReadyPromise;
};

// ─── STATUS TRANSITIONS ───────────────────────────────────────────────────────

const CLAIM_STATUS_TRANSITIONS = {
  pending_customer_selection: ['pending_admin_confirmation'],
  pending_admin_confirmation: ['ready_for_delivery', 'ready_for_pickup'],
  ready_for_delivery: ['courier_arranged'],
  courier_arranged: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['received'],
  ready_for_pickup: ['picked_up'],
  picked_up: ['received'],
  received: [],
  not_required: [],
};

const isValidTransition = (from, to) => {
  const allowed = CLAIM_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const logClaimActivity = async (db, projectId, userId, action, details = {}) => {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, 'project', projectId, JSON.stringify(details)]
  );
};

/**
 * Build a structured build-state from the project's milestones and subtasks.
 * This is the backend source of truth — the frontend must not invent states.
 */
const buildStateFromMilestones = async (db, projectId) => {
  const milestonesRes = await db.query(
    `SELECT m.milestone_id, m.title, m.order_index, m.status AS milestone_status
     FROM project_milestones m
     WHERE m.project_id = $1 AND m.deleted_at IS NULL
     ORDER BY m.order_index ASC, m.created_at ASC`,
    [projectId]
  );

  const milestones = milestonesRes.rows;
  if (milestones.length === 0) return { stages: [], current_stage: null };

  const milestoneIds = milestones.map((m) => m.milestone_id);

  const subtasksRes = await db.query(
    `SELECT s.subtask_id, s.milestone_id, s.title, s.status, s.completed_at
     FROM project_subtasks s
     WHERE s.milestone_id = ANY($1::uuid[]) AND s.deleted_at IS NULL
     ORDER BY s.created_at ASC`,
    [milestoneIds]
  );

  const subtasksByMilestone = subtasksRes.rows.reduce((acc, s) => {
    if (!acc[s.milestone_id]) acc[s.milestone_id] = [];
    acc[s.milestone_id].push(s);
    return acc;
  }, {});

  let currentStage = null;
  const stages = milestones.map((m) => {
    const subtasks = subtasksByMilestone[m.milestone_id] || [];
    const total = subtasks.length;
    const completed = subtasks.filter((s) => s.status === 'completed').length;

    let status;
    if (total === 0) {
      status = 'not_started';
    } else if (completed === total) {
      status = 'completed';
    } else if (completed > 0) {
      status = 'in_progress';
      if (!currentStage) currentStage = m.title;
    } else {
      status = 'not_started';
    }

    return {
      milestone_id: m.milestone_id,
      title: m.title,
      order_index: m.order_index,
      status,
      total_subtasks: total,
      completed_subtasks: completed,
      subtasks: subtasks.map((s) => ({
        subtask_id: s.subtask_id,
        title: s.title,
        status: s.status,
        completed_at: s.completed_at,
      })),
    };
  });

  // If no in_progress stage found, set current to the first not_started stage
  if (!currentStage) {
    const firstNotStarted = stages.find((s) => s.status === 'not_started');
    if (firstNotStarted) currentStage = firstNotStarted.title;
  }

  return { stages, current_stage: currentStage };
};

/**
 * Calculate the total verified payments for an order.
 */
const getVerifiedPaymentTotal = async (db, orderId) => {
  const res = await db.query(
    `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0)::numeric AS verified_total
     FROM payments
     WHERE order_id = $1 AND deleted_at IS NULL`,
    [orderId]
  );
  return Number(res.rows[0]?.verified_total || 0);
};

// ─── CORE FUNCTIONS ───────────────────────────────────────────────────────────

/**
 * Get a structured build state preview for the cancel confirmation modal.
 * This endpoint is called BEFORE cancellation to show the customer what they'll receive.
 */
exports.getBuildStatePreview = async (projectId, userId, userRole) => {
  await ensureCurrentBuildClaimsTable();

  const pRes = await pool.query(
    `SELECT p.project_id, p.order_id, p.status, p.progress,
            o.user_id AS customer_id, o.total_amount AS order_total_amount
     FROM projects p
     JOIN orders o ON o.order_id = p.order_id
     WHERE p.project_id = $1 AND p.deleted_at IS NULL`,
    [projectId]
  );
  if (pRes.rows.length === 0) throw new AppError('Project not found', 404);
  const project = pRes.rows[0];

  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
  if (!isPrivileged && project.customer_id !== userId) {
    throw new AppError('You do not have access to this project', 403);
  }

  // Build state from milestones (backend source of truth)
  const { stages, current_stage } = await buildStateFromMilestones(pool, projectId);

  // Calculate progress from subtask stats
  const statsRes = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(CASE WHEN ps.status = 'completed' THEN 1 END)::int AS completed
     FROM project_subtasks ps
     JOIN project_milestones pm ON ps.milestone_id = pm.milestone_id
     WHERE pm.project_id = $1`,
    [projectId]
  );
  const stats = statsRes.rows[0] || { total: 0, completed: 0 };
  const progress = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

  // Financial data
  const amountPaid = await getVerifiedPaymentTotal(pool, project.order_id);

  // Down payment is used to purchase parts — not refundable once build started
  const estimatedBuildValue = progress > 0 ? amountPaid : 0;

  return {
    project_id: projectId,
    progress,
    current_stage,
    stages,
    amount_paid: amountPaid,
    estimated_build_value: estimatedBuildValue,
    order_total_amount: Number(project.order_total_amount || 0),
    has_progress: progress > 0 || stats.total > 0,
  };
};

/**
 * Create a current build claim when a project with progress is cancelled.
 * Called inside a transaction from the cancel flow.
 */
exports.createClaimForCancelledProject = async (db, projectId, customerId, orderId) => {
  await ensureCurrentBuildClaimsTable();

  // Check for existing claim
  const existingRes = await db.query(
    `SELECT claim_id FROM current_build_claims
     WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  if (existingRes.rows.length > 0) {
    return existingRes.rows[0];
  }

  // Build state snapshot
  const { stages, current_stage } = await buildStateFromMilestones(db, projectId);

  // Calculate progress
  const statsRes = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(CASE WHEN ps.status = 'completed' THEN 1 END)::int AS completed
     FROM project_subtasks ps
     JOIN project_milestones pm ON ps.milestone_id = pm.milestone_id
     WHERE pm.project_id = $1`,
    [projectId]
  );
  const stats = statsRes.rows[0] || { total: 0, completed: 0 };
  const progress = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

  // Financial data
  const amountPaid = await getVerifiedPaymentTotal(db, orderId);
  const estimatedBuildValue = amountPaid;

  const insertRes = await db.query(
    `INSERT INTO current_build_claims (
       project_id, customer_id, order_id,
       progress_at_cancellation, current_build_stage, build_state_snapshot,
       amount_paid, estimated_build_value,
       claim_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_customer_selection')
     RETURNING *`,
    [
      projectId, customerId, orderId,
      progress, current_stage, JSON.stringify(stages),
      amountPaid, estimatedBuildValue,
    ]
  );

  await logClaimActivity(db, projectId, customerId, 'build_claim_created', {
    claim_id: insertRes.rows[0].claim_id,
    progress_at_cancellation: progress,
    current_build_stage: current_stage,
    amount_paid: amountPaid,
  });

  return insertRes.rows[0];
};

/**
 * Get the claim for a project.
 */
exports.getClaimByProjectId = async (projectId, userId, userRole) => {
  await ensureCurrentBuildClaimsTable();

  const claimRes = await pool.query(
    `SELECT cbc.*,
            u_customer.first_name AS customer_first_name,
            u_customer.last_name AS customer_last_name,
            u_customer.email AS customer_email,
            u_customer.phone AS customer_phone,
            u_admin.first_name AS admin_confirmed_first_name,
            u_admin.last_name AS admin_confirmed_last_name,
            p.title AS project_title,
            p.custom_build_id,
            p.status AS project_status
     FROM current_build_claims cbc
     JOIN users u_customer ON u_customer.user_id = cbc.customer_id
     LEFT JOIN users u_admin ON u_admin.user_id = cbc.admin_confirmed_by
     JOIN projects p ON p.project_id = cbc.project_id
     WHERE cbc.project_id = $1 AND cbc.deleted_at IS NULL`,
    [projectId]
  );

  if (claimRes.rows.length === 0) return null;

  const claim = claimRes.rows[0];

  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
  if (!isPrivileged && claim.customer_id !== userId) {
    throw new AppError('You do not have access to this claim', 403);
  }

  claim.build_state_snapshot = typeof claim.build_state_snapshot === 'string'
    ? JSON.parse(claim.build_state_snapshot) : claim.build_state_snapshot;
  claim.current_state_photos = typeof claim.current_state_photos === 'string'
    ? JSON.parse(claim.current_state_photos) : claim.current_state_photos;
  claim.delivery_address = typeof claim.delivery_address === 'string'
    ? JSON.parse(claim.delivery_address) : claim.delivery_address;

  return claim;
};

/**
 * Customer selects how to receive their guitar (courier or pickup).
 */
exports.submitClaimMethod = async (projectId, userId, userRole, data = {}) => {
  await ensureCurrentBuildClaimsTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const claimRes = await client.query(
      `SELECT * FROM current_build_claims
       WHERE project_id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [projectId]
    );
    if (claimRes.rows.length === 0) throw new AppError('No build claim found for this project', 404);
    const claim = claimRes.rows[0];

    const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
    if (!isPrivileged && claim.customer_id !== userId) {
      throw new AppError('You do not have access to this claim', 403);
    }

    if (!['pending_customer_selection', 'pending_admin_confirmation'].includes(claim.claim_status)) {
      throw new AppError('Claim method can only be selected before admin confirmation', 400);
    }

    const method = String(data.method || '').trim();
    if (!['courier', 'pickup'].includes(method)) {
      throw new AppError('Invalid claim method. Choose courier or pickup', 400);
    }

    const updateFields = [
      'claim_method = $1',
      'claim_status = $2',
      'updated_at = CURRENT_TIMESTAMP',
    ];
    const updateValues = [method, 'pending_admin_confirmation'];
    let idx = 3;

    if (method === 'courier') {
      if (data.delivery_address) {
        updateFields.push(`delivery_address = $${idx++}`);
        updateValues.push(JSON.stringify(data.delivery_address));
      }
      if (data.recipient_name) {
        updateFields.push(`recipient_name = $${idx++}`);
        updateValues.push(String(data.recipient_name).trim());
      }
      if (data.recipient_contact) {
        updateFields.push(`recipient_contact = $${idx++}`);
        updateValues.push(String(data.recipient_contact).trim());
      }
      if (data.delivery_instructions) {
        updateFields.push(`delivery_instructions = $${idx++}`);
        updateValues.push(String(data.delivery_instructions).trim());
      }
    } else if (method === 'pickup') {
      if (data.pickup_schedule) {
        updateFields.push(`pickup_schedule = $${idx++}`);
        updateValues.push(new Date(data.pickup_schedule).toISOString());
      }
      if (data.pickup_contact) {
        updateFields.push(`pickup_contact = $${idx++}`);
        updateValues.push(String(data.pickup_contact).trim());
      }
    }

    updateValues.push(claim.claim_id);
    const res = await client.query(
      `UPDATE current_build_claims SET ${updateFields.join(', ')}
       WHERE claim_id = $${idx} RETURNING *`,
      updateValues
    );

    await logClaimActivity(client, projectId, userId, 'build_claim_method_selected', {
      claim_id: claim.claim_id,
      method,
    });

    // Notify admins
    const adminRes = await client.query(
      `SELECT user_id FROM users WHERE role IN ('admin', 'super_admin') AND deleted_at IS NULL`
    );
    for (const admin of adminRes.rows) {
      try {
        await notificationService.createNotification({
          user_id: admin.user_id,
          title: 'Build Claim Pending Confirmation',
          message: `A customer has selected ${method} for their cancelled build claim. Please review and confirm the current build state.`,
          type: 'order_update',
          related_entity_id: projectId,
          related_entity_type: 'project',
        });
      } catch (e) {
        console.warn('Failed to send admin notification:', e.message);
      }
    }

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin confirms the physical state of the guitar before release.
 */
exports.confirmBuildState = async (projectId, adminId, data = {}) => {
  await ensureCurrentBuildClaimsTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const claimRes = await client.query(
      `SELECT * FROM current_build_claims
       WHERE project_id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [projectId]
    );
    if (claimRes.rows.length === 0) throw new AppError('No build claim found', 404);
    const claim = claimRes.rows[0];

    if (claim.claim_status !== 'pending_admin_confirmation') {
      throw new AppError(`Build state can only be confirmed when status is pending_admin_confirmation (current: ${claim.claim_status})`, 400);
    }

    if (!claim.claim_method) {
      throw new AppError('Customer must select a claim method before admin confirmation', 400);
    }

    const nextStatus = claim.claim_method === 'courier' ? 'ready_for_delivery' : 'ready_for_pickup';

    const updateFields = [
      'admin_confirmed_by = $1',
      'admin_confirmed_at = CURRENT_TIMESTAMP',
      `claim_status = '${nextStatus}'`,
      'updated_at = CURRENT_TIMESTAMP',
    ];
    const updateValues = [adminId];
    let idx = 2;

    if (data.notes) {
      updateFields.push(`admin_confirmation_notes = $${idx++}`);
      updateValues.push(String(data.notes).trim());
    }

    if (data.photos && Array.isArray(data.photos)) {
      updateFields.push(`current_state_photos = $${idx++}`);
      updateValues.push(JSON.stringify(data.photos));
    }

    if (claim.claim_method === 'pickup') {
      if (data.pickup_location) {
        updateFields.push(`pickup_location = $${idx++}`);
        updateValues.push(String(data.pickup_location).trim());
      }
      if (data.pickup_instructions) {
        updateFields.push(`pickup_instructions = $${idx++}`);
        updateValues.push(String(data.pickup_instructions).trim());
      }
    }

    updateValues.push(claim.claim_id);
    const res = await client.query(
      `UPDATE current_build_claims SET ${updateFields.join(', ')}
       WHERE claim_id = $${idx} RETURNING *`,
      updateValues
    );

    await logClaimActivity(client, projectId, adminId, 'build_claim_confirmed', {
      claim_id: claim.claim_id,
      claim_method: claim.claim_method,
      next_status: nextStatus,
    });

    try {
      const statusMsg = claim.claim_method === 'courier'
        ? 'Your guitar is being prepared for delivery.'
        : 'Your guitar is ready for pickup at the shop.';
      await notificationService.createNotification({
        user_id: claim.customer_id,
        title: 'Build State Confirmed',
        message: `The admin has verified your guitar's current build state. ${statusMsg}`,
        type: 'order_update',
        related_entity_id: projectId,
        related_entity_type: 'project',
      });
    } catch (e) {
      console.warn('Failed to send customer notification:', e.message);
    }

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin arranges courier for delivery.
 */
exports.arrangeCourier = async (projectId, adminId, data = {}) => {
  await ensureCurrentBuildClaimsTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const claimRes = await client.query(
      `SELECT * FROM current_build_claims
       WHERE project_id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [projectId]
    );
    if (claimRes.rows.length === 0) throw new AppError('No build claim found', 404);
    const claim = claimRes.rows[0];

    if (claim.claim_method !== 'courier') {
      throw new AppError('This claim is not set for courier delivery', 400);
    }

    if (claim.claim_status !== 'ready_for_delivery') {
      throw new AppError(`Courier can only be arranged when status is ready_for_delivery (current: ${claim.claim_status})`, 400);
    }

    const updateFields = [
      `claim_status = 'courier_arranged'`,
      'updated_at = CURRENT_TIMESTAMP',
    ];
    const updateValues = [];
    let idx = 1;

    if (data.courier_service) {
      updateFields.push(`courier_service = $${idx++}`);
      updateValues.push(String(data.courier_service).trim());
    }
    if (data.courier_reference) {
      updateFields.push(`courier_reference = $${idx++}`);
      updateValues.push(String(data.courier_reference).trim());
    }
    if (data.delivery_fee !== undefined && data.delivery_fee !== null) {
      updateFields.push(`delivery_fee = $${idx++}`);
      updateValues.push(Number(data.delivery_fee));
    }
    if (data.estimated_delivery_date) {
      updateFields.push(`estimated_delivery_date = $${idx++}`);
      updateValues.push(data.estimated_delivery_date);
    }

    updateValues.push(claim.claim_id);
    const res = await client.query(
      `UPDATE current_build_claims SET ${updateFields.join(', ')}
       WHERE claim_id = $${idx} RETURNING *`,
      updateValues
    );

    await logClaimActivity(client, projectId, adminId, 'build_claim_courier_arranged', {
      claim_id: claim.claim_id,
      courier_service: data.courier_service,
      courier_reference: data.courier_reference,
      delivery_fee: data.delivery_fee,
    });

    try {
      await notificationService.createNotification({
        user_id: claim.customer_id,
        title: 'Courier Arranged',
        message: `A courier has been arranged for your guitar delivery${data.courier_service ? ` via ${data.courier_service}` : ''}.${data.courier_reference ? ` Reference: ${data.courier_reference}` : ''}`,
        type: 'order_update',
        related_entity_id: projectId,
        related_entity_type: 'project',
      });
    } catch (e) {
      console.warn('Failed to send customer notification:', e.message);
    }

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin updates the claim status (generic transitions like out_for_delivery, delivered, etc).
 */
exports.updateClaimStatus = async (projectId, adminId, newStatus, data = {}) => {
  await ensureCurrentBuildClaimsTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const claimRes = await client.query(
      `SELECT * FROM current_build_claims
       WHERE project_id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [projectId]
    );
    if (claimRes.rows.length === 0) throw new AppError('No build claim found', 404);
    const claim = claimRes.rows[0];

    if (!isValidTransition(claim.claim_status, newStatus)) {
      throw new AppError(`Invalid status transition from '${claim.claim_status}' to '${newStatus}'`, 400);
    }

    const res = await client.query(
      `UPDATE current_build_claims
       SET claim_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE claim_id = $2
       RETURNING *`,
      [newStatus, claim.claim_id]
    );

    await logClaimActivity(client, projectId, adminId, 'build_claim_status_updated', {
      claim_id: claim.claim_id,
      from: claim.claim_status,
      to: newStatus,
    });

    const statusMessages = {
      out_for_delivery: 'Your guitar is out for delivery!',
      delivered: 'Your guitar has been delivered. Please confirm receipt.',
      ready_for_pickup: 'Your guitar is ready for pickup at the shop.',
    };

    if (statusMessages[newStatus]) {
      try {
        await notificationService.createNotification({
          user_id: claim.customer_id,
          title: 'Build Claim Update',
          message: statusMessages[newStatus],
          type: 'order_update',
          related_entity_id: projectId,
          related_entity_type: 'project',
        });
      } catch (e) {
        console.warn('Failed to send customer notification:', e.message);
      }
    }

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Customer confirms receipt of the guitar.
 */
exports.markAsReceived = async (projectId, userId, userRole) => {
  await ensureCurrentBuildClaimsTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const claimRes = await client.query(
      `SELECT * FROM current_build_claims
       WHERE project_id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [projectId]
    );
    if (claimRes.rows.length === 0) throw new AppError('No build claim found', 404);
    const claim = claimRes.rows[0];

    const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
    if (!isPrivileged && claim.customer_id !== userId) {
      throw new AppError('You do not have access to this claim', 403);
    }

    if (!['delivered', 'picked_up'].includes(claim.claim_status)) {
      throw new AppError(`Guitar can only be marked as received when status is delivered or picked_up (current: ${claim.claim_status})`, 400);
    }

    const res = await client.query(
      `UPDATE current_build_claims
       SET claim_status = 'received',
           received_at = CURRENT_TIMESTAMP,
           received_confirmed_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE claim_id = $2
       RETURNING *`,
      [userId, claim.claim_id]
    );

    await logClaimActivity(client, projectId, userId, 'build_claim_received', {
      claim_id: claim.claim_id,
      claim_method: claim.claim_method,
    });

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin/staff marks the guitar as picked up.
 */
exports.markAsPickedUp = async (projectId, adminId, data = {}) => {
  await ensureCurrentBuildClaimsTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const claimRes = await client.query(
      `SELECT * FROM current_build_claims
       WHERE project_id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [projectId]
    );
    if (claimRes.rows.length === 0) throw new AppError('No build claim found', 404);
    const claim = claimRes.rows[0];

    if (claim.claim_status !== 'ready_for_pickup') {
      throw new AppError(`Guitar can only be marked as picked up when status is ready_for_pickup (current: ${claim.claim_status})`, 400);
    }

    const updateFields = [
      `claim_status = 'picked_up'`,
      'updated_at = CURRENT_TIMESTAMP',
      'pickup_staff_id = $1',
    ];
    const updateValues = [adminId];
    let idx = 2;

    if (data.pickup_proof_photo) {
      updateFields.push(`pickup_proof_photo = $${idx++}`);
      updateValues.push(String(data.pickup_proof_photo).trim());
    }

    updateValues.push(claim.claim_id);
    const res = await client.query(
      `UPDATE current_build_claims SET ${updateFields.join(', ')}
       WHERE claim_id = $${idx} RETURNING *`,
      updateValues
    );

    await logClaimActivity(client, projectId, adminId, 'build_claim_picked_up', {
      claim_id: claim.claim_id,
      staff_id: adminId,
    });

    try {
      await notificationService.createNotification({
        user_id: claim.customer_id,
        title: 'Guitar Picked Up',
        message: 'Your guitar has been picked up. Thank you!',
        type: 'order_update',
        related_entity_id: projectId,
        related_entity_type: 'project',
      });
    } catch (e) {
      console.warn('Failed to send customer notification:', e.message);
    }

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin list all build claims with optional status filter and pagination.
 */
exports.getAllClaims = async (params = {}) => {
  await ensureCurrentBuildClaimsTable();

  const {
    status,
    search,
    sort_by = 'created_at',
    sort_dir = 'desc',
    page = 1,
    page_size = 20,
  } = params;

  const limit = Math.min(Math.max(Number(page_size) || 20, 1), 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const allowedSort = ['created_at', 'updated_at', 'claim_status', 'progress_at_cancellation'];
  const orderBy = allowedSort.includes(sort_by) ? sort_by : 'created_at';
  const orderDir = sort_dir === 'asc' ? 'ASC' : 'DESC';

  const where = ['cbc.deleted_at IS NULL'];
  const queryParams = [];
  let idx = 1;

  if (status) {
    where.push(`cbc.claim_status = $${idx++}`);
    queryParams.push(status);
  }

  if (search) {
    where.push(`(
      p.title ILIKE $${idx} OR
      p.custom_build_id ILIKE $${idx} OR
      u.first_name ILIKE $${idx} OR
      u.last_name ILIKE $${idx} OR
      u.email ILIKE $${idx}
    )`);
    queryParams.push(`%${search}%`);
    idx++;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM current_build_claims cbc
     JOIN projects p ON p.project_id = cbc.project_id
     JOIN users u ON u.user_id = cbc.customer_id
     ${whereClause}`,
    queryParams
  );
  const total = countRes.rows[0]?.total || 0;

  const claimsRes = await pool.query(
    `SELECT cbc.*,
            u.first_name AS customer_first_name,
            u.last_name AS customer_last_name,
            u.email AS customer_email,
            u.phone AS customer_phone,
            p.title AS project_title,
            p.custom_build_id,
            p.status AS project_status,
            o.order_number
     FROM current_build_claims cbc
     JOIN projects p ON p.project_id = cbc.project_id
     JOIN users u ON u.user_id = cbc.customer_id
     JOIN orders o ON o.order_id = cbc.order_id
     ${whereClause}
     ORDER BY cbc.${orderBy} ${orderDir}
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...queryParams, limit, offset]
  );

  return {
    claims: claimsRes.rows,
    pagination: {
      page: Math.max(Number(page) || 1, 1),
      page_size: limit,
      total,
      total_pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

/**
 * Attach claim data to project objects (used by getProjectById / getProjectHierarchy).
 */
exports.attachClaimToProject = async (project) => {
  if (!project || !project.project_id) return project;

  await ensureCurrentBuildClaimsTable();

  try {
    const claimRes = await pool.query(
      `SELECT claim_id, claim_status, claim_method, progress_at_cancellation,
              current_build_stage, amount_paid, estimated_build_value,
              build_state_snapshot, current_state_photos,
              courier_service, courier_reference, delivery_fee,
              estimated_delivery_date, delivery_address,
              recipient_name, recipient_contact,
              pickup_location, pickup_instructions, pickup_schedule,
              admin_confirmed_by, admin_confirmed_at, admin_confirmation_notes,
              received_at, created_at AS claim_created_at
       FROM current_build_claims
       WHERE project_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [project.project_id]
    );

    if (claimRes.rows.length > 0) {
      const claim = claimRes.rows[0];
      claim.build_state_snapshot = typeof claim.build_state_snapshot === 'string'
        ? JSON.parse(claim.build_state_snapshot) : claim.build_state_snapshot;
      claim.current_state_photos = typeof claim.current_state_photos === 'string'
        ? JSON.parse(claim.current_state_photos) : claim.current_state_photos;
      claim.delivery_address = typeof claim.delivery_address === 'string'
        ? JSON.parse(claim.delivery_address) : claim.delivery_address;

      project.build_claim = claim;
    } else {
      project.build_claim = null;
    }
  } catch (err) {
    project.build_claim = null;
  }

  return project;
};

exports.__ensureTable = ensureCurrentBuildClaimsTable;
