const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/fulfillmentController');
const { authenticateToken, authorize } = require('../middleware/auth');
const {
  validate,
  submitFulfillmentSchema,
  updateFulfillmentStatusSchema,
} = require('../utils/validation');

router.use(authenticateToken);

// Customer & Admin: Project-level fulfillment endpoints
router.get('/project/:projectId', ctrl.getProjectFulfillment);
router.post('/project/:projectId', validate(submitFulfillmentSchema), ctrl.submitFulfillmentChoice);

// Admin & Staff: Fulfillment management endpoints
router.get('/requests', authorize('staff', 'admin', 'super_admin'), ctrl.listFulfillmentRequests);
router.get('/requests/:id', ctrl.getFulfillmentRequestById);
router.patch('/requests/:id/status', authorize('staff', 'admin', 'super_admin'), validate(updateFulfillmentStatusSchema), ctrl.updateFulfillmentStatus);

module.exports = router;
