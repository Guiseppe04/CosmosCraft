const { pool } = require('../config/database');
const {
  redactDetails,
  compactContext,
  buildChanges,
  buildSearchText,
  orderContext,
  projectContext,
  paymentContext,
  productContext,
  inventoryContext,
  refundContext,
  appointmentContext,
  posContext,
  userContext,
  fulfillmentContext,
} = require('./auditContext');

const MODULES = {
  USERS: 'users',
  // Values match the entity_type already stored by earlier releases: renaming
  // them would split one module's history across two filter options.
  ORDERS: 'order',
  PAYMENTS: 'payment',
  APPOINTMENTS: 'appointments',
  CART: 'cart',
  SERVICES: 'services',
  CUSTOMIZATIONS: 'customizations',
  PRODUCTS: 'products',
  GUITAR_PARTS: 'guitar_builder_parts',
  RBAC: 'rbac',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  PROJECT: 'project',
  INVENTORY: 'inventory',
  PAYMENT: 'payment',
  POS: 'pos',
  FULFILLMENT: 'fulfillment',
  REFUND: 'refund',
};

const ACTIONS = {
  CREATE: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN_ATTEMPT',
  LOGOUT: 'LOGOUT',
  VERIFY: 'VERIFY',
  REJECT: 'REJECT',
  REFUND: 'REFUND',
  CANCEL: 'CANCEL',
  EXPORT: 'EXPORT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  STOCK_ALERT: 'STOCK_ALERT',
  VOID: 'VOID',
  RETURN: 'RETURN',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * entity_id is a uuid column, so business identifiers (PO-..., CO-..., RF-...)
 * cannot be stored there. They belong in `context`; anything that is not a uuid
 * is dropped instead of crashing the INSERT.
 */
function toUuid(value) {
  if (!value) return null;
  const candidate = String(value).trim();
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

/**
 * Pulls a status transition out of wherever the caller happened to put it.
 * Payment/refund flows historically passed `previous_status`/`new_status`
 * inside `details`, which left the dedicated columns empty and hid the change
 * from the UI. Deriving it here fixes those records at write time.
 */
function resolveStatuses({ previous_status, new_status, details, context, changes }) {
  const detail = details && typeof details === 'object' ? details : {};
  const nestedOld = detail.old && typeof detail.old === 'object' ? detail.old : {};
  const nestedNew = detail.new && typeof detail.new === 'object' ? detail.new : {};

  const previous =
    previous_status ||
    detail.previous_status ||
    nestedOld.status ||
    changes?.status?.from ||
    null;

  const next =
    new_status ||
    detail.new_status ||
    nestedNew.status ||
    changes?.status?.to ||
    null;

  return {
    previous_status: previous || null,
    new_status: next || null,
  };
}

/**
 * Single writer for every audit row.
 *
 * @param {object}  options
 * @param {string}  [options.action]
 * @param {string}  options.entityType
 * @param {string}  [options.entityId]      uuid of the affected row
 * @param {string}  [options.previousStatus]
 * @param {string}  [options.newStatus]
 * @param {object}  [options.details]        free-form payload (redacted before storage)
 * @param {object}  [options.context]        normalised business context
 * @param {object}  [options.changes]        field level before/after pairs
 * @param {object}  [options.executor]       an existing pg client, to join the caller's transaction
 */
async function createAuditLog({
  user_id,
  action,
  entity_type,
  entity_id,
  previous_status,
  new_status,
  details,
  context,
  changes,
  ip_address,
  user_agent,
  executor = null,
}) {
  const safeDetails = redactDetails(details || {});
  const safeContext = compactContext(context || {});
  const safeChanges = changes && Object.keys(changes).length > 0 ? redactDetails(changes) : {};
  const { previous_status: resolvedPrevious, new_status: resolvedNew } = resolveStatuses({
    previous_status,
    new_status,
    details: safeDetails,
    context: safeContext,
    changes: safeChanges,
  });

  const searchText = buildSearchText({
    action,
    entity_type,
    entity_id: toUuid(entity_id),
    previous_status: resolvedPrevious,
    new_status: resolvedNew,
    context: safeContext,
    changes: safeChanges,
    details: safeDetails,
  });

  const query = `
    INSERT INTO audit_logs (
      user_id, action, entity_type, entity_id,
      previous_status, new_status, details, context, changes,
      ip_address, user_agent, search_text
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`;

  const params = [
    user_id || null,
    action,
    entity_type,
    toUuid(entity_id),
    resolvedPrevious,
    resolvedNew,
    JSON.stringify(safeDetails),
    JSON.stringify(safeContext),
    JSON.stringify(safeChanges),
    ip_address || null,
    user_agent || null,
    searchText,
  ];

  const runner = executor || pool;
  const result = await runner.query(query, params);
  return result.rows[0];
}

/**
 * Writes an audit row inside the caller's transaction so an event and its
 * audit entry can never disagree.
 *
 * When a client is supplied the insert is wrapped in a savepoint: an audit
 * failure is rolled back on its own and reported, but it never aborts the
 * surrounding business transaction (a plain try/catch is not enough inside
 * PostgreSQL).
 */
const AUDIT_SAVEPOINT = 'audit_log_savepoint';

async function writeAudit(entry) {
  const executor = entry.executor || null;
  // A checked-out client runs inside the caller's transaction and needs a
  // savepoint; a Pool is not in one, and SAVEPOINT would be rejected there.
  const inTransaction = Boolean(executor && typeof executor.release === 'function');

  try {
    if (inTransaction) await executor.query(`SAVEPOINT ${AUDIT_SAVEPOINT}`);
    return await createAuditLog(entry);
  } catch (err) {
    console.warn('Audit log not written:', err.message);
    if (inTransaction) {
      await executor.query(`ROLLBACK TO SAVEPOINT ${AUDIT_SAVEPOINT}`).catch(() => {});
    }
    return null;
  } finally {
    if (inTransaction) {
      await executor.query(`RELEASE SAVEPOINT ${AUDIT_SAVEPOINT}`).catch(() => {});
    }
  }
}

/* ─── Backwards-compatible helpers ───────────────────────────────────────── */

async function logCreate(userId, entityType, entityId, newData, ipAddress, options = {}) {
  return writeAudit({
    user_id: userId,
    action: ACTIONS.CREATE,
    entity_type: entityType,
    entity_id: entityId,
    details: newData,
    new_status: newData?.status,
    context: options.context,
    ip_address: ipAddress,
  });
}

async function logUpdate(userId, entityType, entityId, oldData, newData, ipAddress, options = {}) {
  return writeAudit({
    user_id: userId,
    action: ACTIONS.UPDATE,
    entity_type: entityType,
    entity_id: entityId,
    previous_status: oldData?.status,
    new_status: newData?.status,
    details: { old: oldData, new: newData },
    context: options.context,
    changes: options.changes || buildChanges(oldData, newData),
    ip_address: ipAddress,
  });
}

async function logDelete(userId, entityType, entityId, oldData, ipAddress, options = {}) {
  return writeAudit({
    user_id: userId,
    action: ACTIONS.DELETE,
    entity_type: entityType,
    entity_id: entityId,
    details: oldData,
    previous_status: oldData?.status,
    context: options.context,
    ip_address: ipAddress,
  });
}

async function logAction(userId, action, entityType, entityId, data, ipAddress, options = {}) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: data,
    context: options.context,
    changes: options.changes,
    ip_address: ipAddress,
  });
}

/* ─── Domain writers ────────────────────────────────────────────────────────
 * Thin, intention-revealing wrappers so call sites stay small and every domain
 * stores the same shape of context.
 * ------------------------------------------------------------------------- */

async function logPaymentEvent({
  userId,
  action,
  entityId,
  entityType,
  status,
  previousStatus,
  details,
  context,
  executor,
  ipAddress,
}) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: entityType || MODULES.PAYMENT,
    entity_id: entityId,
    previous_status: previousStatus,
    new_status: status,
    details,
    context: paymentContext(context),
    executor,
    ip_address: ipAddress,
  });
}

async function logOrderEvent({ userId, action, entityId, status, previousStatus, details, context, executor, ipAddress }) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: MODULES.ORDERS,
    entity_id: entityId,
    previous_status: previousStatus,
    new_status: status,
    details,
    context: orderContext(context),
    executor,
    ip_address: ipAddress,
  });
}

async function logProjectEvent({ userId, action, entityId, status, previousStatus, details, context, changes, executor, ipAddress }) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: MODULES.PROJECT,
    entity_id: entityId,
    previous_status: previousStatus,
    new_status: status,
    details,
    context: projectContext(context),
    changes,
    executor,
    ip_address: ipAddress,
  });
}

async function logProductEvent({ userId, action, entityId, entityType, status, previousStatus, details, context, changes, executor, ipAddress }) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: entityType || MODULES.PRODUCTS,
    entity_id: entityId,
    previous_status: previousStatus,
    new_status: status,
    details,
    context: productContext(context),
    changes: changes || buildChanges(details?.old, details?.new),
    executor,
    ip_address: ipAddress,
  });
}

/**
 * Stock movement audit. Always records previous/new quantity, the delta, the
 * movement direction and the source that triggered it, so an administrator can
 * tell a sale apart from a manual correction.
 */
async function logStockMovement({
  userId,
  entityId,
  entityType,
  previousQuantity,
  newQuantity,
  delta,
  movement,
  source,
  context,
  reason,
  executor,
  ipAddress,
}) {
  const changes = {
    stock: { from: previousQuantity ?? null, to: newQuantity ?? null },
  };

  return writeAudit({
    user_id: userId,
    action: 'STOCK_MOVEMENT',
    entity_type: entityType || MODULES.INVENTORY,
    entity_id: entityId,
    details: {
      movement,
      source,
      previous_quantity: previousQuantity ?? null,
      new_quantity: newQuantity ?? null,
      quantity_change: delta ?? null,
      reason: reason || null,
    },
    context: inventoryContext({
      productId: entityId,
      previousQuantity,
      newQuantity,
      delta,
      movement,
      source,
      reason,
      ...context,
    }),
    changes,
    executor,
    ip_address: ipAddress,
  });
}

async function logRefundEvent({ userId, action, entityId, status, previousStatus, details, context, executor, ipAddress }) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: MODULES.REFUND,
    entity_id: entityId,
    previous_status: previousStatus,
    new_status: status,
    details,
    context: refundContext(context),
    executor,
    ip_address: ipAddress,
  });
}

async function logAppointmentEvent({ userId, action, entityId, status, previousStatus, details, context, executor, ipAddress }) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: MODULES.APPOINTMENTS,
    entity_id: entityId,
    previous_status: previousStatus,
    new_status: status,
    details,
    context: appointmentContext(context),
    executor,
    ip_address: ipAddress,
  });
}

async function logUserEvent({ userId, action, entityId, details, context, changes, executor, ipAddress }) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: MODULES.USERS,
    entity_id: entityId,
    details,
    context: userContext(context),
    changes,
    executor,
    ip_address: ipAddress,
  });
}

async function logFulfillmentEvent({ userId, action, entityId, status, previousStatus, details, context, executor, ipAddress }) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: MODULES.FULFILLMENT,
    entity_id: entityId,
    previous_status: previousStatus,
    new_status: status,
    details,
    context: fulfillmentContext(context),
    executor,
    ip_address: ipAddress,
  });
}

/** Point-of-sale sale / void / return. */
async function logPosEvent({ userId, action, entityId, status, previousStatus, details, context, executor, ipAddress }) {
  return writeAudit({
    user_id: userId,
    action,
    entity_type: MODULES.POS,
    entity_id: entityId,
    previous_status: previousStatus,
    new_status: status,
    details,
    context: posContext(context),
    executor,
    ip_address: ipAddress,
  });
}

/* ─── Reads ──────────────────────────────────────────────────────────────── */

const USER_JOIN = `
  FROM audit_logs al
  LEFT JOIN users u ON al.user_id = u.user_id`;

const USER_COLUMNS = `al.*, u.email as user_email, u.role as user_role,
  TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.middle_name, ''), ' ', COALESCE(u.last_name, ''))) as user_name`;

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
    user_id,
    action,
    start_date,
    end_date,
    search,
    limit = 50,
    offset = 0,
  } = filters;

  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (entity_type && entity_type !== 'all') {
    conditions.push(`al.entity_type = $${paramIndex++}`);
    values.push(entity_type);
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
      COALESCE(al.search_text, '') ILIKE $${paramIndex}
      OR COALESCE(u.email, '') ILIKE $${paramIndex}
      OR COALESCE(u.first_name, '') ILIKE $${paramIndex}
      OR COALESCE(u.last_name, '') ILIKE $${paramIndex}
    )`);
    values.push(`%${term}%`);
    paramIndex += 1;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const result = await pool.query(
    `SELECT ${USER_COLUMNS} ${USER_JOIN} ${whereClause}
     ORDER BY al.created_at DESC, al.audit_id DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, safeLimit, safeOffset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) as total ${USER_JOIN} ${whereClause}`,
    values
  );

  return {
    logs: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
    limit: safeLimit,
    offset: safeOffset,
  };
}

async function getAuditLogById(auditId) {
  const result = await pool.query(
    `SELECT ${USER_COLUMNS} ${USER_JOIN} WHERE al.audit_id = $1`,
    [auditId]
  );

  return result.rows[0] || null;
}

async function getAuditLogsByEntity(entityType, entityId) {
  const result = await pool.query(
    `SELECT ${USER_COLUMNS} ${USER_JOIN}
     WHERE al.entity_type = $1 AND al.entity_id = $2
     ORDER BY al.created_at DESC, al.audit_id DESC`,
    [entityType, entityId]
  );

  return result.rows;
}

async function getAuditLogsByModule(entityType, filters = {}) {
  const { limit = 50, offset = 0, start_date, end_date } = filters;

  const conditions = [`al.entity_type = $1`];
  const values = [entityType];
  let paramIndex = 2;

  if (start_date) {
    conditions.push(`al.created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }
  if (end_date) {
    conditions.push(`al.created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await pool.query(
    `SELECT ${USER_COLUMNS} ${USER_JOIN} ${whereClause}
     ORDER BY al.created_at DESC, al.audit_id DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, parseInt(limit, 10), parseInt(offset, 10)]
  );

  return result.rows;
}

async function getAuditLogsByUser(userId, filters = {}) {
  const { limit = 50, offset = 0, start_date, end_date, action } = filters;

  const conditions = [`al.user_id = $1`];
  const values = [userId];
  let paramIndex = 2;

  if (action) {
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

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await pool.query(
    `SELECT ${USER_COLUMNS} ${USER_JOIN} ${whereClause}
     ORDER BY al.created_at DESC, al.audit_id DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, parseInt(limit, 10), parseInt(offset, 10)]
  );

  return result.rows;
}

/**
 * Distinct actions that actually exist in the trail, so the admin filter never
 * offers a value that returns nothing.
 */
async function getAuditActions() {
  const result = await pool.query(
    `SELECT action, COUNT(*)::int AS count FROM audit_logs GROUP BY action ORDER BY count DESC, action ASC`
  );
  return result.rows;
}

async function getActivitySummary(filters = {}) {
  const { start_date, end_date } = filters;

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

/**
 * The audit trail is append-only. There is intentionally no delete, prune or
 * retention helper here: retention is a database/infrastructure concern, and an
 * application-level delete would let the trail used for investigations be
 * rewritten after the fact.
 */

module.exports = {
  MODULES,
  ACTIONS,
  // writer
  createAuditLog,
  writeAudit,
  // backwards-compatible helpers
  logCreate,
  logUpdate,
  logDelete,
  logAction,
  // domain writers
  logPaymentEvent,
  logOrderEvent,
  logProjectEvent,
  logProductEvent,
  logStockMovement,
  logRefundEvent,
  logAppointmentEvent,
  logUserEvent,
  logFulfillmentEvent,
  logPosEvent,
  // reads
  getAuditLogs,
  getAuditLogById,
  getAuditLogsByEntity,
  getAuditLogsByModule,
  getAuditLogsByUser,
  getAuditActions,
  getActivitySummary,
  // re-exported for call sites that want raw context builders
  auditContext: require('./auditContext'),
};