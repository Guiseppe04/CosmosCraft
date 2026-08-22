const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('./notificationService');
const inventoryService = require('./inventoryService');

/**
 * SHARED REFUND SERVICE
 *
 * Single source of truth for refund state transitions across both
 * regular product orders and customization projects.
 *
 * If a transaction client is provided (e.g. an existing admin approval
 * transaction in projectService), operations join that transaction.
 * Otherwise a new transaction is started automatically.
 */

const REFUND_TRANSITIONS = {
  pending_payment_verification: ['pending', 'rejected', 'withdrawn'],
  pending: ['approved', 'rejected', 'withdrawn'],
  approved: ['processing', 'return_pending', 'rejected'],
  return_pending: ['returned', 'rejected'],
  returned: ['return_confirmed', 'rejected'],
  return_confirmed: ['processing'],
  processing: ['refunded'],
  rejected: [],
  refunded: [],
  withdrawn: [],
};

const RETURN_STATUS_TRANSITIONS = {
  return_pending: ['returned'],
  returned: ['return_confirmed'],
  return_confirmed: [],
  not_required: [],
  return_in_transit: ['returned'],
};

const VALID_REFUND_EXECUTION_FIELDS = [
  'refund_method',
  'refund_reference',
  'refund_fee',
  'processed_by',
];

const canTransition = (from, to) => {
  const allowed = REFUND_TRANSITIONS[from] || [];
  return allowed.includes(to);
};

const canTransitionReturn = (from, to) => {
  const allowed = RETURN_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
};

const getRefundById = async (db, refundId) => {
  const res = await db.query(
    `SELECT rr.*,
            o.user_id AS customer_id,
            o.order_id,
            o.status AS order_status,
            o.payment_status AS order_payment_status
     FROM refund_requests rr
     JOIN orders o ON o.order_id = rr.order_id
     WHERE rr.refund_request_id = $1 AND rr.deleted_at IS NULL`,
    [refundId]
  );
  return res.rows[0] || null;
};

const getVerifiedPaymentTotal = async (db, orderId) => {
  const res = await db.query(
    `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0)::numeric AS verified_total
     FROM payments
     WHERE order_id = $1 AND deleted_at IS NULL`,
    [orderId]
  );
  return Number(res.rows[0]?.verified_total || 0);
};

/**
 * Mark all verified payments for an order as refunded and sync the order
 * payment status. Called exactly once when a refund reaches `refunded`.
 */
const syncPaymentsAndOrderToRefunded = async (client, orderId) => {
  const paymentRes = await client.query(
    `SELECT payment_id FROM payments
     WHERE order_id = $1 AND status = 'verified'
     ORDER BY created_at ASC
     FOR UPDATE`,
    [orderId]
  );
  const paymentIds = paymentRes.rows.map((r) => r.payment_id);
  if (paymentIds.length > 0) {
    await client.query(
      `UPDATE payments
       SET status = 'refunded', updated_at = CURRENT_TIMESTAMP
       WHERE payment_id = ANY($1::uuid[])`,
      [paymentIds]
    );
  }

  // Sync order payment status. order_payment_status_enum supports 'refunded'
  // after migration 20. If the enum value is not present yet, fall back to
  // 'approved' rather than forcing an invalid value.
  try {
    await client.query(
      `UPDATE orders
       SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1`,
      [orderId]
    );
  } catch (err) {
    if (err.code === '22P02' || /invalid input value/i.test(err.message)) {
      // Enum not yet migrated — keep 'approved'.
      await client.query(
        `UPDATE orders
         SET payment_status = 'approved', updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1`,
        [orderId]
      );
    } else {
      throw err;
    }
  }
};

/**
 * Restock refunded physical items. Idempotent: uses refund_restock_log with
 * UNIQUE(refund_request_id, order_item_id) so a retry never restocks twice.
 */
const restockRefundedItems = async (client, refund, actorId) => {
  if (refund.restocked_at) {
    return { restocked: 0, already_restocked: true };
  }

  // Determine the items to restock.
  // Order-scoped refunds: refund_request_items join order_items for product_id.
  // Project-scoped money refunds for not-started projects have no physical
  // items to restock (parts were never deducted for a project that never
  // started) — restock only refund_request_items with a product_id.
  const itemsRes = await client.query(
    `SELECT rri.refund_request_id,
            rri.order_item_id,
            oi.product_id,
            rri.quantity
     FROM refund_request_items rri
     LEFT JOIN order_items oi ON oi.order_item_id = rri.order_item_id
     WHERE rri.refund_request_id = $1 AND rri.deleted_at IS NULL
       AND oi.product_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM refund_restock_log rl
         WHERE rl.refund_request_id = rri.refund_request_id
           AND rl.order_item_id = rri.order_item_id
       )`,
    [refund.refund_request_id]
  );

  let restocked = 0;
  for (const item of itemsRes.rows) {
    const quantity = Number(item.quantity || 0);
    if (quantity <= 0 || !item.product_id) continue;

    // Insert restock log first (uniqueness prevents double restock).
    try {
      await client.query(
        `INSERT INTO refund_restock_log (refund_request_id, order_item_id, product_id, quantity, restocked_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [refund.refund_request_id, item.order_item_id, item.product_id, quantity, actorId]
      );
    } catch (err) {
      // UNIQUE violation → already restocked; skip.
      if (err.code === '23505') continue;
      throw err;
    }

    await inventoryService.addStock(item.product_id, quantity, {
      notes: `Restock from refund request ${refund.request_number || refund.refund_request_id}`,
      createdBy: actorId,
      client,
    });
    restocked++;
  }

  if (restocked > 0 || itemsRes.rows.length === 0) {
    await client.query(
      `UPDATE refund_requests
       SET restocked_at = CURRENT_TIMESTAMP, restocked_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE refund_request_id = $1`,
      [refund.refund_request_id, actorId]
    );
  }

  return { restocked, already_restocked: false };
};

const sendRefundNotification = async (userId, title, message, entityId, entityType) => {
  try {
    await notificationService.createNotification({
      user_id: userId,
      title,
      message,
      type: 'refund',
      related_entity_id: entityId || null,
      related_entity_type: entityType || null,
    });
  } catch (err) {
    // Notification failures must not block the refund transition.
    console.warn('Failed to send refund notification:', err.message);
  }
};

const getRefundEntityInfo = async (db, refund) => {
  if (refund.project_id) {
    return { entityType: 'project', entityId: refund.project_id };
  }
  return { entityType: 'orders', entityId: refund.order_id };
};

/**
 * Apply a refund status transition. Used by both orderService and
 * projectRefundService so the state machine is identical everywhere.
 *
 * @param {string} refundId
 * @param {string} newStatus target status
 * @param {string} actorId user performing the action
 * @param {string} actorRole role of the user
 * @param {object} data { adminNotes, rejectionReason, approvedAmount,
 *   adjustmentReason, refundMethod, refundReference, refundFee }
 */
exports.applyTransition = async (refundId, newStatus, actorId, actorRole, data = {}, providedClient = null) => {
  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(actorRole);

  const ownClient = !providedClient;
  const client = providedClient || await pool.connect();
  try {
    if (ownClient) await client.query('BEGIN');

    const refund = await getRefundById(client, refundId);
    if (!refund) throw new AppError('Refund request not found', 404);

    const from = refund.status;

    // Withdrawal is customer-initiated; all other transitions require staff+.
    if (newStatus === 'withdrawn') {
      if (isPrivileged && data.adminOnly !== true) {
        // Allow admin withdraw only when explicitly requested via admin path.
      }
      if (['pending', 'pending_payment_verification'].includes(from)) {
        // Customer withdraw is allowed below via exports.withdrawRefund instead.
      }
    }

    if (!canTransition(from, newStatus)) {
      throw new AppError(`Invalid refund status transition from '${from}' to '${newStatus}'`, 400);
    }

    // Amount adjustment validation — only on approval and never above verified total.
    if (newStatus === 'approved') {
      const verifiedTotal = await getVerifiedPaymentTotal(client, refund.order_id);
      const approvedAmount =
        data.approvedAmount !== undefined && data.approvedAmount !== null
          ? Number(data.approvedAmount)
          : Number(refund.amount_requested || 0);

      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
        throw new AppError('Approved refund amount must be greater than 0', 400);
      }
      if (approvedAmount > verifiedTotal) {
        throw new AppError(
          `Approved amount (${approvedAmount}) cannot exceed verified payment total (${verifiedTotal})`,
          400
        );
      }
      data.approvedAmount = approvedAmount;
      data.adjustmentAmount = Number((approvedAmount - Number(refund.amount_requested || 0)).toFixed(2));
      data.adjustmentReason = data.adjustmentReason || null;
    }

    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [newStatus];
    let paramIndex = 2;

    const push = (sql, value) => {
      updateFields.push(`${sql} = $${paramIndex++}`);
      updateValues.push(value);
    };

    push('reviewed_by', actorId);
    push('reviewed_at', new Date().toISOString());

    if (data.adminNotes) push('admin_notes', String(data.adminNotes).trim());
    if (data.rejectionReason) push('rejection_reason', String(data.rejectionReason).trim());

    if (newStatus === 'approved') {
      push('approved_amount', data.approvedAmount);
      push('adjustment_amount', data.adjustmentAmount);
      push('adjusted_by', actorId);
      push('adjusted_at', new Date().toISOString());
      if (data.adjustmentReason) push('adjustment_reason', String(data.adjustmentReason).trim());
      push('approved_at', new Date().toISOString());
      push('requested_amount_locked', true);
      if (data.requiresReturn === true && !refund.project_id) {
        // Physical return required for regular product orders.
        push('return_status', 'return_pending');
      } else {
        push('return_status', 'not_required');
      }
    }

    if (newStatus === 'processing') {
      push('processing_at', new Date().toISOString());
      // Lock execution fields at processing time.
      for (const field of VALID_REFUND_EXECUTION_FIELDS) {
        if (data[field] !== undefined && data[field] !== null) {
          const column = field === 'processed_by' ? 'processed_by' : field;
          push(column, data[field]);
        }
      }
      if (data.refundFee !== undefined && data.refundFee !== null) {
        push('refund_fee', Number(data.refundFee) || 0);
      }
      // When entering processing from return_confirmed, restock happens at refunded.
    }

    if (newStatus === 'refunded') {
      push('refunded_amount', refund.approved_amount || refund.amount_requested || 0);
      push('refunded_at', new Date().toISOString());
      push('processed_by', actorId);

      // Sync payments + order payment status.
      await syncPaymentsAndOrderToRefunded(client, refund.order_id);

      // Restock returned physical items (idempotent).
      if (refund.return_status === 'return_confirmed' || !refund.project_id) {
        await restockRefundedItems(client, refund, actorId);
      }
    }

    if (newStatus === 'rejected' && !data.rejectionReason) {
      push('rejection_reason', 'Rejected by admin');
    }
    if (newStatus === 'cancelled_at_approval') {
      // reserved for future use
    }

    updateValues.push(refundId);
    const res = await client.query(
      `UPDATE refund_requests SET ${updateFields.join(', ')}
       WHERE refund_request_id = $${paramIndex} RETURNING *`,
      updateValues
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        actorId,
        `refund_${newStatus}`,
        refund.project_id ? 'project' : 'order',
        refund.project_id || refund.order_id,
        JSON.stringify({ refund_request_id: refundId, from, to: newStatus }),
      ]
    );

    // Notifications (only after commit for robustness, but within same process okay).
    const { entityType, entityId } = await getRefundEntityInfo(client, refund);
    const customerId = refund.customer_id;

    const notificationMap = {
      pending_payment_verification: ['Payment verification required', 'Your refund request is pending payment verification. Once the admin verifies your payment, your refund can proceed.'],
      pending: ['Refund submitted', 'Your refund request has been submitted and is waiting for admin review.'],
      approved: ['Refund approved', 'Your refund request has been approved.'],
      rejected: ['Refund rejected', `Your refund request was rejected.${data.rejectionReason ? ` Reason: ${data.rejectionReason}` : ''}`],
      processing: ['Refund processing', 'Your refund is now being processed.'],
      refunded: ['Refund completed', 'Your refund has been completed.'],
      withdrawn: ['Refund withdrawn', 'Your refund request was withdrawn.'],
    };

    if (notificationMap[newStatus] && !isPrivileged) {
      // Customer-triggered withdrawn — handled by exports.withdrawRefund instead.
    } else if (notificationMap[newStatus]) {
      await sendRefundNotification(customerId, notificationMap[newStatus][0], notificationMap[newStatus][1], entityId, entityType);
    }

    if (ownClient) await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    if (ownClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownClient) client.release();
  }
};

/**
 * Customer withdraws a refund request while it is still pending or
 * pending_payment_verification. No payment or inventory changes.
 */
exports.withdrawRefund = async (refundId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const refund = await getRefundById(client, refundId);
    if (!refund) throw new AppError('Refund request not found', 404);

    if (refund.customer_id !== userId) {
      throw new AppError('You do not have access to this refund request', 403);
    }

    if (!['pending', 'pending_payment_verification'].includes(refund.status)) {
      throw new AppError(`Refund can only be withdrawn while pending. Current status: ${refund.status}`, 400);
    }

    const res = await client.query(
      `UPDATE refund_requests
       SET status = 'withdrawn',
           withdrawn_at = CURRENT_TIMESTAMP,
           withdrawn_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE refund_request_id = $1 RETURNING *`,
      [refundId, userId]
    );

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'refund_withdrawn',
        refund.project_id ? 'project' : 'order',
        refund.project_id || refund.order_id,
        JSON.stringify({ refund_request_id: refundId, from: refund.status, to: 'withdrawn' }),
      ]
    );

    const { entityType, entityId } = await getRefundEntityInfo(client, refund);
    await sendRefundNotification(userId, 'Refund withdrawn', 'Your refund request was withdrawn.', entityId, entityType);

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Update the return status of a refund (for physical product returns).
 * return_pending → returned (customer) → return_confirmed (admin).
 */
exports.updateReturnStatus = async (refundId, returnStatus, actorId, actorRole, data = {}) => {
  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(actorRole);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const refund = await getRefundById(client, refundId);
    if (!refund) throw new AppError('Refund request not found', 404);

    if (refund.status !== 'approved' && !['return_pending', 'returned'].includes(refund.status)) {
      throw new AppError(`Return status can only be updated while refund is approved or in return. Current status: ${refund.status}`, 400);
    }

    const currentReturn = refund.return_status || 'return_pending';
    if (!canTransitionReturn(currentReturn, returnStatus)) {
      throw new AppError(`Invalid return status transition from '${currentReturn}' to '${returnStatus}'`, 400);
    }

    if (returnStatus === 'returned' && isPrivileged) {
      throw new AppError('Only the customer can confirm the item has been returned', 403);
    }
    if (returnStatus === 'return_confirmed' && !isPrivileged) {
      throw new AppError('Only admins can confirm the return', 403);
    }
    if (returnStatus === 'returned' && !isPrivileged && refund.customer_id !== actorId) {
      throw new AppError('You do not have access to this refund request', 403);
    }

    const updateFields = [
      'return_status = $1',
      'updated_at = CURRENT_TIMESTAMP',
    ];
    const updateValues = [returnStatus];
    let paramIndex = 2;

    if (data.returnReference) {
      updateFields.push(`return_reference = $${paramIndex++}`);
      updateValues.push(String(data.returnReference).trim());
    }
    if (data.returnMethod) {
      updateFields.push(`return_method = $${paramIndex++}`);
      updateValues.push(String(data.returnMethod).trim());
    }
    if (returnStatus === 'return_confirmed') {
      updateFields.push(`return_confirmed_by = $${paramIndex++}`);
      updateValues.push(actorId);
      updateFields.push(`return_confirmed_at = CURRENT_TIMESTAMP`);
    }

    updateValues.push(refundId);
    const res = await client.query(
      `UPDATE refund_requests SET ${updateFields.join(', ')}
       WHERE refund_request_id = $${paramIndex} RETURNING *`,
      updateValues
    );

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        actorId,
        `refund_return_${returnStatus}`,
        refund.project_id ? 'project' : 'order',
        refund.project_id || refund.order_id,
        JSON.stringify({ refund_request_id: refundId, from: currentReturn, to: returnStatus }),
      ]
    );

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  REFUND_TRANSITIONS,
  canTransition,
  applyTransition: exports.applyTransition,
  withdrawRefund: exports.withdrawRefund,
  updateReturnStatus: exports.updateReturnStatus,
};