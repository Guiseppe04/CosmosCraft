const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const NOTIFICATION_TYPES = {
  ORDER: 'order_update',
  APPOINTMENT: 'appointment_reminder',
  PAYMENT: 'payment',
  GENERAL: 'general',
  SYSTEM: 'system',
  PROMOTIONAL: 'promotional',
};

const NOTIFICATION_STATUS = {
  UNREAD: 'unread',
  READ: 'read',
  ARCHIVED: 'archived',
};

async function createNotification({ user_id, title, message, type, related_entity_id, related_entity_type, expires_at }) {
  const userResult = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [user_id]);
  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  if (related_entity_id && related_entity_type) {
    const exists = await checkRelatedEntity(related_entity_type, related_entity_id);
    if (!exists) {
      throw new AppError(`Related entity (${related_entity_type}) not found`, 404);
    }
  }

  const result = await pool.query(
    `INSERT INTO notifications (user_id, title, message, notification_type, related_entity_id, related_entity_type, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [user_id, title, message || null, type || NOTIFICATION_TYPES.GENERAL, related_entity_id, related_entity_type, expires_at || null]
  );

  return result.rows[0];
}

async function createBatchNotifications(userIds, { title, message, type, related_entity_id, related_entity_type }) {
  if (!userIds || userIds.length === 0) {
    throw new AppError('At least one user ID is required', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const validUsers = [];
    for (const userId of userIds) {
      const userResult = await client.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
      if (userResult.rows.length > 0) {
        validUsers.push(userId);
      }
    }

    if (validUsers.length === 0) {
      throw new AppError('No valid users found', 400);
    }

    const notifications = [];
    for (const userId of validUsers) {
      const result = await client.query(
        `INSERT INTO notifications (user_id, title, message, notification_type, related_entity_id, related_entity_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, title, message || null, type || NOTIFICATION_TYPES.GENERAL, related_entity_id, related_entity_type]
      );
      notifications.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return { created: notifications.length, notifications };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function checkRelatedEntity(entityType, entityId) {
  const tables = {
    orders: 'orders',
    appointments: 'appointments',
    payments: 'payments',
    products: 'products',
    services: 'services',
    users: 'users',
  };

  const table = tables[entityType.toLowerCase()];
  if (!table) return true;

  const result = await pool.query(
    `SELECT 1 FROM ${table} WHERE ${getIdColumn(table)} = $1`,
    [entityId]
  );

  return result.rows.length > 0;
}

function getIdColumn(table) {
  const idColumns = {
    orders: 'order_id',
    appointments: 'appointment_id',
    payments: 'payment_id',
    products: 'product_id',
    services: 'service_id',
    users: 'user_id',
  };
  return idColumns[table] || 'id';
}

async function getNotifications(userId, filters = {}) {
  const { type, status, limit = 20, offset = 0, start_date, end_date } = filters;

  let conditions = ['n.user_id = $1'];
  const values = [userId];
  let paramIndex = 2;

  if (type) {
    conditions.push(`n.notification_type = $${paramIndex++}`);
    values.push(type);
  }

  if (status === 'unread') {
    conditions.push('n.is_read = false');
  } else if (status === 'read') {
    conditions.push('n.is_read = true');
  }

  if (start_date) {
    conditions.push(`n.created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }

  if (end_date) {
    conditions.push(`n.created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const whereClause = conditions.join(' AND ');

  const result = await pool.query(
    `SELECT n.*, 
      CASE 
        WHEN n.is_read = false THEN 'unread'
        WHEN n.read_at IS NOT NULL THEN 'read'
        ELSE 'archived'
      END as status
     FROM notifications n
     WHERE ${whereClause}
     ORDER BY n.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM notifications n WHERE ${whereClause}`,
    values.slice(0, paramIndex - 2)
  );

  return {
    notifications: result.rows,
    total: parseInt(countResult.rows[0].total),
    limit,
    offset,
  };
}

async function getNotificationById(notificationId, userId) {
  const result = await pool.query(
    `SELECT n.*,
      CASE 
        WHEN n.is_read = false THEN 'unread'
        WHEN n.read_at IS NOT NULL THEN 'read'
        ELSE 'archived'
      END as status
     FROM notifications n
     WHERE n.notification_id = $1 AND n.user_id = $2`,
    [notificationId, userId]
  );

  return result.rows[0] || null;
}

async function markAsRead(notificationId, userId) {
  const notification = await getNotificationById(notificationId, userId);
  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  const result = await pool.query(
    `UPDATE notifications SET is_read = true, read_at = now()
     WHERE notification_id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );

  return result.rows[0];
}

async function markAllAsRead(userId) {
  const result = await pool.query(
    `UPDATE notifications SET is_read = true, read_at = now()
     WHERE user_id = $1 AND is_read = false
     RETURNING *`,
    [userId]
  );

  return { updated: result.rowCount };
}

async function archiveNotification(notificationId, userId) {
  const notification = await getNotificationById(notificationId, userId);
  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  const result = await pool.query(
    `UPDATE notifications SET is_read = true, read_at = now()
     WHERE notification_id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );

  return result.rows[0];
}

async function deleteNotification(notificationId, userId) {
  const result = await pool.query(
    `DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2 RETURNING *`,
    [notificationId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Notification not found', 404);
  }

  return { message: 'Notification deleted' };
}

async function getUnreadCount(userId) {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );

  return parseInt(result.rows[0].count);
}

async function getAdminNotifications(filters = {}) {
  const { type, status, user_id, limit = 50, offset = 0 } = filters;

  let conditions = [];
  const values = [];
  let paramIndex = 1;

  if (type) {
    conditions.push(`n.notification_type = $${paramIndex++}`);
    values.push(type);
  }

  if (status === 'unread') {
    conditions.push('n.is_read = false');
  } else if (status === 'read') {
    conditions.push('n.is_read = true');
  }

  if (user_id) {
    conditions.push(`n.user_id = $${paramIndex++}`);
    values.push(user_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT n.*, u.email as user_email, 
      CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as user_name
     FROM notifications n
     LEFT JOIN users u ON n.user_id = u.user_id
     ${whereClause}
     ORDER BY n.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
    values
  );

  return {
    notifications: result.rows,
    total: parseInt(countResult.rows[0].total),
    limit,
    offset,
  };
}

async function createOrderNotification(userId, orderId, status) {
  const statusMessages = {
    pending: 'Your order has been received and is pending payment.',
    processing: 'Your order is now being processed.',
    completed: 'Your order has been completed. Thank you for your purchase!',
    cancelled: 'Your order has been cancelled.',
  };

  return createNotification({
    user_id: userId,
    title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: statusMessages[status] || `Your order status has been updated to: ${status}`,
    type: NOTIFICATION_TYPES.ORDER,
    related_entity_id: orderId,
    related_entity_type: 'orders',
  });
}

async function createAppointmentNotification(userId, appointmentId, status, serviceName) {
  const statusMessages = {
    pending: `Your appointment for ${serviceName} is pending approval.`,
    approved: `Your appointment for ${serviceName} has been approved.`,
    completed: `Your appointment for ${serviceName} has been completed.`,
    cancelled: `Your appointment for ${serviceName} has been cancelled.`,
  };

  return createNotification({
    user_id: userId,
    title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: statusMessages[status] || `Your appointment status has been updated to: ${status}`,
    type: NOTIFICATION_TYPES.APPOINTMENT,
    related_entity_id: appointmentId,
    related_entity_type: 'appointments',
  });
}

async function createPaymentNotification(userId, paymentId, status, amount) {
  const statusMessages = {
    pending: `Payment of ₱${amount} is pending. Please upload proof of payment.`,
    for_verification: `Your payment of ₱${amount} is being verified.`,
    verified: `Your payment of ₱${amount} has been verified successfully.`,
    rejected: `Your payment of ₱${amount} has been rejected. Please try again.`,
    refunded: `Your payment of ₱${amount} has been refunded.`,
  };

  return createNotification({
    user_id: userId,
    title: `Payment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: statusMessages[status] || `Your payment status has been updated to: ${status}`,
    type: NOTIFICATION_TYPES.PAYMENT,
    related_entity_id: paymentId,
    related_entity_type: 'payments',
  });
}

async function createGeneralNotification(userId, title, message) {
  return createNotification({
    user_id: userId,
    title,
    message,
    type: NOTIFICATION_TYPES.GENERAL,
  });
}

async function cleanupExpiredNotifications() {
  const result = await pool.query(
    `DELETE FROM notifications 
     WHERE expires_at IS NOT NULL AND expires_at < now()
     RETURNING notification_id`
  );

  return { deleted: result.rowCount };
}

async function getNotificationStats(userId) {
  const result = await pool.query(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread,
       SUM(CASE WHEN is_read = true AND read_at IS NOT NULL THEN 1 ELSE 0 END) as read,
       COUNT(CASE WHEN notification_type = 'order_update' THEN 1 END) as orders,
       COUNT(CASE WHEN notification_type = 'appointment_reminder' THEN 1 END) as appointments,
       COUNT(CASE WHEN notification_type = 'payment' THEN 1 END) as payments
     FROM notifications 
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0];
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  createNotification,
  createBatchNotifications,
  getNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
  getUnreadCount,
  getAdminNotifications,
  createOrderNotification,
  createAppointmentNotification,
  createPaymentNotification,
  createGeneralNotification,
  cleanupExpiredNotifications,
  getNotificationStats,
};