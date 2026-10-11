const { pool } = require('../config/database');
const { presentAudit } = require('./auditPresentation');
const { validateAuditFilters, validateAuditId } = require('./auditFilters');

// PostgreSQL triggers own audit creation. This service only reads history.
const USER_JOIN = `
  FROM audit_logs al
  LEFT JOIN users u ON al.user_id = u.user_id`;

const USER_COLUMNS = `al.*,
  COALESCE(al.context->>'actor_email', u.email) as user_email,
  COALESCE(al.context->>'actor_role', u.role::text) as user_role,
  COALESCE(al.context->>'actor_name',
    TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.middle_name, ''), ' ', COALESCE(u.last_name, '')))) as user_name`;

/**
 * Lists audit rows newest-first.
 *
 * `search` is server-side so a query spans the entire history rather than only
 * the records that happen to be on the current page. It matches the flattened
 * search_text column (action, entity, context identifiers, reason text) plus the
 * actor's name and email.
 */
async function getAuditLogs(filters = {}) {
  const {
    entity_type,
    entity_id,
    user_id,
    action,
    start_date,
    end_date,
    search,
    limit = 50,
    offset = 0,
  } = validateAuditFilters(filters);

  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (entity_type && entity_type !== 'all') {
    conditions.push(`al.entity_type = $${paramIndex++}`);
    values.push(entity_type);
  }
  if (entity_id) {
    conditions.push(`al.entity_id = $${paramIndex++}`);
    values.push(entity_id);
  }
  if (user_id) {
    conditions.push(`al.user_id = $${paramIndex++}`);
    values.push(user_id);
  }
  if (action && action !== 'all') {
    conditions.push(`al.action = $${paramIndex++}`);
    values.push(action);
  }
  if (start_date) {
    conditions.push(`al.created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }
  if (end_date) {
    conditions.push(`al.created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const term = (search || '').toString().trim();
  if (term) {
    conditions.push(`(
      al.search_text ILIKE $${paramIndex}
      OR EXISTS (SELECT 1 FROM users actor WHERE actor.user_id = al.user_id
        AND (actor.email ILIKE $${paramIndex} OR actor.first_name ILIKE $${paramIndex}
          OR actor.last_name ILIKE $${paramIndex}))
    )`);
    values.push('%' + term.replace(/[\\%_]/g, character => '\\' + character) + '%');
    paramIndex += 1;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = limit;
  const safeOffset = offset;

  const result = await pool.query(
    `SELECT al.audit_id, al.user_id, al.entity_type, al.entity_id, al.action,
       al.previous_status, al.new_status, al.created_at, al.context,
       COALESCE((SELECT jsonb_object_agg(field.key,
         CASE WHEN jsonb_typeof(field.value) = 'string' THEN to_jsonb(left(field.value #>> '{}', 500)) ELSE field.value END)
         FROM jsonb_each(
           (CASE WHEN jsonb_typeof(al.details->'old') = 'object' THEN al.details->'old' ELSE '{}'::jsonb END)
           || (COALESCE(al.details, '{}'::jsonb) - 'old' - 'new')
           || (CASE WHEN jsonb_typeof(al.details->'new') = 'object' THEN al.details->'new' ELSE '{}'::jsonb END)) field
         WHERE field.key = ANY(ARRAY['adjustment_reason', 'affected_date', 'affected_user_email', 'affected_user_name', 'amount', 'appointment_number', 'appointment_payment_status', 'appointment_type', 'approved_amount', 'body_model', 'build_name', 'cancel_reason', 'category', 'closure_type', 'confirmation_method', 'courier', 'courier_name', 'custom_build_id', 'customer', 'customer_email', 'customer_name', 'customer_notes', 'date', 'delivery_method', 'delta', 'email', 'fulfillment_method', 'full_name', 'hold_reason', 'installment_number', 'is_recurring', 'item_count', 'method', 'movement', 'name', 'new_quantity', 'notes', 'order_number', 'order_total', 'order_type', 'part_name', 'payment_amount', 'payment_id', 'payment_method', 'payment_reference', 'payment_status', 'payment_type', 'previous_quantity', 'previous_reason', 'previous_role', 'price', 'product_name', 'progress', 'progress_percent', 'project_number', 'project_title', 'proof_number', 'quantity', 'quantity_change', 'reason', 'reference_code', 'reference_number', 'reference_type', 'refund_amount', 'refund_number', 'refund_type', 'rejection_reason', 'request_number', 'return_reason', 'returned_item_count', 'role', 'sale_number', 'scheduled_at', 'sku', 'source', 'source_number', 'stock', 'stock_from', 'stock_to', 'title', 'total_amount', 'tracking_number', 'type', 'user_email', 'user_name', 'void_reason']::text[])
           AND jsonb_typeof(field.value) NOT IN ('object', 'array')), '{}'::jsonb) AS details,
       COALESCE((SELECT jsonb_object_agg(field.key, jsonb_build_object(
         'from', CASE WHEN jsonb_typeof(field.value->'from') IN ('object', 'array') THEN to_jsonb('updated data'::text) WHEN jsonb_typeof(field.value->'from') = 'string' THEN to_jsonb(left(field.value->>'from', 500)) ELSE field.value->'from' END,
         'to', CASE WHEN jsonb_typeof(field.value->'to') IN ('object', 'array') THEN to_jsonb('updated data'::text) WHEN jsonb_typeof(field.value->'to') = 'string' THEN to_jsonb(left(field.value->>'to', 500)) ELSE field.value->'to' END))
         FROM jsonb_each(COALESCE(al.changes, '{}'::jsonb)) field), '{}'::jsonb) AS changes,
       COALESCE(al.context->>'actor_email', u.email) AS user_email,
       COALESCE(al.context->>'actor_role', u.role::text) AS user_role,
       COALESCE(al.context->>'actor_name', TRIM(CONCAT(u.first_name, ' ', u.middle_name, ' ', u.last_name))) AS user_name
     FROM (SELECT * FROM audit_logs al ${whereClause}
       ORDER BY al.created_at DESC, al.audit_id DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}) al
     LEFT JOIN users u ON al.user_id = u.user_id
     ORDER BY al.created_at DESC, al.audit_id DESC
     `,
    [...values, safeLimit, safeOffset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
    values
  );

  return {
    logs: result.rows.map(presentAudit),
    total: parseInt(countResult.rows[0].total, 10),
    limit: safeLimit,
    offset: safeOffset,
  };
}

async function getAuditLogById(auditId) {
  const result = await pool.query(
    `SELECT ${USER_COLUMNS} ${USER_JOIN} WHERE al.audit_id = $1`,
    [validateAuditId(auditId)]
  );

  return result.rows[0] ? presentAudit(result.rows[0]) : null;
}

async function getAuditLogsByEntity(entityType, entityId, filters = {}) {
  return (await getAuditLogs({ ...filters, entity_type: entityType, entity_id: entityId })).logs;
}

async function getAuditLogsByModule(entityType, filters = {}) {
  return (await getAuditLogs({ ...filters, entity_type: entityType })).logs;
}

async function getAuditLogsByUser(userId, filters = {}) {
  return (await getAuditLogs({ ...filters, user_id: userId })).logs;
}

/**
 * Distinct actions that actually exist in the trail, so the admin filter never
 * offers a value that returns nothing.
 */
async function getAuditActions() {
  const result = await pool.query(
    `SELECT DISTINCT action FROM audit_logs ORDER BY action`
  );
  return result.rows;
}

async function getActivitySummary(filters = {}) {
  const { start_date, end_date } = validateAuditFilters(filters);

  const buildWhere = (prefix) => {
    const conditions = [];
    const values = [];
    if (start_date) {
      conditions.push(`${prefix}created_at >= $${values.length + 1}`);
      values.push(new Date(start_date));
    }
    if (end_date) {
      conditions.push(`${prefix}created_at <= $${values.length + 1}`);
      values.push(new Date(end_date));
    }
    return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', values };
  };

  const summary = buildWhere('');
  const byUser = buildWhere('al.');

  const result = await pool.query(
    `SELECT entity_type as module, action, COUNT(*) as count
     FROM audit_logs ${summary.where}
     GROUP BY entity_type, action
     ORDER BY count DESC`,
    summary.values
  );

  const userActivity = await pool.query(
    `SELECT al.user_id, u.email,
      TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.middle_name, ''), ' ', COALESCE(u.last_name, ''))) as name,
      COUNT(*) as actions
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.user_id
     ${byUser.where}
     GROUP BY al.user_id, u.email, u.first_name, u.middle_name, u.last_name
     ORDER BY actions DESC
     LIMIT 10`,
    byUser.values
  );

  return {
    by_module_action: result.rows,
    top_users: userActivity.rows,
  };
}

module.exports = { getAuditLogs, getAuditLogById, getAuditLogsByEntity, getAuditLogsByModule, getAuditLogsByUser, getAuditActions, getActivitySummary };
