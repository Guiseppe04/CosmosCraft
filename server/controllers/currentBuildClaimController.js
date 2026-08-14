const { asyncHandler, AppError } = require('../middleware/errorHandler');
const claimService = require('../services/currentBuildClaimService');

// --- BUILD STATE PREVIEW (before cancellation) ---
exports.getBuildStatePreview = asyncHandler(async (req, res) => {
  const result = await claimService.getBuildStatePreview(
    req.params.id,
    req.user?.id,
    req.user?.role
  );
  res.json({ status: 'success', data: result });
});

// --- GET CLAIM FOR A PROJECT ---
exports.getBuildClaim = asyncHandler(async (req, res) => {
  const claim = await claimService.getClaimByProjectId(
    req.params.id,
    req.user?.id,
    req.user?.role
  );
  res.json({ status: 'success', data: claim });
});

// --- CUSTOMER SELECTS CLAIM METHOD ---
exports.selectClaimMethod = asyncHandler(async (req, res) => {
  const result = await claimService.submitClaimMethod(
    req.params.id,
    req.user.id,
    req.user.role,
    req.validatedData || req.body
  );
  res.json({ status: 'success', data: result, message: 'Claim method selected successfully' });
});

// --- ADMIN CONFIRMS BUILD STATE ---
exports.confirmBuildState = asyncHandler(async (req, res) => {
  const result = await claimService.confirmBuildState(
    req.params.id,
    req.user.id,
    req.validatedData || req.body
  );
  res.json({ status: 'success', data: result, message: 'Build state confirmed' });
});

// --- ADMIN ARRANGES COURIER ---
exports.arrangeCourier = asyncHandler(async (req, res) => {
  const result = await claimService.arrangeCourier(
    req.params.id,
    req.user.id,
    req.validatedData || req.body
  );
  res.json({ status: 'success', data: result, message: 'Courier arranged successfully' });
});

// --- ADMIN UPDATES CLAIM STATUS ---
exports.updateClaimStatus = asyncHandler(async (req, res) => {
  const { status } = req.validatedData || req.body;
  if (!status) throw new AppError('Status is required', 400);
  const result = await claimService.updateClaimStatus(
    req.params.id,
    req.user.id,
    status,
    req.validatedData || req.body
  );
  res.json({ status: 'success', data: result, message: 'Claim status updated' });
});

// --- CUSTOMER MARKS AS RECEIVED ---
exports.markAsReceived = asyncHandler(async (req, res) => {
  const result = await claimService.markAsReceived(
    req.params.id,
    req.user.id,
    req.user.role
  );
  res.json({ status: 'success', data: result, message: 'Guitar marked as received' });
});

// --- ADMIN MARKS AS PICKED UP ---
exports.markAsPickedUp = asyncHandler(async (req, res) => {
  const result = await claimService.markAsPickedUp(
    req.params.id,
    req.user.id,
    req.validatedData || req.body
  );
  res.json({ status: 'success', data: result, message: 'Guitar marked as picked up' });
});

// --- ADMIN LIST ALL CLAIMS ---
exports.getAllClaims = asyncHandler(async (req, res) => {
  const result = await claimService.getAllClaims(req.query);
  res.json({ status: 'success', data: result.claims, pagination: result.pagination });
});
