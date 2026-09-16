const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/projectController');
const refundCtrl = require('../controllers/projectRefundController');
const claimCtrl = require('../controllers/currentBuildClaimController');
const installmentCtrl = require('../controllers/installmentController');
const { authenticateToken, authorize } = require('../middleware/auth');
const {
  validate,
  validateParams,
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
  requestProjectCancelSchema,
  listProjectsSchema,
  createProjectRefundRequestSchema,
  updateRefundStatusSchema,
  selectClaimMethodSchema,
  confirmBuildStateSchema,
  arrangeCourierSchema,
  updateBuildClaimStatusSchema,
} = require('../utils/validation');

const uploadsDir = path.join(__dirname, '../uploads/proofs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'proof-' + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) and PDF are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter,
});

router.use(authenticateToken);

// === CUSTOMER/USER & ADMIN ROUTES ===
// Users can view hierarchy and update permitted subtasks
router.get('/my', validate(listProjectsSchema, 'query'), ctrl.getMyProjects);
router.get('/:id/hierarchy', ctrl.getProjectHierarchy);
router.post('/:id/cancel', ctrl.cancelProject);
router.get('/:id/fulfillment', ctrl.getProjectFulfillment);
router.post('/:id/fulfillment', validate(submitFulfillmentSchema), ctrl.submitFulfillmentChoice);
router.patch('/subtasks/:subtaskId', validateParams(namedUuidParamSchema('subtaskId')), validate(updateSubtaskSchema), ctrl.updateSubtask);
router.get('/:id/activity', ctrl.getActivityLogs);

// Hold / Resume (customer can request, admin can approve)
router.post('/:id/hold', ctrl.requestHold);
router.post('/:id/approve-hold', ctrl.approveHold);
router.post('/:id/resume', ctrl.resumeProject);

// Cancel with options (customer can request with cancel_option)
router.post('/:id/request-cancel', validate(requestProjectCancelSchema), ctrl.requestCancel);
// Customer withdraws a pending cancellation request
router.post('/:id/withdraw-cancel-request', ctrl.cancelCancelRequest);
// Approve/reject a cancellation request — staff+ only (admin review)
router.post('/:id/approve-cancel', authorize('staff', 'admin', 'super_admin'), ctrl.approveCancel);

// Current Build Claim (customer-accessible routes)
router.get('/:id/build-state-preview', claimCtrl.getBuildStatePreview);
router.get('/:id/build-claim', claimCtrl.getBuildClaim);
router.post('/:id/build-claim/select-method', validate(selectClaimMethodSchema), claimCtrl.selectClaimMethod);
router.post('/:id/build-claim/mark-received', claimCtrl.markAsReceived);

// Project Refunds & Cancellation Settlement (customer eligibility + request; admin status update)
router.get('/:id/refund-eligibility', refundCtrl.getRefundEligibility);
router.get('/:id/cancellation-settlement', refundCtrl.getCancellationSettlement);
router.post('/:id/refund-request', validate(createProjectRefundRequestSchema), refundCtrl.createRefundRequest);
router.put('/refunds/:refundId/status', authorize('staff', 'admin', 'super_admin'), validate(updateRefundStatusSchema), refundCtrl.updateRefundStatus);

// Installment schedule & customer payment
router.get('/:id/installments', ctrl.getInstallmentSchedule);
router.post('/:id/installments/:scheduleId/pay', upload.single('proof'), installmentCtrl.submitCustomerInstallmentPayment);

// === ADMIN ONLY ROUTES ===
router.use(authorize('staff', 'admin', 'super_admin'));

router.get('/:id/required-parts', ctrl.getProjectRequiredParts);
router.post('/:id/required-parts/:partKey/receive', validateParams(projectPartReceiveParamsSchema), ctrl.receiveRequiredPart);
router.patch('/:id/required-parts/:partKey/toggle-receive', validateParams(projectPartReceiveParamsSchema), ctrl.toggleRequiredPart);
router.post('/:id/procurement-request', ctrl.requestProjectProcurement);

router.get('/', validate(listProjectsSchema, 'query'), ctrl.getProjects);

// Default workflow routes (admin only) — must come before :id to avoid conflict
router.get('/default-workflow', ctrl.getDefaultWorkflow);
router.put('/default-workflow', validate(require('../utils/validation').saveDefaultWorkflowSchema), ctrl.updateDefaultWorkflow);
router.post('/:id/apply-default-workflow', ctrl.applyDefaultWorkflowToProject);

// Static routes must come before /:id to avoid being treated as a project ID
router.get('/archived', ctrl.getArchivedProjects);
router.get('/staff-claims', ctrl.getStaffClaimStatus);
router.get('/:id', ctrl.getProject);
router.post('/', validate(createProjectSchema), ctrl.createProject);
router.put('/:id', validate(updateProjectSchema), ctrl.updateProject);
router.delete('/:id', ctrl.deleteProject);
router.patch('/:id/restore', ctrl.restoreProject);
router.put('/:id/team', validate(assignTeamSchema), ctrl.assignTeam);

// Milestone routes
router.post('/:id/milestones', validate(createMilestoneSchema), ctrl.createMilestone);
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
router.post('/:id/init-workflow', ctrl.initializeWorkflow);

// Current Build Claim (admin-only routes)
router.get('/build-claims', claimCtrl.getAllClaims);
router.post('/:id/build-claim/confirm-build', validate(confirmBuildStateSchema), claimCtrl.confirmBuildState);
router.post('/:id/build-claim/arrange-courier', validate(arrangeCourierSchema), claimCtrl.arrangeCourier);
router.patch('/:id/build-claim/status', validate(updateBuildClaimStatusSchema), claimCtrl.updateClaimStatus);
router.post('/:id/build-claim/mark-picked-up', claimCtrl.markAsPickedUp);

module.exports = router;
