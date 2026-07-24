const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/notificationController');

router.use(authenticateToken);

router.get('/', ctrl.getNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.get('/stats', ctrl.getNotificationStats);
router.get('/admin', authorize('staff', 'admin', 'super_admin'), ctrl.getAdminNotifications);
router.get('/:id', ctrl.getNotification);
router.patch('/:id/read', ctrl.markAsRead);
router.patch('/read-all', ctrl.markAllAsRead);
router.patch('/:id/archive', ctrl.archiveNotification);
router.delete('/:id', ctrl.deleteNotification);

router.post('/', authorize('admin', 'super_admin'), ctrl.createNotification);
router.post('/batch', authorize('admin', 'super_admin'), ctrl.createBatchNotifications);
router.delete('/cleanup', authorize('admin', 'super_admin'), ctrl.cleanupExpired);

module.exports = router;