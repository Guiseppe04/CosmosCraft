const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/auditController');

router.use(authenticateToken);
router.use(authorize('staff', 'admin', 'super_admin'));

router.get('/', ctrl.getAuditLogs);
router.get('/summary', ctrl.getActivitySummary);
router.get('/:id', ctrl.getAuditLog);
router.get('/module/:module', ctrl.getAuditLogsByModule);
router.get('/user/:userId', ctrl.getAuditLogsByUser);
router.get('/entity/:tableName/:recordId', ctrl.getAuditLogsByEntity);
router.delete('/cleanup', authorize('admin', 'super_admin'), ctrl.cleanupOldLogs);

module.exports = router;