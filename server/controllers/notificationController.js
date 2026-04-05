const notificationService = require('../services/notificationService');
const { AppError } = require('../middleware/errorHandler');
const Joi = require('joi');

const validate = (data, schema) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    const messages = error.details.map(detail => detail.message).join('; ');
    throw new AppError(messages, 400);
  }
  return value;
};

const createNotificationSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  title: Joi.string().min(1).max(200).required(),
  message: Joi.string().max(5000).optional(),
  type: Joi.string().valid('order_update', 'appointment_reminder', 'payment', 'general', 'system', 'promotional').optional(),
  related_entity_id: Joi.string().uuid().optional(),
  related_entity_type: Joi.string().valid('orders', 'appointments', 'payments', 'products', 'services', 'users').optional(),
  expires_at: Joi.date().iso().optional(),
});

const createBatchSchema = Joi.object({
  user_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
  title: Joi.string().min(1).max(200).required(),
  message: Joi.string().max(5000).optional(),
  type: Joi.string().valid('order_update', 'appointment_reminder', 'payment', 'general', 'system', 'promotional').optional(),
  related_entity_id: Joi.string().uuid().optional(),
  related_entity_type: Joi.string().valid('orders', 'appointments', 'payments', 'products', 'services', 'users').optional(),
});

const updateNotificationSchema = Joi.object({
  status: Joi.string().valid('read', 'archived').optional(),
});

exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { type, status, limit = 20, offset = 0, start_date, end_date } = req.query;

    const result = await notificationService.getNotifications(userId, {
      type,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
      start_date,
      end_date,
    });

    res.json({
      status: 'success',
      data: result.notifications,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getNotification = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const notification = await notificationService.getNotificationById(req.params.id, userId);

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    res.json({ status: 'success', data: notification });
  } catch (err) {
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const notification = await notificationService.markAsRead(req.params.id, userId);
    res.json({ status: 'success', data: notification });
  } catch (err) {
    next(err);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const result = await notificationService.markAllAsRead(userId);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
};

exports.archiveNotification = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const notification = await notificationService.archiveNotification(req.params.id, userId);
    res.json({ status: 'success', data: notification });
  } catch (err) {
    next(err);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const result = await notificationService.deleteNotification(req.params.id, userId);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const count = await notificationService.getUnreadCount(userId);
    res.json({ status: 'success', data: { unread_count: count } });
  } catch (err) {
    next(err);
  }
};

exports.getNotificationStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const stats = await notificationService.getNotificationStats(userId);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
};

exports.createNotification = async (req, res, next) => {
  try {
    const validated = validate(req.body, createNotificationSchema);
    const notification = await notificationService.createNotification(validated);
    res.status(201).json({ status: 'success', data: notification });
  } catch (err) {
    next(err);
  }
};

exports.createBatchNotifications = async (req, res, next) => {
  try {
    const validated = validate(req.body, createBatchSchema);
    const result = await notificationService.createBatchNotifications(validated.user_ids, {
      title: validated.title,
      message: validated.message,
      type: validated.type,
      related_entity_id: validated.related_entity_id,
      related_entity_type: validated.related_entity_type,
    });
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

exports.getAdminNotifications = async (req, res, next) => {
  try {
    const { type, status, user_id, limit = 50, offset = 0 } = req.query;

    const result = await notificationService.getAdminNotifications({
      type,
      status,
      user_id,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      status: 'success',
      data: result.notifications,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.cleanupExpired = async (req, res, next) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      throw new AppError('Admin access required', 403);
    }

    const result = await notificationService.cleanupExpiredNotifications();
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
};