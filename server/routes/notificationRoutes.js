const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');
const {
  validate,
  validateParams,
  uuidParamSchema,
  createNotificationSchema,
  createBatchNotificationSchema,
} = require('../utils/validation');
const ctrl = require('../controllers/notificationController');

router.use(authenticateToken);

router.get('/', ctrl.getNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.get('/stats', ctrl.getNotificationStats);
router.get('/admin', authorize('staff', 'admin', 'super_admin'), ctrl.getAdminNotifications);
router.get('/:id', validateParams(uuidParamSchema), ctrl.getNotification);
router.patch('/:id/read', validateParams(uuidParamSchema), ctrl.markAsRead);
router.patch('/read-all', ctrl.markAllAsRead);
router.patch('/:id/archive', validateParams(uuidParamSchema), ctrl.archiveNotification);
router.delete('/:id', validateParams(uuidParamSchema), ctrl.deleteNotification);

router.post('/', authorize('admin', 'super_admin'), validate(createNotificationSchema), ctrl.createNotification);
router.post('/batch', authorize('admin', 'super_admin'), validate(createBatchNotificationSchema), ctrl.createBatchNotifications);
router.delete('/cleanup', authorize('admin', 'super_admin'), ctrl.cleanupExpired);

module.exports = router;