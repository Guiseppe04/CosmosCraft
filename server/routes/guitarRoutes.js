const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/guitarController');

// ─── CUSTOMIZATIONS ──────────────────────────────────────────────────────────
router.get('/customizations',          authenticateToken, authorize('admin', 'super_admin'), ctrl.getCustomizations);
router.get('/customizations/:id',      authenticateToken, authorize('admin', 'super_admin'), ctrl.getCustomization);
router.put('/customizations/:id',      authenticateToken, authorize('admin', 'super_admin'), ctrl.updateCustomization);
router.delete('/customizations/:id',   authenticateToken, authorize('super_admin'), ctrl.deleteCustomization);

// ─── GUITAR PARTS ────────────────────────────────────────────────────────────
router.get('/parts',       authenticateToken, authorize('staff', 'admin', 'super_admin'), ctrl.getParts);
router.post('/parts',      authenticateToken, authorize('admin', 'super_admin'), ctrl.createPart);
router.put('/parts/:id',   authenticateToken, authorize('admin', 'super_admin'), ctrl.updatePart);
router.delete('/parts/:id', authenticateToken, authorize('admin', 'super_admin'), ctrl.deletePart);

module.exports = router;
