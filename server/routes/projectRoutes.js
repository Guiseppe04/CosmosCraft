const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/projectController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.use(authenticateToken);

// === CUSTOMER/USER & ADMIN ROUTES ===
// Users can view hierarchy and update permitted subtasks
router.get('/my', ctrl.getMyProjects);
router.get('/:id/hierarchy', ctrl.getProjectHierarchy);
router.patch('/subtasks/:subtaskId', ctrl.updateSubtask);
router.get('/:id/activity', ctrl.getActivityLogs);

// === ADMIN ONLY ROUTES ===
router.use(authorize('staff', 'admin', 'super_admin'));

router.get('/', ctrl.getProjects);
router.get('/:id', ctrl.getProject);
router.post('/', ctrl.createProject);
router.put('/:id', ctrl.updateProject);
router.delete('/:id', ctrl.deleteProject);
router.put('/:id/team', ctrl.assignTeam);

// Milestone routes
router.post('/:id/milestones', ctrl.createMilestone);
router.put('/milestones/:milestoneId', ctrl.updateMilestone);
router.delete('/milestones/:milestoneId', ctrl.deleteMilestone);

// Subtask routes
router.post('/milestones/:milestoneId/subtasks', ctrl.createSubtask);
router.delete('/subtasks/:subtaskId', ctrl.deleteSubtask);

module.exports = router;
