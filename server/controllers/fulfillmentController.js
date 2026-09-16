const { asyncHandler, AppError } = require('../middleware/errorHandler');
const fulfillmentService = require('../services/fulfillmentService');

// Customer or Admin: Submit fulfillment choice for a completed custom build
exports.submitFulfillmentChoice = asyncHandler(async (req, res) => {
  const projectId = req.params.id || req.params.projectId;
  const result = await fulfillmentService.submitFulfillmentRequest(
    projectId,
    req.user.id,
    req.user.role,
    req.validatedData || req.body
  );
  res.json({
    status: 'success',
    success: true,
    data: result,
    message: 'Fulfillment preference submitted successfully',
  });
});

// Customer or Admin: Get fulfillment status / request for a project
exports.getProjectFulfillment = asyncHandler(async (req, res) => {
  const projectId = req.params.id || req.params.projectId;
  const result = await fulfillmentService.getFulfillmentRequestByProjectId(
    projectId,
    req.user.id,
    req.user.role
  );
  res.json({
    status: 'success',
    success: true,
    data: result,
  });
});

// Admin / Staff: List all fulfillment requests
exports.listFulfillmentRequests = asyncHandler(async (req, res) => {
  const result = await fulfillmentService.listFulfillmentRequests(req.query);
  res.json({
    status: 'success',
    success: true,
    data: result.requests,
    pagination: result.pagination,
  });
});

// Admin / Staff: Get single fulfillment request details
exports.getFulfillmentRequestById = asyncHandler(async (req, res) => {
  const requestId = req.params.id || req.params.requestId;
  const result = await fulfillmentService.getFulfillmentRequestById(
    requestId,
    req.user.id,
    req.user.role
  );
  res.json({
    status: 'success',
    success: true,
    data: result,
  });
});

// Admin / Staff: Transition fulfillment status
exports.updateFulfillmentStatus = asyncHandler(async (req, res) => {
  const requestId = req.params.id || req.params.requestId;
  const { status, admin_notes } = req.validatedData || req.body;

  if (!status) {
    throw new AppError('Status is required', 400);
  }

  const result = await fulfillmentService.updateFulfillmentStatus(
    requestId,
    status,
    admin_notes,
    req.user.id,
    req.user.role
  );

  res.json({
    status: 'success',
    success: true,
    data: result,
    message: `Fulfillment status updated to ${status.replace(/_/g, ' ')}`,
  });
});
