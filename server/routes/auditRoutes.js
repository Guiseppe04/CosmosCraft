const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/auditController');
const { validateAuditFilters } = require('../services/auditFilters');

router.use(authenticateToken);
router.use(authorize('staff', 'admin', 'super_admin'));
router.use((req, res, next) => {
  try { validateAuditFilters(req.query); next(); } catch (error) { next(error); }
});

router.get('/', ctrl.getAuditLogs);
// Must be declared before '/:id' so the literal path is not read as an id.
router.get('/actions', ctrl.getAuditActions);
router.get('/summary', ctrl.getActivitySummary);
router.get('/:id', ctrl.getAuditLog);
router.get('/module/:module', ctrl.getAuditLogsByModule);
router.get('/user/:userId', ctrl.getAuditLogsByUser);
router.get('/entity/:entityType/:entityId', ctrl.getAuditLogsByEntity);
// Read-only by design: no PUT/PATCH/DELETE route exists, so audit rows can only
// ever be appended by database triggers.

module.exports = router;
