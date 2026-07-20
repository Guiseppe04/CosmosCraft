const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/projectController');
const { authenticateToken, authorize } = require('../middleware/auth');
const {
  validate,
  validateParams,
  uuidParamSchema,
  namedUuidParamSchema,
  createProjectSchema,
  updateProjectSchema,
  assignTeamSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  submitFulfillmentSchema,
} = require('../utils/validation');

router.use(authenticateToken);

// === CUSTOMER/USER & ADMIN ROUTES ===
// Users can view hierarchy and update permitted subtasks
router.get('/my', ctrl.getMyProjects);
router.get('/:id/hierarchy', validateParams(uuidParamSchema), ctrl.getProjectHierarchy);
router.post('/:id/cancel', validateParams(uuidParamSchema), ctrl.cancelProject);
router.post('/:id/fulfillment', validateParams(uuidParamSchema), validate(submitFulfillmentSchema), ctrl.submitFulfillmentChoice);
router.patch('/subtasks/:subtaskId', validateParams(namedUuidParamSchema('subtaskId')), validate(updateSubtaskSchema), ctrl.updateSubtask);
router.get('/:id/activity', validateParams(uuidParamSchema), ctrl.getActivityLogs);

// === ADMIN ONLY ROUTES ===
router.use(authorize('staff', 'admin', 'super_admin'));

router.get('/', ctrl.getProjects);
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
router.delete('/subtasks/:subtaskId', validateParams(namedUuidParamSchema('subtaskId')), ctrl.deleteSubtask);

module.exports = router;
