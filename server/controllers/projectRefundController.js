const { asyncHandler, AppError } = require('../middleware/errorHandler');
const refundService = require('../services/projectRefundService');

exports.getRefundEligibility = asyncHandler(async (req, res, next) => {
  const result = await refundService.getProjectRefundEligibility(
    req.params.id,
    req.user?.id,
    req.user?.role
  );
  res.json({ status: 'success', data: result });
});

exports.createRefundRequest = asyncHandler(async (req, res, next) => {
  const refund = await refundService.createProjectRefundRequest(
    req.params.id,
    req.user?.id,
    req.user?.role,
    req.validatedData || req.body
  );
  res.status(201).json({ status: 'success', data: refund });
});

exports.updateRefundStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.validatedData || req.body;
  if (!status) throw new AppError('Status is required', 400);
  const refund = await refundService.updateProjectRefundStatus(
    req.params.refundId,
    status,
    req.user?.user_id || req.user?.id,
    req.user?.role,
    req.validatedData || req.body
  );
  res.json({ status: 'success', data: refund });
});