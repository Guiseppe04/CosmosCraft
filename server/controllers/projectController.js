const { asyncHandler, AppError } = require('../middleware/errorHandler');
const projectService = require('../services/projectService');

// --- PROJECT BASE ---
exports.getProjects = asyncHandler(async (req, res, next) => {
  const projects = await projectService.getProjects();
  res.json({ status: 'success', data: projects });
});

exports.getMyProjects = asyncHandler(async (req, res, next) => {
  const projects = await projectService.getMyProjects(req.user.id);
  res.json({ status: 'success', data: projects });
});

exports.getProject = asyncHandler(async (req, res, next) => {
  const project = await projectService.getProjectById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  res.json({ status: 'success', data: project });
});

exports.createProject = asyncHandler(async (req, res, next) => {
  const project = await projectService.createProject(req.body);
  res.status(201).json({ status: 'success', data: project });
});

exports.updateProject = asyncHandler(async (req, res, next) => {
  const project = await projectService.updateProject(req.params.id, req.body);
  if (!project) throw new AppError('Project not found', 404);
  res.json({ status: 'success', data: project });
});

exports.deleteProject = asyncHandler(async (req, res, next) => {
  const project = await projectService.deleteProject(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  res.json({ status: 'success', data: null });
});

exports.assignTeam = asyncHandler(async (req, res, next) => {
  const { user_ids } = req.body;
  await projectService.assignTeam(req.params.id, user_ids);
  res.json({ status: 'success', message: 'Team successfully assigned' });
});

// --- PROJECT HIERARCHY ---
exports.getProjectHierarchy = asyncHandler(async (req, res, next) => {
  const hierarchy = await projectService.getProjectHierarchy(req.params.id);
  if (!hierarchy) throw new AppError('Project not found', 404);
  res.json({ status: 'success', data: hierarchy });
});

exports.submitFulfillmentChoice = asyncHandler(async (req, res, next) => {
  const result = await projectService.submitFulfillmentChoice(
    req.params.id,
    req.user.id,
    req.user.role,
    req.body
  );
  res.json({ status: 'success', data: result, message: 'Fulfillment preference saved' });
});

// --- MILESTONES ---
exports.createMilestone = asyncHandler(async (req, res, next) => {
  const milestone = await projectService.addMilestone(req.params.id, req.body, req.user.id);
  res.status(201).json({ status: 'success', data: milestone });
});

exports.updateMilestone = asyncHandler(async (req, res, next) => {
  const milestone = await projectService.updateMilestone(req.params.milestoneId, req.body, req.user.id);
  res.json({ status: 'success', data: milestone });
});

exports.deleteMilestone = asyncHandler(async (req, res, next) => {
  await projectService.deleteMilestone(req.params.milestoneId, req.user.id);
  res.json({ status: 'success', data: null });
});

// --- SUBTASKS ---
exports.createSubtask = asyncHandler(async (req, res, next) => {
  const subtask = await projectService.addSubtask(req.params.milestoneId, req.body, req.user.id);
  res.status(201).json({ status: 'success', data: subtask });
});

exports.updateSubtask = asyncHandler(async (req, res, next) => {
  const subtask = await projectService.updateSubtaskStatus(req.params.subtaskId, req.body, req.user.id, req.user.role);
  res.json({ status: 'success', data: subtask });
});

exports.deleteSubtask = asyncHandler(async (req, res, next) => {
  await projectService.deleteSubtask(req.params.subtaskId, req.user.id);
  res.json({ status: 'success', data: null });
});

// --- ACTIVITY LOGS ---
exports.getActivityLogs = asyncHandler(async (req, res, next) => {
  const logs = await projectService.getActivityLogs(req.params.id);
  res.json({ status: 'success', data: logs });
});
