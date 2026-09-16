const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

/**
 * Installment Service
 * 
 * Handles:
 * - Creating installment schedules for custom build orders
 * - Auto-putting projects on hold when installments are overdue
 * - Auto-resuming projects when overdue installments are paid
 * - Providing installment tracking data
 * - Customer installment payments with admin verification/rejection
 */

let ensureInstallmentTableReady = false;
let ensureInstallmentTablePromise = null;

/**
 * Ensure the project_installment_schedules table exists.
 * This is a safety net in case the migration hasn't been run.
 */
const ensureInstallmentTable = async () => {
  if (ensureInstallmentTableReady) return;
  if (ensureInstallmentTablePromise) return ensureInstallmentTablePromise;

  ensureInstallmentTablePromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_installment_schedules (
          schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
          installment_number INT NOT NULL CHECK (installment_number > 0),
          amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
          due_date DATE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
          paid_at TIMESTAMPTZ,
          payment_id UUID REFERENCES payments(payment_id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(project_id, installment_number)
        );
      `);
      ensureInstallmentTableReady = true;
    } catch (err) {
      console.warn('Could not create installment table (may already exist):', err.message);
      ensureInstallmentTableReady = true;
    }
  })();

  return ensureInstallmentTablePromise;
};

/**
 * Calculate installment amounts for a custom build order.
 * @param {number} totalAmount - Total order amount
 * @param {number} initialPaymentPercentage - e.g. 0.50 for 50% down payment
 * @param {number} tenureMonths - Number of monthly installments
 * @param {number} monthlyInterestRate - e.g. 0.03 for 3% monthly interest
 * @returns {{ initialPayment: number, monthlyPayment: number, totalInstallments: number }}
 */
const calculateInstallmentPlan = (totalAmount, initialPaymentPercentage = 0.50, tenureMonths = 6, monthlyInterestRate = 0.03) => {
  const initialPayment = Math.round(totalAmount * initialPaymentPercentage * 100) / 100;
  const financedAmount = totalAmount - initialPayment;
  const monthlyPayment = financedAmount > 0
    ? Math.round((financedAmount * (1 + monthlyInterestRate) / tenureMonths) * 100) / 100
    : 0;
  return {
    initialPayment,
    monthlyPayment,
    totalInstallments: tenureMonths,
  };
};

/**
 * Create installment schedule for a project.
 * @param {object} client - Database client (must be in a transaction)
 * @param {string} projectId
 * @param {number} totalAmount
 * @param {number} initialPaymentPercentage
 * @param {number} tenureMonths
 * @param {number} monthlyInterestRate
 * @returns {Promise<Array>} The created installment records
 */
exports.createInstallmentSchedule = async (
  client,
  projectId,
  totalAmount,
  initialPaymentPercentage = 0.50,
  tenureMonths = 6,
  monthlyInterestRate = 0.03
) => {
  await ensureInstallmentTable();

  const { initialPayment, monthlyPayment, totalInstallments } = calculateInstallmentPlan(
    totalAmount,
    initialPaymentPercentage,
    tenureMonths,
    monthlyInterestRate
  );

  // Delete any existing schedule for this project (idempotent)
  await client.query(
    'DELETE FROM project_installment_schedules WHERE project_id = $1',
    [projectId]
  );

  const today = new Date();
  const installments = [];

  for (let i = 1; i <= totalInstallments; i++) {
    const dueDate = new Date(today);
    dueDate.setMonth(dueDate.getMonth() + i);
    dueDate.setDate(1); // Due on the 1st of each month

    const res = await client.query(
      `INSERT INTO project_installment_schedules 
       (project_id, installment_number, amount, due_date, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [projectId, i, monthlyPayment, dueDate.toISOString().split('T')[0]]
    );
    installments.push(res.rows[0]);
  }

  return {
    installments,
    initialPayment,
    monthlyPayment,
    totalInstallments,
  };
};

/**
 * Customer submits payment proof for an installment.
 */
exports.submitCustomerInstallmentPayment = async ({
  projectId,
  scheduleId,
  userId,
  userRole,
  method = 'gcash',
  referenceNumber,
  proofUrl,
}) => {
  await ensureInstallmentTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get the installment and project/order info
    const instRes = await client.query(
      `SELECT pis.*, p.order_id, o.user_id AS customer_id, o.user_id AS order_user_id, o.total_amount AS order_total, o.order_number
       FROM project_installment_schedules pis
       JOIN projects p ON p.project_id = pis.project_id
       LEFT JOIN orders o ON o.order_id = p.order_id
       WHERE pis.schedule_id = $1 AND pis.project_id = $2`,
      [scheduleId, projectId]
    );

    if (instRes.rows.length === 0) {
      throw new AppError('Installment schedule not found for this project', 404);
    }

    const installment = instRes.rows[0];
    const customerId = installment.customer_id || installment.order_user_id;

    // Check ownership if customer
    const isStaffOrAdmin = ['staff', 'admin', 'super_admin'].includes(userRole);
    if (!isStaffOrAdmin && customerId && customerId !== userId) {
      throw new AppError('You do not have permission to pay for this installment', 403);
    }

    // Check if already paid
    if (installment.status === 'paid') {
      throw new AppError('This installment has already been paid and verified', 400);
    }

    // Check if there is already an active payment for this installment awaiting verification
    if (installment.payment_id) {
      const activePayRes = await client.query(
        `SELECT * FROM payments WHERE payment_id = $1`,
        [installment.payment_id]
      );
      if (activePayRes.rows.length > 0) {
        const activePay = activePayRes.rows[0];
        if (activePay.status === 'for_verification' || activePay.status === 'pending') {
          throw new AppError('A payment for this installment has already been submitted and is waiting for verification.', 400);
        }
        if (activePay.status === 'verified') {
          throw new AppError('This installment has already been paid and verified.', 400);
        }
      }
    }

    const paymentMethod = ['gcash', 'bank_transfer', 'cash'].includes(method) ? method : 'gcash';
    const amount = Number(installment.amount);

    // Create payment record with for_verification status
    const paymentRes = await client.query(
      `INSERT INTO payments (order_id, user_id, method, amount, currency, reference_number, proof_url, status, metadata)
       VALUES ($1, $2, $3, $4, 'PHP', $5, $6, 'for_verification', $7)
       RETURNING *`,
      [
        installment.order_id,
        userId || customerId,
        paymentMethod,
        amount,
        referenceNumber || null,
        proofUrl || null,
        JSON.stringify({
          type: 'installment',
          schedule_id: scheduleId,
          installment_number: installment.installment_number,
          project_id: projectId,
          submitted_at: new Date().toISOString(),
        })
      ]
    );

    const payment = paymentRes.rows[0];

    // Link payment_id to project_installment_schedules
    const updateRes = await client.query(
      `UPDATE project_installment_schedules
       SET payment_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE schedule_id = $2
       RETURNING *`,
      [payment.payment_id, scheduleId]
    );

    await client.query('COMMIT');

    // Create Customer Notification
    if (customerId) {
      try {
        const notificationService = require('./notificationService');
        await notificationService.createNotification({
          user_id: customerId,
          title: 'Payment Submitted',
          message: `Your payment for Installment #${installment.installment_number} has been submitted and is waiting for verification.`,
          type: 'payment',
          related_entity_id: installment.order_id,
          related_entity_type: 'order',
        });
      } catch (notifErr) {
        console.warn('Failed to send installment payment submission notification:', notifErr.message);
      }
    }

    return {
      installment: updateRes.rows[0],
      payment,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin verifies an installment payment.
 */
exports.verifyInstallmentPayment = async ({
  scheduleId,
  adminUserId,
  notes,
}) => {
  await ensureInstallmentTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get installment and linked payment
    const instRes = await client.query(
      `SELECT pis.*, p.order_id, o.user_id AS customer_id, o.user_id AS order_user_id
       FROM project_installment_schedules pis
       JOIN projects p ON p.project_id = pis.project_id
       LEFT JOIN orders o ON o.order_id = p.order_id
       WHERE pis.schedule_id = $1`,
      [scheduleId]
    );

    if (instRes.rows.length === 0) {
      throw new AppError('Installment schedule not found', 404);
    }

    const installment = instRes.rows[0];
    const customerId = installment.customer_id || installment.order_user_id;

    // Update payment record if exists
    let payment = null;
    if (installment.payment_id) {
      const payRes = await client.query(
        `UPDATE payments
         SET status = 'verified',
             verified_by = $1,
             verified_at = CURRENT_TIMESTAMP,
             metadata = COALESCE(metadata, '{}'::jsonb) || $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE payment_id = $3
         RETURNING *`,
        [
          adminUserId || null,
          JSON.stringify({ verification_notes: notes || null, verified_via: 'installment_tracking' }),
          installment.payment_id
        ]
      );
      payment = payRes.rows[0] || null;
    } else {
      // If no payment was linked, create a verified payment
      const payRes = await client.query(
        `INSERT INTO payments (order_id, user_id, method, amount, currency, reference_number, status, verified_by, verified_at, metadata)
         VALUES ($1, $2, 'gcash', $3, 'PHP', $4, 'verified', $5, CURRENT_TIMESTAMP, $6)
         RETURNING *`,
        [
          installment.order_id,
          customerId,
          Number(installment.amount),
          `INST-${Date.now()}`,
          adminUserId || null,
          JSON.stringify({ admin_marked: true, notes: notes || null, verified_via: 'installment_tracking' })
        ]
      );
      payment = payRes.rows[0];
    }

    // Update installment schedule to paid
    const updateRes = await client.query(
      `UPDATE project_installment_schedules
       SET status = 'paid',
           paid_at = CURRENT_TIMESTAMP,
           payment_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE schedule_id = $2
       RETURNING *`,
      [payment ? payment.payment_id : installment.payment_id, scheduleId]
    );

    // Update the order payment_status to approved if pending
    await client.query(
      `UPDATE orders
       SET payment_status = 'approved',
           reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1
         AND payment_status IN ('pending', 'proof_submitted', 'under_review')`,
      [installment.order_id]
    );

    await client.query('COMMIT');

    const updatedInstallment = updateRes.rows[0];
    updatedInstallment.payment = payment;

    // Check and auto-resume if project was on hold due to overdue
    await exports.checkAndAutoResumeProject(installment.project_id);

    // Send customer notification
    if (customerId) {
      try {
        const notificationService = require('./notificationService');
        await notificationService.createNotification({
          user_id: customerId,
          title: 'Payment Approved',
          message: `Your payment of ₱${Number(installment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for Installment #${installment.installment_number} has been verified.`,
          type: 'payment',
          related_entity_id: installment.order_id,
          related_entity_type: 'order',
        });
      } catch (notifErr) {
        console.warn('Failed to send installment payment verified notification:', notifErr.message);
      }
    }

    return updatedInstallment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin rejects an installment payment.
 */
exports.rejectInstallmentPayment = async ({
  scheduleId,
  adminUserId,
  reason,
  notes,
}) => {
  await ensureInstallmentTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const instRes = await client.query(
      `SELECT pis.*, p.order_id, o.user_id AS customer_id, o.user_id AS order_user_id
       FROM project_installment_schedules pis
       JOIN projects p ON p.project_id = pis.project_id
       LEFT JOIN orders o ON o.order_id = p.order_id
       WHERE pis.schedule_id = $1`,
      [scheduleId]
    );

    if (instRes.rows.length === 0) {
      throw new AppError('Installment schedule not found', 404);
    }

    const installment = instRes.rows[0];
    const customerId = installment.customer_id || installment.order_user_id;

    let payment = null;
    if (installment.payment_id) {
      const payRes = await client.query(
        `UPDATE payments
         SET status = 'rejected',
             verified_by = $1,
             verified_at = CURRENT_TIMESTAMP,
             rejection_reason = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE payment_id = $4
         RETURNING *`,
        [
          adminUserId || null,
          reason || 'Payment verification failed',
          JSON.stringify({ rejection_notes: notes || null, rejected_via: 'installment_tracking' }),
          installment.payment_id
        ]
      );
      payment = payRes.rows[0] || null;
    }

    // Determine status: if due_date < today, 'overdue', else 'pending'
    const today = new Date().toISOString().split('T')[0];
    const resetStatus = installment.due_date < today ? 'overdue' : 'pending';

    // Update installment schedule: reset status to pending/overdue
    const updateRes = await client.query(
      `UPDATE project_installment_schedules
       SET status = $1,
           paid_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE schedule_id = $2
       RETURNING *`,
      [resetStatus, scheduleId]
    );

    await client.query('COMMIT');

    const updatedInstallment = updateRes.rows[0];
    updatedInstallment.payment = payment;

    // Send Customer Notification
    if (customerId) {
      try {
        const notificationService = require('./notificationService');
        await notificationService.createNotification({
          user_id: customerId,
          title: 'Payment Rejected',
          message: `Your payment for Installment #${installment.installment_number} could not be verified.${reason ? ' Reason: ' + reason + '.' : ''} Please review the payment information and submit a new payment.`,
          type: 'payment',
          related_entity_id: installment.order_id,
          related_entity_type: 'order',
        });
      } catch (notifErr) {
        console.warn('Failed to send installment payment rejected notification:', notifErr.message);
      }
    }

    return updatedInstallment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Mark an installment as paid (linked to a payment).
 * @param {string|object} scheduleIdOrOptions - The installment schedule ID or options object
 * @param {string} [scheduleIdOrOptions.scheduleId] - The installment schedule ID
 * @param {string} [scheduleIdOrOptions.paymentId] - The payment ID that covers this installment
 * @param {string} [scheduleIdOrOptions.referenceNumber] - Payment reference number
 * @param {string} [scheduleIdOrOptions.method] - Payment method (gcash/bank_transfer)
 * @param {string} [scheduleIdOrOptions.notes] - Admin notes
 * @param {number} [scheduleIdOrOptions.amount] - Payment amount
 * @param {string} [scheduleIdOrOptions.adminUserId] - Admin user ID doing the verification
 * @param {string} [paymentIdLegacy] - Backwards-compatible payment ID parameter
 * @returns {Promise<object>} Updated installment record
 */
exports.markInstallmentPaid = async (scheduleIdOrOptions, paymentIdLegacy) => {
  await ensureInstallmentTable();

  // Support both old signature (scheduleId, paymentId) and new options object
  let scheduleId, paymentId, referenceNumber, method, notes, amount, adminUserId;
  if (typeof scheduleIdOrOptions === 'object' && scheduleIdOrOptions !== null) {
    ({ scheduleId, paymentId, referenceNumber, method, notes, amount, adminUserId } = scheduleIdOrOptions);
  } else {
    scheduleId = scheduleIdOrOptions;
    paymentId = paymentIdLegacy || null;
  }

  if (!scheduleId) throw new Error('Schedule ID is required');

  const client = await pool.connect();
  let createdPayment = null;
  try {
    await client.query('BEGIN');

    // Get the installment to know its amount and project
    const installmentRes = await client.query(
      `SELECT pis.*, p.order_id, o.user_id
       FROM project_installment_schedules pis
       JOIN projects p ON p.project_id = pis.project_id
       LEFT JOIN orders o ON o.order_id = p.order_id
       WHERE pis.schedule_id = $1`,
      [scheduleId]
    );

    if (installmentRes.rows.length === 0) {
      throw new Error('Installment schedule not found');
    }

    const installment = installmentRes.rows[0];
    const paymentAmount = Number(amount || installment.amount || 0);

    // If no payment ID is provided, create a payment record first
    if (!paymentId) {
      const paymentMethod = ['gcash', 'bank_transfer', 'cash'].includes(method)
        ? method
        : 'gcash';
      const paymentRes = await client.query(
        `INSERT INTO payments (order_id, user_id, method, amount, currency, reference_number, status, verified_by, verified_at, metadata)
         VALUES ($1, $2, $3, $4, 'PHP', $5, 'verified', $6, CURRENT_TIMESTAMP, $7)
         RETURNING *`,
        [
          installment.order_id,
          installment.user_id,
          paymentMethod,
          paymentAmount,
          referenceNumber || `INST-${Date.now()}`,
          adminUserId || null,
          JSON.stringify({ admin_marked: true, notes: notes || null, source: 'installment_admin' })
        ]
      );
      createdPayment = paymentRes.rows[0];
      paymentId = createdPayment.payment_id;
    }

    // Mark installment as paid
    const updateRes = await client.query(
      `UPDATE project_installment_schedules
       SET status = 'paid',
           paid_at = CURRENT_TIMESTAMP,
           payment_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE schedule_id = $1
       RETURNING *`,
      [scheduleId, paymentId]
    );

    if (updateRes.rows.length === 0) {
      throw new Error('Installment schedule not found');
    }

    // Also update the order payment_status to approved if it's pending
    await client.query(
      `UPDATE orders
       SET payment_status = 'approved',
           payment_reference_number = COALESCE($2, payment_reference_number),
           reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1
         AND payment_status IN ('pending', 'proof_submitted', 'under_review')`,
      [installment.order_id, referenceNumber || null]
    );

    await client.query('COMMIT');

    const finalInstallment = updateRes.rows[0];
    finalInstallment.payment = createdPayment || null;

    // After marking paid, check if this project was on hold due to overdue installments
    // and auto-resume if all overdue installments are now paid
    await exports.checkAndAutoResumeProject(finalInstallment.project_id);

    return finalInstallment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Mark an installment as overdue.
 * @param {string} scheduleId
 * @returns {Promise<object>} Updated installment record
 */
exports.markInstallmentOverdue = async (scheduleId) => {
  await ensureInstallmentTable();

  const res = await pool.query(
    `UPDATE project_installment_schedules
     SET status = 'overdue',
         updated_at = CURRENT_TIMESTAMP
     WHERE schedule_id = $1
       AND status = 'pending'
     RETURNING *`,
    [scheduleId]
  );

  if (res.rows.length === 0) return null;

  const installment = res.rows[0];

  // Auto-put the project on hold
  await exports.autoHoldProjectForOverdue(installment.project_id);

  return installment;
};

/**
 * Auto-put a project on hold due to overdue installment.
 * @param {string} projectId
 * @returns {Promise<object|null>} Updated project or null
 */
exports.autoHoldProjectForOverdue = async (projectId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check project is not already on hold or cancelled/completed
    const pRes = await client.query(
      `SELECT status, auto_hold_due_to_overdue 
       FROM projects 
       WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );

    if (pRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const project = pRes.rows[0];
    const normalizedStatus = String(project.status || '').trim().toLowerCase().replace(/\s+/g, '_');

    // Don't override if already on hold for other reasons, cancelled, or completed
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'completed') {
      await client.query('ROLLBACK');
      return null;
    }

    // If already auto-held, skip
    if (project.auto_hold_due_to_overdue) {
      await client.query('ROLLBACK');
      return null;
    }

    // Find the current build step for reference
    let currentStepName = null;
    const milestones = await client.query(
      `SELECT * FROM project_milestones 
       WHERE project_id = $1 AND status != 'completed' 
       ORDER BY order_index ASC LIMIT 1`,
      [projectId]
    );
    if (milestones.rows.length > 0) {
      currentStepName = milestones.rows[0].title;
    }

    // Set project to on_hold with auto-hold flag
    await client.query(
      `UPDATE projects
       SET status = 'on_hold',
           hold_reason = COALESCE(hold_reason, 'Auto-held: Overdue installment payment'),
           hold_option = COALESCE(hold_option, 'resume_later'),
           hold_at_step = COALESCE(hold_at_step, $1),
           hold_requested_at = COALESCE(hold_requested_at, CURRENT_TIMESTAMP),
           auto_hold_due_to_overdue = TRUE,
           auto_hold_triggered_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $2`,
      [currentStepName, projectId]
    );

    // Log the auto-hold action
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (NULL, 'UPDATE', 'project', $1, $2)`,
      [
        projectId,
        JSON.stringify({
          action: 'auto_hold_overdue_installment',
          reason: 'Project auto-held due to overdue installment payment',
          current_step: currentStepName,
        }),
      ]
    );

    await client.query('COMMIT');

    // Return updated project
    const updatedRes = await pool.query(
      'SELECT * FROM projects WHERE project_id = $1',
      [projectId]
    );
    return updatedRes.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Check if a project should be auto-resumed (all overdue installments now paid).
 * @param {string} projectId
 * @returns {Promise<object|null>} Updated project or null
 */
exports.checkAndAutoResumeProject = async (projectId) => {
  await ensureInstallmentTable();

  // Check if project is on hold due to overdue installments
  const pRes = await pool.query(
    `SELECT status, auto_hold_due_to_overdue 
     FROM projects 
     WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );

  if (pRes.rows.length === 0) return null;
  const project = pRes.rows[0];

  const normalizedStatus = String(project.status || '').trim().toLowerCase().replace(/\s+/g, '_');

  // Only auto-resume if project was auto-held due to overdue
  if (normalizedStatus !== 'on_hold' || !project.auto_hold_due_to_overdue) {
    return null;
  }

  // Check if there are any remaining overdue installments
  const overdueRes = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM project_installment_schedules
     WHERE project_id = $1
       AND status = 'overdue'`,
    [projectId]
  );

  const overdueCount = overdueRes.rows[0]?.count || 0;

  // If there are still overdue installments, don't resume
  if (overdueCount > 0) return null;

  // All overdue installments are now paid - auto-resume the project
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE projects
       SET status = 'in_progress',
           hold_reason = NULL,
           hold_option = NULL,
           hold_at_step = NULL,
           hold_requested_at = NULL,
           hold_approved_by = NULL,
           hold_approved_at = NULL,
           auto_hold_due_to_overdue = FALSE,
           auto_hold_triggered_at = NULL,
           auto_resumed_at = CURRENT_TIMESTAMP,
           resumed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = $1`,
      [projectId]
    );

    // Log the auto-resume action
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (NULL, 'UPDATE', 'project', $1, $2)`,
      [
        projectId,
        JSON.stringify({
          action: 'auto_resume_installment_paid',
          reason: 'Project auto-resumed after overdue installment was paid',
        }),
      ]
    );

    await client.query('COMMIT');

    const updatedRes = await pool.query(
      'SELECT * FROM projects WHERE project_id = $1',
      [projectId]
    );
    return updatedRes.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Check all projects for overdue installments and auto-hold them.
 * This is meant to be called by a scheduled job (cron).
 * @returns {Promise<Array>} List of projects that were auto-held
 */
exports.checkAllOverdueInstallments = async () => {
  await ensureInstallmentTable();

  // Find all pending installments past their due date
  const today = new Date().toISOString().split('T')[0];

  const overdueRes = await pool.query(
    `SELECT pis.schedule_id, pis.project_id, pis.installment_number, pis.due_date
     FROM project_installment_schedules pis
     JOIN projects p ON p.project_id = pis.project_id
     WHERE pis.status = 'pending'
       AND pis.due_date < $1::date
       AND p.deleted_at IS NULL
       AND p.status != 'cancelled'
       AND p.status != 'completed'
       AND p.status != 'on_hold'
     ORDER BY pis.project_id, pis.installment_number`,
    [today]
  );

  const autoHeldProjects = [];
  const processedProjects = new Set();

  for (const row of overdueRes.rows) {
    // Mark the installment as overdue
    await pool.query(
      `UPDATE project_installment_schedules
       SET status = 'overdue',
           updated_at = CURRENT_TIMESTAMP
       WHERE schedule_id = $1
         AND status = 'pending'`,
      [row.schedule_id]
    );

    // Auto-hold the project (only once per project)
    if (!processedProjects.has(row.project_id)) {
      processedProjects.add(row.project_id);
      const heldProject = await exports.autoHoldProjectForOverdue(row.project_id);
      if (heldProject) {
        autoHeldProjects.push(heldProject);
      }
    }
  }

  return autoHeldProjects;
};

/**
 * Get installment schedule with summary for a project, enriched with payment details.
 * @param {string} projectId
 * @returns {Promise<object>} { installments, summary, payment_plan }
 */
exports.getInstallmentSchedule = async (projectId) => {
  await ensureInstallmentTable();

  const scheduleRes = await pool.query(
    `SELECT 
       pis.*,
       p.status AS payment_status,
       p.reference_number AS payment_reference,
       p.method AS payment_method,
       p.proof_url AS payment_proof_url,
       p.created_at AS payment_submitted_at,
       p.verified_at AS payment_verified_at,
       p.rejection_reason AS payment_rejection_reason,
       p.payment_instructions
     FROM project_installment_schedules pis
     LEFT JOIN payments p ON p.payment_id = pis.payment_id
     WHERE pis.project_id = $1
     ORDER BY pis.installment_number ASC`,
    [projectId]
  );

  const rawInstallments = scheduleRes.rows;

  if (rawInstallments.length === 0) {
    return { installments: [], summary: null };
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // First pass: resolve exact status for each installment
  // Find first unpaid installment index to determine 'due' vs 'upcoming'
  let foundFirstUnpaid = false;

  const installments = rawInstallments.map((inst) => {
    const isPaid = inst.status === 'paid' || inst.payment_status === 'verified';
    const isForVerification = !isPaid && inst.payment_status === 'for_verification';
    const isRejected = !isPaid && inst.payment_status === 'rejected';
    const isOverdue = !isPaid && !isForVerification && (inst.status === 'overdue' || (inst.status === 'pending' && inst.due_date < todayStr));

    let displayStatus = 'upcoming';
    let statusLabel = 'Upcoming';
    let isPayable = false;

    if (isPaid) {
      displayStatus = 'paid';
      statusLabel = 'Paid';
      isPayable = false;
    } else if (isForVerification) {
      displayStatus = 'for_verification';
      statusLabel = 'Payment Verification Pending';
      isPayable = false;
    } else if (isRejected) {
      displayStatus = 'rejected';
      statusLabel = 'Payment Rejected';
      isPayable = true;
    } else if (isOverdue) {
      displayStatus = 'overdue';
      statusLabel = 'Overdue';
      isPayable = true;
      foundFirstUnpaid = true;
    } else {
      // Pending and not past due date
      if (!foundFirstUnpaid) {
        displayStatus = 'due';
        statusLabel = 'Due';
        isPayable = true;
        foundFirstUnpaid = true;
      } else {
        displayStatus = 'upcoming';
        statusLabel = 'Upcoming';
        isPayable = false;
      }
    }

    return {
      ...inst,
      display_status: displayStatus,
      status_label: statusLabel,
      is_payable: isPayable,
      payment_method: inst.payment_method || (isPaid ? 'gcash' : null),
      payment_reference: inst.payment_reference || null,
      payment_proof_url: inst.payment_proof_url || null,
      payment_date: isPaid ? (inst.paid_at || inst.payment_verified_at) : null,
      rejection_reason: isRejected ? (inst.payment_rejection_reason || null) : null,
      submitted_at: inst.payment_submitted_at || null,
    };
  });

  // Calculate summary
  const totalAmount = installments.reduce((sum, inst) => sum + Number(inst.amount), 0);
  const paidInstallments = installments.filter((inst) => inst.display_status === 'paid');
  const paidCount = paidInstallments.length;
  const totalCount = installments.length;
  const paidAmount = paidInstallments.reduce((sum, inst) => sum + Number(inst.amount), 0);
  const pendingVerificationCount = installments.filter((inst) => inst.display_status === 'for_verification').length;
  const overdueCount = installments.filter((inst) => inst.display_status === 'overdue').length;
  const unpaidCount = totalCount - paidCount;
  // Official remaining balance only reduces with verified payments!
  const remainingBalance = Math.max(0, totalAmount - paidAmount);
  const remainingMonths = totalCount - paidCount;

  // Next due installment
  const nextDue = installments.find(
    (inst) => inst.display_status === 'due' || inst.display_status === 'overdue' || inst.display_status === 'for_verification'
  ) || installments.find((inst) => inst.display_status !== 'paid');

  const lastUpdated = installments.reduce((latest, inst) => {
    const updated = inst.updated_at || inst.created_at;
    return updated && (!latest || new Date(updated) > new Date(latest)) ? updated : latest;
  }, null);

  return {
    installments,
    summary: {
      total_amount: totalAmount,
      monthly_payment: installments[0]?.amount || 0,
      remaining_balance: remainingBalance,
      total_months: totalCount,
      remaining_months: remainingMonths,
      next_due_date: nextDue?.due_date || null,
      paid_amount: paidAmount,
      paid_count: paidCount,
      unpaid_count: unpaidCount,
      overdue_count: overdueCount,
      pending_verification_count: pendingVerificationCount,
      last_updated: lastUpdated,
    },
  };
};

/**
 * Get installment tracking data for admin order details display.
 * @param {string} projectId
 * @param {object} order - The order object with total_amount
 * @returns {Promise<object>} Installment tracking data
 */
exports.getInstallmentTrackingData = async (projectId, order) => {
  await ensureInstallmentTable();

  const scheduleData = await exports.getInstallmentSchedule(projectId);

  // Get order payment plan info
  const orderRes = await pool.query(
    `SELECT payment_plan, initial_payment_percentage, installment_tenure_months,
            initial_payment_amount, monthly_installment_amount, total_amount, payment_status,
            order_number
     FROM orders WHERE order_id = $1`,
    [order.order_id]
  );

  const orderData = orderRes.rows[0] || {};
  const totalAmount = Number(orderData.total_amount || order.total_amount || 0);
  const initialPaymentPercentage = Number(orderData.initial_payment_percentage || 0.50);
  const tenureMonths = Number(orderData.installment_tenure_months || 6);
  const initialPaymentAmount = Number(orderData.initial_payment_amount || 0);
  const monthlyPaymentAmount = Number(orderData.monthly_installment_amount || 0);

  const hasInstallmentSchedules = scheduleData.installments.length > 0;
  const hasInstallmentData = Number(orderData.initial_payment_amount || 0) > 0 || Number(orderData.monthly_installment_amount || 0) > 0;
  const resolvedPaymentPlan = (hasInstallmentSchedules || hasInstallmentData || orderData.payment_plan === 'installment')
    ? 'installment'
    : 'full_payment';

  // Get payment history for this order (both down payment and installments)
  const payRes = await pool.query(
    `SELECT p.*, u.first_name AS verified_first, u.last_name AS verified_last
     FROM payments p
     LEFT JOIN users u ON u.user_id = p.verified_by
     WHERE p.order_id = $1 AND p.deleted_at IS NULL
     ORDER BY p.created_at ASC`,
    [order.order_id]
  );
  const paymentHistory = payRes.rows;

  const summary = scheduleData.summary || {
    total_amount: totalAmount,
    monthly_payment: monthlyPaymentAmount,
    remaining_balance: totalAmount,
    total_months: tenureMonths,
    remaining_months: tenureMonths,
    next_due_date: null,
    paid_amount: 0,
    paid_count: 0,
    unpaid_count: tenureMonths,
    overdue_count: 0,
    pending_verification_count: 0,
  };

  return {
    payment_plan: resolvedPaymentPlan,
    total_contract_amount: totalAmount,
    initial_payment_percentage: initialPaymentPercentage,
    initial_payment_amount: initialPaymentAmount,
    monthly_installment_amount: monthlyPaymentAmount,
    tenure_months: tenureMonths,
    installments: scheduleData.installments,
    summary,
    payment_history: paymentHistory,
  };
};

/**
 * Link a payment to the first unpaid installment in a project's schedule.
 * Used when a customer makes a payment that should be applied to installments.
 * @param {string} projectId
 * @param {string} paymentId
 * @param {number} amount - The payment amount
 * @returns {Promise<Array>} Updated installment records
 */
exports.applyPaymentToInstallments = async (projectId, paymentId, amount) => {
  await ensureInstallmentTable();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all unpaid installments ordered by number
    const unpaidRes = await client.query(
      `SELECT * FROM project_installment_schedules
       WHERE project_id = $1
         AND status IN ('pending', 'overdue')
       ORDER BY installment_number ASC`,
      [projectId]
    );

    const unpaid = unpaidRes.rows;
    let remainingAmount = amount;
    const updatedInstallments = [];

    for (const installment of unpaid) {
      if (remainingAmount <= 0) break;

      const installmentAmount = Number(installment.amount);
      if (remainingAmount >= installmentAmount) {
        // Full payment for this installment
        const res = await client.query(
          `UPDATE project_installment_schedules
           SET status = 'paid',
               paid_at = CURRENT_TIMESTAMP,
               payment_id = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE schedule_id = $1
           RETURNING *`,
          [installment.schedule_id, paymentId]
        );
        if (res.rows.length > 0) {
          updatedInstallments.push(res.rows[0]);
        }
        remainingAmount -= installmentAmount;
      } else {
        // Partial payment - mark as paid with the amount applied
        // (In a real system, you might track partial payments separately)
        // For now, we mark it as paid if the full amount is covered
        break;
      }
    }

    await client.query('COMMIT');

    // Check if project should be auto-resumed
    if (updatedInstallments.length > 0) {
      await exports.checkAndAutoResumeProject(projectId);
    }

    return updatedInstallments;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};