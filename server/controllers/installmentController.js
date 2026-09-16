const { asyncHandler, AppError } = require('../middleware/errorHandler');
const installmentService = require('../services/installmentService');
const projectService = require('../services/projectService');

/**
 * Get installment tracking data for a project/order.
 * This provides the full installment details for admin order details view.
 * Accepts either projectId or orderId as query parameter.
 */
exports.getOrderInstallmentTracking = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;
  const { orderId } = req.query;

  const { pool } = require('../config/database');
  let resolvedProjectId = projectId;
  let order = null;

  if (!resolvedProjectId && orderId) {
    // Look up project by order ID
    const projectRes = await pool.query(
      `SELECT project_id FROM projects WHERE order_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [orderId]
    );
    if (projectRes.rows.length === 0) {
      // No project found for this order - get order data directly for payment_plan check
      const orderRes = await pool.query(
        `SELECT * FROM orders WHERE order_id = $1`,
        [orderId]
      );
      if (orderRes.rows.length === 0) throw new AppError('Order not found', 404);
      order = orderRes.rows[0];
      // Determine payment plan:
      // 1. Check order's payment_plan column
      // 2. Check if order has installment amounts stored
      // 3. Check if installment schedules exist (for backward compatibility)
      const hasInstallmentData = Number(order.initial_payment_amount || 0) > 0 || Number(order.monthly_installment_amount || 0) > 0;
      const resolvedPaymentPlan = (order.payment_plan === 'installment' || hasInstallmentData)
        ? 'installment'
        : 'full_payment';

      // Return minimal data showing the payment plan
      return res.json({
        status: 'success',
        data: {
          payment_plan: resolvedPaymentPlan,
          total_contract_amount: Number(order.total_amount) || 0,
          initial_payment_amount: Number(order.initial_payment_amount) || 0,
          monthly_installment_amount: Number(order.monthly_installment_amount) || 0,
          tenure_months: Number(order.installment_tenure_months) || 6,
          initial_payment_percentage: Number(order.initial_payment_percentage) || 0.50,
          installments: [],
          summary: null,
          payment_history: [],
        },
      });
    }
    resolvedProjectId = projectRes.rows[0].project_id;
  }

  if (!resolvedProjectId) {
    throw new AppError('Project ID or Order ID is required', 400);
  }

  // Get the project
  const project = await projectService.getProjectById(resolvedProjectId);
  if (!project) throw new AppError('Project not found', 404);

  // Get the order info
  const orderRes = await pool.query(
    `SELECT * FROM orders WHERE order_id = $1`,
    [project.order_id]
  );
  if (orderRes.rows.length === 0) throw new AppError('Order not found', 404);
  order = orderRes.rows[0];

  const trackingData = await installmentService.getInstallmentTrackingData(resolvedProjectId, order);

  res.json({ status: 'success', data: trackingData });
});

/**
 * Get all overdue installments (admin monitoring).
 */
exports.getOverdueInstallments = asyncHandler(async (req, res, next) => {
  const { pool } = require('../config/database');

  const overdueRes = await pool.query(
    `SELECT 
       pis.*,
       p.title AS project_name,
       p.custom_build_id,
       p.status AS project_status,
       o.order_number,
       CONCAT(u.first_name, ' ', u.last_name) AS customer_name
     FROM project_installment_schedules pis
     JOIN projects p ON p.project_id = pis.project_id
     JOIN orders o ON o.order_id = p.order_id
     JOIN users u ON u.user_id = o.user_id
     WHERE pis.status = 'overdue'
     ORDER BY pis.due_date ASC`
  );

  res.json({ status: 'success', data: overdueRes.rows });
});

/**
 * Customer submits payment for an installment with proof.
 */
exports.submitCustomerInstallmentPayment = asyncHandler(async (req, res, next) => {
  const scheduleId = req.params.scheduleId || req.body.scheduleId;
  const projectId = req.params.id || req.params.projectId || req.body.projectId;
  const referenceNumber = req.body.reference_number || req.body.referenceNumber || req.body.reference || null;
  const method = req.body.method || req.body.payment_method || req.body.paymentMethod || 'gcash';
  const proofUrl = req.file ? `/uploads/proofs/${req.file.filename}` : (req.body.proof_url || req.body.proofUrl || null);

  if (!scheduleId) throw new AppError('Schedule ID is required', 400);
  if (!projectId) throw new AppError('Project ID is required', 400);

  const result = await installmentService.submitCustomerInstallmentPayment({
    projectId,
    scheduleId,
    userId: req.user.user_id || req.user.id,
    userRole: req.user.role,
    method,
    referenceNumber: referenceNumber ? String(referenceNumber).trim() : null,
    proofUrl,
  });

  res.status(201).json({
    status: 'success',
    data: result,
    message: 'Payment for installment submitted successfully and is waiting for verification.',
  });
});

/**
 * Admin verifies an installment payment.
 */
exports.verifyInstallmentPayment = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;
  const { notes } = req.body;

  if (!scheduleId) throw new AppError('Schedule ID is required', 400);

  const installment = await installmentService.verifyInstallmentPayment({
    scheduleId,
    adminUserId: req.user.user_id || req.user.id,
    notes: notes || null,
  });

  res.json({
    status: 'success',
    data: installment,
    message: 'Installment payment verified successfully',
  });
});

/**
 * Admin rejects an installment payment.
 */
exports.rejectInstallmentPayment = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;
  const { reason, notes } = req.body;

  if (!scheduleId) throw new AppError('Schedule ID is required', 400);

  const installment = await installmentService.rejectInstallmentPayment({
    scheduleId,
    adminUserId: req.user.user_id || req.user.id,
    reason: reason || 'Payment verification failed',
    notes: notes || null,
  });

  res.json({
    status: 'success',
    data: installment,
    message: 'Installment payment rejected',
  });
});

/**
 * Admin manually marks an installment as paid.
 */
exports.markInstallmentPaid = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;
  const {
    payment_id,
    reference_number,
    method,
    notes,
    amount,
    admin_user_id,
  } = req.body;

  if (!scheduleId) throw new AppError('Schedule ID is required', 400);

  const installment = await installmentService.markInstallmentPaid({
    scheduleId,
    paymentId: payment_id || null,
    referenceNumber: reference_number || null,
    method: method || null,
    notes: notes || null,
    amount: amount || null,
    adminUserId: admin_user_id || req.user?.user_id || req.user?.id || null,
  });

  res.json({ status: 'success', data: installment, message: 'Installment marked as paid' });
});

/**
 * Run overdue check (can be called by cron or manually by admin).
 */
exports.runOverdueCheck = asyncHandler(async (req, res, next) => {
  const autoHeldProjects = await installmentService.checkAllOverdueInstallments();

  res.json({
    status: 'success',
    data: {
      projects_auto_held: autoHeldProjects.length,
      details: autoHeldProjects.map((p) => ({
        project_id: p.project_id,
        title: p.title || p.name,
        status: p.status,
      })),
    },
    message: `${autoHeldProjects.length} project(s) auto-held due to overdue installments`,
  });
});