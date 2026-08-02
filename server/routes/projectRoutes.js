const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/projectController');
const { authenticateToken, authorize } = require('../middleware/auth');
const {
  validate,
  validateParams,
  uuidParamSchema,
  projectPartReceiveParamsSchema,
  namedUuidParamSchema,
  createProjectSchema,
  updateProjectSchema,
  assignTeamSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  submitFulfillmentSchema,
  listProjectsSchema,
  createAdvancePaymentSchema,
} = require('../utils/validation');

router.use(authenticateToken);

// === CUSTOMER/USER & ADMIN ROUTES ===
// Users can view hierarchy and update permitted subtasks
router.get('/my', validate(listProjectsSchema, 'query'), ctrl.getMyProjects);
router.get('/:id/hierarchy', validateParams(uuidParamSchema), ctrl.getProjectHierarchy);
router.post('/:id/cancel', validateParams(uuidParamSchema), ctrl.cancelProject);
router.post('/:id/fulfillment', validateParams(uuidParamSchema), validate(submitFulfillmentSchema), ctrl.submitFulfillmentChoice);
router.patch('/subtasks/:subtaskId', validateParams(namedUuidParamSchema('subtaskId')), validate(updateSubtaskSchema), ctrl.updateSubtask);
router.get('/:id/activity', validateParams(uuidParamSchema), ctrl.getActivityLogs);

// Hold / Resume (customer can request, admin can approve)
router.post('/:id/hold', validateParams(uuidParamSchema), ctrl.requestHold);
router.post('/:id/approve-hold', validateParams(uuidParamSchema), ctrl.approveHold);
router.post('/:id/resume', validateParams(uuidParamSchema), ctrl.resumeProject);

// Cancel with options (customer can request with cancel_option)
router.post('/:id/request-cancel', validateParams(uuidParamSchema), ctrl.requestCancel);
router.post('/:id/approve-cancel', validateParams(uuidParamSchema), ctrl.approveCancel);

// Installment schedule
router.get('/:id/installments', validateParams(uuidParamSchema), ctrl.getInstallmentSchedule);

// Advance payment (customer-accessible: pay future installments ahead of their due date)
router.post('/:id/advance-payment', validateParams(uuidParamSchema), validate(createAdvancePaymentSchema), ctrl.createAdvancePayment);

// === ADMIN ONLY ROUTES ===
router.use(authorize('staff', 'admin', 'super_admin'));

router.get('/:id/required-parts', validateParams(uuidParamSchema), ctrl.getProjectRequiredParts);
router.post('/:id/required-parts/:partKey/receive', validateParams(projectPartReceiveParamsSchema), ctrl.receiveRequiredPart);
router.patch('/:id/required-parts/:partKey/toggle-receive', validateParams(projectPartReceiveParamsSchema), ctrl.toggleRequiredPart);
router.post('/:id/procurement-request', validateParams(uuidParamSchema), ctrl.requestProjectProcurement);

router.get('/', validate(listProjectsSchema, 'query'), ctrl.getProjects);

// Default workflow routes (admin only) — must come before :id to avoid conflict
router.get('/default-workflow', ctrl.getDefaultWorkflow);
router.put('/default-workflow', validate(require('../utils/validation').saveDefaultWorkflowSchema), ctrl.updateDefaultWorkflow);
router.post('/:id/apply-default-workflow', ctrl.applyDefaultWorkflowToProject);

router.get('/:id', validateParams(uuidParamSchema), ctrl.getProject);
router.post('/', validate(createProjectSchema), ctrl.createProject);
router.put('/:id', validateParams(uuidParamSchema), validate(updateProjectSchema), ctrl.updateProject);
router.delete('/:id', validateParams(uuidParamSchema), ctrl.deleteProject);
router.patch('/:id/restore', validateParams(uuidParamSchema), ctrl.restoreProject);
router.put('/:id/team', validateParams(uuidParamSchema), validate(assignTeamSchema), ctrl.assignTeam);

// Milestone routes
router.post('/:id/milestones', validateParams(uuidParamSchema), validate(createMilestoneSchema), ctrl.createMilestone);
router.put('/milestones/:milestoneId', validateParams(namedUuidParamSchema('milestoneId')), validate(updateMilestoneSchema), ctrl.updateMilestone);
router.delete('/milestones/:milestoneId', validateParams(namedUuidParamSchema('milestoneId')), ctrl.deleteMilestone);

// Subtask routes
router.post('/milestones/:milestoneId/subtasks', validateParams(namedUuidParamSchema('milestoneId')), validate(createSubtaskSchema), ctrl.createSubtask);
router.get('/subtasks/:subtaskId', validateParams(namedUuidParamSchema('subtaskId')), ctrl.getSubtask);
router.delete('/subtasks/:subtaskId', validateParams(namedUuidParamSchema('subtaskId')), ctrl.deleteSubtask);

// Claim / unclaim / reassign routes
router.post('/:id/claim', ctrl.claimProject);
router.post('/:id/unclaim', ctrl.unclaimProject);
router.post('/:id/reassign', ctrl.reassignProject);
router.get('/staff-claims', ctrl.getStaffClaimStatus);
router.post('/:id/init-workflow', ctrl.initializeWorkflow);

module.exports = router;
