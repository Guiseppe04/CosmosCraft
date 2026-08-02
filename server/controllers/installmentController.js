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
 * Admin manually marks an installment as paid.
 */
exports.markInstallmentPaid = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;
  const { payment_id } = req.body;

  if (!scheduleId) throw new AppError('Schedule ID is required', 400);

  const installment = await installmentService.markInstallmentPaid(
    scheduleId,
    payment_id || null
  );

  res.json({ status: 'success', data: installment, message: 'Installment marked as paid' });
});

/**
 * Admin cancels a pending advance payment.
 * Un-links the covered installments and cancels the payment record.
 */
exports.cancelAdvancePayment = asyncHandler(async (req, res, next) => {
  const { paymentId } = req.params;

  if (!paymentId) throw new AppError('Payment ID is required', 400);

  const result = await installmentService.cancelAdvancePayment(paymentId, req.user?.id || req.user?.user_id);

  res.json({
    status: 'success',
    data: result,
    message: 'Advance payment cancelled and installments un-linked',
  });
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