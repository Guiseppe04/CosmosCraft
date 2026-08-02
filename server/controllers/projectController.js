const { asyncHandler, AppError } = require('../middleware/errorHandler');
const projectService = require('../services/projectService');
const defaultWorkflowService = require('../services/defaultWorkflowService');
const installmentService = require('../services/installmentService');

// --- PROJECT BASE ---
exports.getProjects = asyncHandler(async (req, res, next) => {
  const result = await projectService.getAllProjects(req.query);
  res.json({ status: 'success', data: result.projects, pagination: result.pagination });
});

exports.getMyProjects = asyncHandler(async (req, res, next) => {
  const result = await projectService.getMyProjects(req.user.id, req.query);
  res.json({ status: 'success', data: result.projects, pagination: result.pagination });
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

exports.cancelProject = asyncHandler(async (req, res, next) => {
  const project = await projectService.cancelProject(req.params.id, req.user.id, req.user.role);
  if (!project) throw new AppError('Project not found', 404);
  res.json({ status: 'success', data: project, message: 'Project cancelled successfully' });
});

exports.deleteProject = asyncHandler(async (req, res, next) => {
  const project = await projectService.deleteProject(req.params.id, req.user?.id || null);
  if (!project) throw new AppError('Project not found', 404);
  res.json({ status: 'success', data: project });
});

exports.restoreProject = asyncHandler(async (req, res, next) => {
  const project = await projectService.restoreProject(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  res.json({ status: 'success', data: project });
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

exports.getProjectRequiredParts = asyncHandler(async (req, res, next) => {
  const result = await projectService.getProjectRequiredParts(req.params.id);
  res.json({ status: 'success', data: result });
});

exports.receiveRequiredPart = asyncHandler(async (req, res, next) => {
  const result = await projectService.receiveProjectRequiredPart(
    req.params.id,
    req.params.partKey,
    req.body,
    req.user.id
  );
  res.json({ status: 'success', data: result, message: 'Required part marked as received' });
});

exports.toggleRequiredPart = asyncHandler(async (req, res, next) => {
  const result = await projectService.toggleProjectRequiredPart(
    req.params.id,
    req.params.partKey,
    req.body.received,
    req.user.id
  );
  res.json({ status: 'success', data: result, message: 'Required part status updated' });
});

exports.requestProjectProcurement = asyncHandler(async (req, res, next) => {
  const result = await projectService.requestProjectProcurement(req.params.id, req.user.id);
  res.json({ status: 'success', data: result, message: 'Procurement request submitted' });
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

exports.getSubtask = asyncHandler(async (req, res, next) => {
  const subtask = await projectService.getSubtaskById(req.params.subtaskId);
  if (!subtask) throw new AppError('Subtask not found', 404);
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

// --- CLAIM / UNCLAIM / REASSIGN ---
exports.claimProject = asyncHandler(async (req, res, next) => {
  const project = await projectService.claimProject(req.params.id, req.user.id, req.user.role);
  res.json({ status: 'success', data: project, message: 'Project claimed successfully' });
});

exports.unclaimProject = asyncHandler(async (req, res, next) => {
  const project = await projectService.unclaimProject(req.params.id, req.user.id, req.user.role);
  res.json({ status: 'success', data: project, message: 'Project unclaimed successfully' });
});

exports.reassignProject = asyncHandler(async (req, res, next) => {
  const { user_id } = req.body;
  if (!user_id) throw new AppError('user_id is required', 400);
  const project = await projectService.reassignProject(req.params.id, user_id, req.user.id, req.user.role);
  res.json({ status: 'success', data: project, message: 'Project reassigned successfully' });
});

exports.getStaffClaimStatus = asyncHandler(async (req, res, next) => {
  const staff = await projectService.getStaffClaimStatus();
  res.json({ status: 'success', data: staff });
});

exports.initializeWorkflow = asyncHandler(async (req, res, next) => {
  const result = await projectService.initializeManufacturingWorkflow(req.params.id, req.user.id);
  res.json({ status: 'success', data: result });
});

// --- HOLD / RESUME ---
exports.requestHold = asyncHandler(async (req, res, next) => {
  const result = await projectService.requestProjectHold(req.params.id, req.user.id, req.user.role, req.body);
  res.json({ status: 'success', data: result, message: 'Hold request submitted' });
});

exports.approveHold = asyncHandler(async (req, res, next) => {
  const result = await projectService.approveProjectHold(req.params.id, req.user.id, req.body);
  res.json({ status: 'success', data: result, message: 'Hold request processed' });
});

exports.resumeProject = asyncHandler(async (req, res, next) => {
  const result = await projectService.resumeProject(req.params.id, req.user.id, req.user.role);
  res.json({ status: 'success', data: result, message: 'Project resumed' });
});

// --- CANCEL WITH OPTIONS ---
exports.requestCancel = asyncHandler(async (req, res, next) => {
  const result = await projectService.requestProjectCancel(req.params.id, req.user.id, req.user.role, req.body);
  res.json({ status: 'success', data: result, message: 'Cancellation request submitted' });
});

exports.approveCancel = asyncHandler(async (req, res, next) => {
  const result = await projectService.approveProjectCancel(req.params.id, req.user.id, req.body);
  res.json({ status: 'success', data: result, message: 'Cancellation request processed' });
});

// --- INSTALLMENT SCHEDULE ---
exports.getInstallmentSchedule = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?.user_id;
  const result = await projectService.getInstallmentSchedule(req.params.id, userId, req.user?.role);
  res.json({ status: 'success', data: result });
});

// --- ADVANCE PAYMENT ---
// Allows a customer to pay one or more future installments ahead of their due date.
// Accessible to any authenticated user who owns the project.
exports.createAdvancePayment = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?.user_id;
  const { schedule_ids, payment_method, amount, reference_number, proof_url, currency } = req.validatedData || req.body;

  const result = await installmentService.createAdvancePayment(req.params.id, schedule_ids, {
    user_id: userId,
    role: req.user?.role || 'customer',
    method: payment_method,
    amount,
    reference_number,
    proof_url,
    currency,
  });

  res.status(201).json({
    status: 'success',
    data: result,
    message: 'Advance payment processed successfully',
  });
});

// --- DEFAULT WORKFLOW ---
exports.getDefaultWorkflow = asyncHandler(async (req, res, next) => {
  const workflow = await defaultWorkflowService.getDefaultWorkflow();
  res.json({ status: 'success', data: workflow });
});

exports.updateDefaultWorkflow = asyncHandler(async (req, res, next) => {
  const { steps } = req.body;
  if (!Array.isArray(steps)) {
    throw new AppError('steps array is required', 400);
  }
  const workflow = await defaultWorkflowService.saveDefaultWorkflow(steps);
  res.json({ status: 'success', data: workflow, message: 'Default workflow updated successfully' });
});

exports.applyDefaultWorkflowToProject = asyncHandler(async (req, res, next) => {
  const result = await defaultWorkflowService.applyDefaultWorkflowToProject(req.params.id, req.user.id);
  res.json({ status: 'success', data: result });
});
