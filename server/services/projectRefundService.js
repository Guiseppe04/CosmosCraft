const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { generateRefundRequestNumber } = require('../utils/orderNumber');

const PROJECT_REFUND_TRANSITIONS = {
  pending: ['approved', 'rejected'],
  'pending_payment_verification': ['pending', 'rejected'],
  approved: ['processing'],
  processing: ['refunded'],
  rejected: [],
  refunded: [],
};

const hasBuildProgress = async (db, projectId) => {
  const res = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(CASE WHEN ps.status = 'completed' THEN 1 END)::int AS completed
     FROM project_subtasks ps
     JOIN project_milestones pm ON ps.milestone_id = pm.milestone_id
     WHERE pm.project_id = $1`,
    [projectId]
  );
  return (res.rows[0]?.completed || 0) > 0 || (res.rows[0]?.total || 0) > 0;
};

/**
 * Build the eligibility result for a customer's project refund request.
 * Validation order per task §3:
 *   1. Project exists and requesting customer owns it.
 *   2. Project not started, verified payments exist (full payment OR
 *      installment/down-payment; refundable amount is the actual verified total).
 *   3. Payment has not already been refunded.
 *   4. No existing pending/approved request for same order/payment.
 */
exports.getProjectRefundEligibility = async (projectId, userId, userRole) => {
  const pRes = await pool.query(
    `SELECT p.project_id, p.order_id, p.status, o.user_id AS customer_id, o.payment_plan,
            o.total_amount AS order_total_amount
     FROM projects p
     JOIN orders o ON o.order_id = p.order_id
     WHERE p.project_id = $1 AND p.deleted_at IS NULL`,
    [projectId]
  );
  if (pRes.rows.length === 0) {
    throw new AppError('Project not found', 404);
  }
  const project = pRes.rows[0];
  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
  if (!isPrivileged && project.customer_id !== userId) {
    throw new AppError('You do not have access to this project', 403);
  }

  const reasons = [];
  let eligible = true;

  // 2a. Both full-payment and installment (down-payment) builds are eligible.
  //     The refundable amount is always the actual verified money paid.

  // 2b. Project must not have started (no build progress recorded).
  const progress = await hasBuildProgress(pool, projectId);
  if (progress) {
    eligible = false;
    reasons.push('Build has already started. Your down payment was used to purchase parts and materials, which are not refundable. You will receive the guitar in its current build state through the Current Build Claim process.');
  }

  // 2c. Verified payments exist for this order.
  const latestVerifiedRes = await pool.query(
    `SELECT payment_id, amount, status FROM payments
     WHERE order_id = $1 AND status = 'verified' AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [project.order_id]
  );
  const latestVerified = latestVerifiedRes.rows[0] || null;

  const payRes = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0)::numeric AS verified_total,
       COUNT(*)::int AS total_payments,
       COUNT(*) FILTER (WHERE status = 'verified')::int AS verified_payments,
       BOOL_OR(status = 'refunded') AS has_refunded
     FROM payments
     WHERE order_id = $1 AND deleted_at IS NULL`,
    [project.order_id]
  );
  const pay = payRes.rows[0] || { verified_total: 0, total_payments: 0, verified_payments: 0, has_refunded: false };

  if (pay.total_payments === 0) {
    eligible = false;
    reasons.push('No payment record found for this project.');
  } else if (pay.verified_payments === 0) {
    eligible = false;
    reasons.push('No verified payments recorded for this project.');
  }

  // 3. Payment has not already been refunded.
  if (pay.has_refunded) {
    eligible = false;
    reasons.push('This payment has already been refunded.');
  }

  // 4. No existing pending or approved request for this project/payment.
  const existingRes = await pool.query(
    `SELECT refund_request_id FROM refund_requests
     WHERE (project_id = $1 OR payment_id = $2)
       AND status IN ('pending', 'approved')
       AND deleted_at IS NULL
     LIMIT 1`,
    [projectId, latestVerified?.payment_id || null]
  );
  if (existingRes.rows.length > 0) {
    eligible = false;
    reasons.push('A refund request is already pending or approved for this project.');
  }

  // Refundable amount = total verified payments actually recorded
  // (not the project's list price). Works for both full payment and down payments.
  const refundableAmount = pay.verified_payments > 0 ? Number(pay.verified_total) : 0;

  return {
    eligible,
    refundable_amount: refundableAmount,
    payment_type: project.payment_plan || 'full_payment',
    payment_status: latestVerified?.status || null,
    payment_id: latestVerified?.payment_id || null,
    has_build_progress: progress,
    reasons,
  };
};

/**
 * Customer creates a refund request. Never auto-refunds.
 */
exports.createProjectRefundRequest = async (projectId, userId, userRole, data = {}) => {
  const eligibility = await exports.getProjectRefundEligibility(projectId, userId, userRole);
  if (!eligibility.eligible) {
    const message = eligibility.reasons.length
      ? eligibility.reasons.join(' ')
      : 'This project is not eligible for a refund request.';
    throw new AppError(message, 400);
  }

  const reason = String(data.reason || '').trim();
  if (!reason) {
    throw new AppError('Refund reason is required', 400);
  }
  if (reason.length > 500) {
    throw new AppError('Refund reason must not exceed 500 characters', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-validate the amount cap inside the transaction against the total
    // verified payments actually recorded for this order. This supports both
    // full-payment and down-payment (installment) refunds.
    const payRes = await client.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0)::numeric AS verified_total,
              COUNT(*) FILTER (WHERE status = 'verified')::int AS verified_payments
       FROM payments
       WHERE order_id = $1 AND deleted_at IS NULL`,
      [eligibility.order_id]
    );
    const pay = payRes.rows[0] || { verified_total: 0, verified_payments: 0 };
    if (pay.verified_payments === 0) {
      throw new AppError('No verified payments found for this project.', 400);
    }
    const refundableTotal = Number(pay.verified_total);
    const amountRequested = Math.min(
      Number(data.amount_requested) > 0 ? Number(data.amount_requested) : refundableTotal,
      refundableTotal
    );
    if (amountRequested <= 0 || amountRequested > refundableTotal) {
      throw new AppError('Refund amount must not exceed the recorded payment amount.', 400);
    }

    const requestNumber = await generateRefundRequestNumber(client, 'RF');

    const insertRes = await client.query(
      `INSERT INTO refund_requests (
         order_id, user_id, project_id, payment_id, reason, customer_notes,
         amount_requested, build_stage_at_request, status, request_number
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
       RETURNING *`,
      [
        eligibility.order_id,
        userId,
        projectId,
        eligibility.payment_id,
        reason,
        data.customerNotes ? String(data.customerNotes).trim() : null,
        amountRequested,
        eligibility.has_build_progress ? (await pool.query(
          `SELECT last_completed_stage AS stage FROM projects WHERE project_id = $1`,
          [projectId]
        )).rows[0]?.stage || null : null,
        requestNumber,
      ]
    );

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'refund_requested',
        'project',
        projectId,
        JSON.stringify({ refund_request_id: insertRes.rows[0].refund_request_id, amount: amountRequested }),
      ]
    );

    await client.query('COMMIT');
    return insertRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * When a payment is verified or rejected, auto-transition any pending_payment_verification
 * refunds for the same order/project so the customer doesn't have to re-request.
 *
 * verified  -> pending (amount recomputed from current verified payments)
 * rejected  -> rejected
 */
exports.transitionRefundStatusesForPayment = async (client, orderId, newPaymentStatus) => {
  if (newPaymentStatus !== 'verified' && newPaymentStatus !== 'rejected') {
    return;
  }

  const pendingRefunds = await client.query(
    `SELECT refund_request_id, project_id, payment_id, amount_requested, status
     FROM refund_requests
     WHERE order_id = $1
       AND status = 'pending_payment_verification'
       AND deleted_at IS NULL
     FOR UPDATE`,
    [orderId]
  );

  for (const refund of pendingRefunds.rows) {
    const nextStatus = newPaymentStatus === 'verified' ? 'pending' : 'rejected';
    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [nextStatus];
    let paramIndex = 2;

    if (nextStatus === 'pending') {
      const verifiedRes = await client.query(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0)::numeric AS verified_total
         FROM payments
         WHERE order_id = $1 AND deleted_at IS NULL`,
        [orderId]
      );
      const verifiedTotal = Number(verifiedRes.rows[0]?.verified_total || 0);
      updateFields.push(`amount_requested = $${paramIndex++}`);
      updateValues.push(verifiedTotal);
    }

    await client.query(
      `UPDATE refund_requests SET ${updateFields.join(', ')} WHERE refund_request_id = $${paramIndex} RETURNING *`,
      [...updateValues, refund.refund_request_id]
    );

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        null,
        nextStatus === 'pending' ? 'refund_pending_payment_verified' : 'refund_pending_payment_rejected',
        'project',
        refund.project_id,
        JSON.stringify({ refund_request_id: refund.refund_request_id, from: 'pending_payment_verification', to: nextStatus, order_id: orderId }),
      ]
    );
  }
};

/**
 * Admin transitions the refund request status. Only admins may approve/reject,
 * move to processing, and mark refunded. Wrapped in a transaction because
 * refunding also updates the payment row.
 */
exports.updateProjectRefundStatus = async (refundRequestId, status, adminUserId, userRole, data = {}) => {
  if (!['staff', 'admin', 'super_admin'].includes(userRole)) {
    throw new AppError('Only admins can update refund status', 403);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rrRes = await client.query(
      `SELECT * FROM refund_requests WHERE refund_request_id = $1 AND deleted_at IS NULL`,
      [refundRequestId]
    );
    if (rrRes.rows.length === 0) {
      throw new AppError('Refund request not found', 404);
    }
    const refund = rrRes.rows[0];

    const allowed = PROJECT_REFUND_TRANSITIONS[refund.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(`Invalid refund status transition from '${refund.status}' to '${status}'`, 400);
    }

    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [status];
    let paramIndex = 2;

    // Audit trail: record deciding admin + timestamp on every decision.
    updateFields.push(`reviewed_by = $${paramIndex++}`);
    updateValues.push(adminUserId);
    updateFields.push(`reviewed_at = CURRENT_TIMESTAMP`);

    if (data.adminNotes) {
      updateFields.push(`admin_notes = $${paramIndex++}`);
      updateValues.push(String(data.adminNotes).trim());
    }

    if (status === 'approved') {
      // Lock the amount on approval so it cannot be modified.
      updateFields.push(`requested_amount_locked = TRUE`);
    }

    if (status === 'refunded') {
      updateFields.push(`refunded_at = CURRENT_TIMESTAMP`);

      // Mark all verified payments for the project's order as refunded so the
      // whole paid amount (including down-payment installments) is reflected
      // in the same transaction.
      if (refund.payment_id) {
        const orderRes = await client.query(
          `SELECT order_id FROM refund_requests WHERE refund_request_id = $1`,
          [refundRequestId]
        );
        const orderId = orderRes.rows[0]?.order_id || null;
        if (orderId) {
          const verifiedRes = await client.query(
            `SELECT payment_id FROM payments
             WHERE order_id = $1 AND status = 'verified'
             ORDER BY created_at ASC
             FOR UPDATE`,
            [orderId]
          );
          const paymentIds = verifiedRes.rows.map((r) => r.payment_id);
          if (paymentIds.length > 0) {
            await client.query(
              `UPDATE payments
               SET status = 'refunded',
                   updated_at = CURRENT_TIMESTAMP
               WHERE payment_id = ANY($1::uuid[])`,
              [paymentIds]
            );
          }
        }
      }
    }

    updateValues.push(refundRequestId);
    const res = await client.query(
      `UPDATE refund_requests SET ${updateFields.join(', ')}
       WHERE refund_request_id = $${paramIndex} RETURNING *`,
      updateValues
    );

    // Log the admin decision action.
    const actionMap = {
      pending: 'refund_pending_payment_verified',
      rejected: 'refund_rejected',
      approved: 'refund_approved',
      processing: 'refund_processing',
      refunded: 'refund_refunded',
    };
    if (refund.project_id && actionMap[status]) {
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminUserId,
          actionMap[status],
          'project',
          refund.project_id,
          JSON.stringify({ refund_request_id: refundRequestId, from: refund.status, to: status }),
        ]
      );
    }

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};