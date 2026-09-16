const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const MODULES = {
  USERS: 'users',
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  APPOINTMENTS: 'appointments',
  CART: 'cart',
  SERVICES: 'services',
  CUSTOMIZATIONS: 'customizations',
  PRODUCTS: 'products',
  RBAC: 'rbac',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  PROJECT: 'project',
  INVENTORY: 'inventory',
  POS: 'pos',
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

async function createAuditLog({ user_id, action, entity_type, entity_id, previous_status, new_status, details, ip_address, user_agent }) {
  const result = await pool.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, previous_status, new_status, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [user_id, action, entity_type, entity_id, previous_status || null, new_status || null, details ? JSON.stringify(details) : '{}', ip_address || null, user_agent || null]
  );
  return result.rows[0];
}

async function logCreate(userId, entityType, entityId, newData, ipAddress) {
  return createAuditLog({
    user_id: userId,
    action: ACTIONS.CREATE,
    entity_type: entityType,
    entity_id: entityId,
    details: newData,
    ip_address: ipAddress,
  });
}

async function logUpdate(userId, entityType, entityId, oldData, newData, ipAddress) {
  return createAuditLog({
    user_id: userId,
    action: ACTIONS.UPDATE,
    entity_type: entityType,
    entity_id: entityId,
    previous_status: oldData?.status,
    new_status: newData?.status,
    details: { old: oldData, new: newData },
    ip_address: ipAddress,
  });
}

async function logDelete(userId, entityType, entityId, oldData, ipAddress) {
  return createAuditLog({
    user_id: userId,
    action: ACTIONS.DELETE,
    entity_type: entityType,
    entity_id: entityId,
    details: oldData,
    ip_address: ipAddress,
  });
}

async function logAction(userId, action, entityType, entityId, data, ipAddress) {
  return createAuditLog({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: data,
    ip_address: ipAddress,
  });
}

async function getAuditLogs(filters = {}) {
  const { entity_type, user_id, action, start_date, end_date, limit = 50, offset = 0 } = filters;

  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (entity_type) {
    conditions.push(`entity_type = $${paramIndex++}`);
    values.push(entity_type);
  }
  if (user_id) {
    conditions.push(`user_id = $${paramIndex++}`);
    values.push(user_id);
  }
  if (action) {
    conditions.push(`action = $${paramIndex++}`);
    values.push(action);
  }
  if (start_date) {
    conditions.push(`created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }
  if (end_date) {
    conditions.push(`created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT al.*, u.email as user_email, 
      CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as user_name
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.user_id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, parseInt(limit), parseInt(offset)]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
    values
  );

  return {
    logs: result.rows,
    total: parseInt(countResult.rows[0].total),
    limit: parseInt(limit),
    offset: parseInt(offset),
  };
}

async function getAuditLogById(auditId) {
  const result = await pool.query(
    `SELECT al.*, u.email as user_email,
      CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as user_name
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.user_id
     WHERE al.audit_id = $1`,
    [auditId]
  );

  return result.rows[0] || null;
}

async function getAuditLogsByEntity(entityType, entityId) {
  const result = await pool.query(
    `SELECT al.*, u.email as user_email,
      CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as user_name
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.user_id
     WHERE al.entity_type = $1 AND al.entity_id = $2
     ORDER BY al.created_at DESC`,
    [entityType, entityId]
  );

  return result.rows;
}

async function getAuditLogsByModule(entityType, filters = {}) {
  const { limit = 50, offset = 0, start_date, end_date } = filters;

  let conditions = [`entity_type = $1`];
  const values = [entityType];
  let paramIndex = 2;

  if (start_date) {
    conditions.push(`created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }
  if (end_date) {
    conditions.push(`created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await pool.query(
    `SELECT al.*, u.email as user_email,
      CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as user_name
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.user_id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, parseInt(limit), parseInt(offset)]
  );

  return result.rows;
}

async function getAuditLogsByUser(userId, filters = {}) {
  const { limit = 50, offset = 0, start_date, end_date, action } = filters;

  let conditions = [`al.user_id = $1`];
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
    `SELECT al.*, u.email as user_email,
      CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as user_name
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.user_id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, parseInt(limit), parseInt(offset)]
  );

  return result.rows;
}

async function getActivitySummary(filters = {}) {
  const { start_date, end_date } = filters;

  let conditions = [];
  const values = [];
  let paramIndex = 1;

  if (start_date) {
    conditions.push(`created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }
  if (end_date) {
    conditions.push(`created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT 
        entity_type as module,
        action,
        COUNT(*) as count
     FROM audit_logs
     ${whereClause}
     GROUP BY entity_type, action
     ORDER BY count DESC`,
    values
  );

  const userActivity = await pool.query(
    `SELECT al.user_id, u.email,
      CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as name,
      COUNT(*) as actions
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.user_id
     ${whereClause}
     GROUP BY al.user_id, u.email, u.first_name, u.middle_name, u.last_name
     ORDER BY actions DESC
     LIMIT 10`,
    values
  );

  return {
    by_module_action: result.rows,
    top_users: userActivity.rows,
  };
}

async function cleanupOldLogs(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await pool.query(
    `DELETE FROM audit_logs WHERE created_at < $1 RETURNING audit_id`,
    [cutoffDate]
  );

  return { deleted: result.rowCount };
}

module.exports = {
  MODULES,
  ACTIONS,
  createAuditLog,
  logCreate,
  logUpdate,
  logDelete,
  logAction,
  getAuditLogs,
  getAuditLogById,
  getAuditLogsByEntity,
  getAuditLogsByModule,
  getAuditLogsByUser,
  getActivitySummary,
  cleanupOldLogs,
};