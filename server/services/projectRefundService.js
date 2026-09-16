const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { generateRefundRequestNumber } = require('../utils/orderNumber');
const sharedRefundService = require('./refundService');

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

const formatPhp = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(val) || 0);

/**
 * Calculates the complete cancellation settlement for a customization project.
 * Analyzes progress, payments, procurement/parts costs, labor value, and determines
 * the exact refundable balance and physical items to be released.
 */
exports.calculateProjectCancellationSettlement = async (projectId, userId = null, userRole = null) => {
  const pRes = await pool.query(
    `SELECT p.*,
            p.title AS name,
            p.notes AS description,
            o.user_id AS customer_id,
            o.order_number,
            o.payment_plan AS order_payment_plan,
            o.total_amount AS order_total_amount,
            CONCAT(
              COALESCE(u.first_name, ''),
              CASE WHEN COALESCE(u.first_name, '') <> '' AND COALESCE(u.last_name, '') <> '' THEN ' ' ELSE '' END,
              COALESCE(u.last_name, '')
            ) AS customer_name,
            u.email AS customer_email,
            u.phone AS customer_phone
     FROM projects p
     JOIN orders o ON o.order_id = p.order_id
     LEFT JOIN users u ON u.user_id = o.user_id
     WHERE p.project_id = $1 AND p.deleted_at IS NULL`,
    [projectId]
  );
  if (pRes.rows.length === 0) {
    throw new AppError('Project not found', 404);
  }
  const project = pRes.rows[0];
  const isPrivileged = ['staff', 'admin', 'super_admin'].includes(userRole);
  if (userId && !isPrivileged && project.customer_id !== userId) {
    throw new AppError('You do not have access to this project', 403);
  }

  // 1. Payment Analysis
  const paymentsRes = await pool.query(
    `SELECT payment_id, amount, status, method, reference_number, created_at, updated_at
     FROM payments
     WHERE order_id = $1 AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [project.order_id]
  );
  let payments = paymentsRes.rows || [];

  if (payments.length === 0) {
    const verifiedRes = await pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0)::numeric AS verified_total,
         COUNT(*)::int AS total_payments,
         COUNT(*) FILTER (WHERE status = 'verified')::int AS verified_payments,
         BOOL_OR(status = 'refunded') AS has_refunded
       FROM payments
       WHERE order_id = $1 AND deleted_at IS NULL`,
      [project.order_id]
    );
    const payRow = verifiedRes.rows[0];
    if (payRow && (payRow.total_payments > 0 || Number(payRow.verified_total) > 0)) {
      const vTotal = Number(payRow.verified_total || 0);
      payments = [{
        payment_id: 'pay-1',
        amount: vTotal,
        status: vTotal > 0 ? 'verified' : 'pending',
        method: 'gcash',
        created_at: new Date(),
      }];
    }
  }

  const verifiedTotal = Number(
    payments
      .filter((p) => p.status === 'verified')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
      .toFixed(2)
  );
  const forVerificationTotal = Number(
    payments
      .filter((p) => ['pending', 'for_verification'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
      .toFixed(2)
  );
  const refundedTotal = Number(
    payments
      .filter((p) => p.status === 'refunded')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
      .toFixed(2)
  );

  const totalPrice = Number(project.order_total_amount || 0);

  let paymentStatus = 'unpaid';
  if (verifiedTotal >= totalPrice && totalPrice > 0) {
    paymentStatus = 'fully_paid';
  } else if (verifiedTotal > 0) {
    paymentStatus = 'partially_paid';
  } else if (forVerificationTotal > 0) {
    paymentStatus = 'for_verification';
  } else if (payments.length > 0 && payments.every((p) => p.status === 'rejected')) {
    paymentStatus = 'rejected';
  }

  // 2. Project Task & Milestone Progress Analysis
  const subtasksRes = await pool.query(
    `SELECT ps.subtask_id, ps.title, ps.status AS subtask_status, ps.completed_at,
            pm.milestone_id, pm.title AS milestone_title, pm.order_index, pm.status AS milestone_status
     FROM project_milestones pm
     LEFT JOIN project_subtasks ps ON ps.milestone_id = pm.milestone_id
     WHERE pm.project_id = $1 AND pm.deleted_at IS NULL
     ORDER BY pm.order_index ASC, ps.created_at ASC`,
    [projectId]
  );

  const milestonesMap = new Map();
  let totalTasks = 0;
  let completedTasks = 0;

  subtasksRes.rows.forEach((row) => {
    if (!milestonesMap.has(row.milestone_id)) {
      milestonesMap.set(row.milestone_id, {
        milestone_id: row.milestone_id,
        title: row.milestone_title,
        order_index: row.order_index,
        status: row.milestone_status,
        total_subtasks: 0,
        completed_subtasks: 0,
      });
    }
    const m = milestonesMap.get(row.milestone_id);
    if (row.subtask_id) {
      m.total_subtasks++;
      totalTasks++;
      if (row.subtask_status === 'completed') {
        m.completed_subtasks++;
        completedTasks++;
      }
    }
  });

  const stages = Array.from(milestonesMap.values()).map((m) => {
    let stageStatus = 'pending';
    if (m.total_subtasks > 0) {
      if (m.completed_subtasks === m.total_subtasks) stageStatus = 'completed';
      else if (m.completed_subtasks > 0) stageStatus = 'in_progress';
    } else if (m.status === 'completed') {
      stageStatus = 'completed';
    }
    return {
      ...m,
      status: stageStatus,
    };
  });

  const statsRes = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(CASE WHEN ps.status = 'completed' THEN 1 END)::int AS completed
     FROM project_subtasks ps
     JOIN project_milestones pm ON ps.milestone_id = pm.milestone_id
     WHERE pm.project_id = $1`,
    [projectId]
  );
  const legacyStats = statsRes.rows[0] || { total: 0, completed: 0 };
  const legacyTotal = Number(legacyStats.total || 0);
  const legacyCompleted = Number(legacyStats.completed || 0);

  const finalTotalTasks = totalTasks > 0 ? totalTasks : legacyTotal;
  const finalCompletedTasks = completedTasks > 0 ? completedTasks : legacyCompleted;

  const progress = finalTotalTasks > 0
    ? Math.round((finalCompletedTasks / finalTotalTasks) * 100)
    : (Number(project.progress) || 0);
  const hasStarted = progress > 0 || finalCompletedTasks > 0 || finalTotalTasks > 0;
  const lastCompletedStage = project.cancelled_stage_snapshot || project.last_completed_stage || null;

  // 3. Parts & Procurement Analysis
  const projectService = require('./projectService');
  let requiredParts = [];
  try {
    requiredParts = (await projectService.getProjectRequiredParts(projectId)) || [];
  } catch (err) {
    console.warn('[projectRefundService] Error fetching required parts:', err.message);
  }

  let allPartsCost = 0;
  let partsPurchasedCost = 0;
  let partsReceivedCost = 0;
  const purchasedPartsList = [];
  const allPartsList = [];

  requiredParts.forEach((part) => {
    const qty = Number(part.quantity) || 1;
    const price = Number(part.price) || 0;
    const itemTotal = price * qty;
    allPartsCost += itemTotal;

    const receivedQty = Number(part.received_quantity) || 0;
    const isReceived = part.is_received || receivedQty > 0;

    const partInfo = {
      name: part.name,
      category: part.category || 'general',
      quantity: qty,
      received_quantity: receivedQty,
      price,
      total_price: itemTotal,
      is_received: isReceived,
      stock_status: part.stock_status,
      supplier: part.supplier || null,
      received_at: part.received_at || null,
    };
    allPartsList.push(partInfo);

    if (isReceived) {
      const receivedCost = price * Math.max(receivedQty, 1);
      partsPurchasedCost += receivedCost;
      partsReceivedCost += receivedCost;
      purchasedPartsList.push(partInfo);
    }
  });

  allPartsCost = Number(allPartsCost.toFixed(2));
  partsPurchasedCost = Number(partsPurchasedCost.toFixed(2));
  partsReceivedCost = Number(partsReceivedCost.toFixed(2));

  // 4. Labor / Work Valuation
  let laborBase = totalPrice - allPartsCost;
  if (laborBase <= 0) {
    laborBase = totalPrice * 0.40;
  }
  const completedLaborCost = hasStarted ? Number((laborBase * (progress / 100)).toFixed(2)) : 0;

  // 5. Settlement Math
  const nonRefundableTotal = Number((partsPurchasedCost + completedLaborCost).toFixed(2));
  const refundableAmount = Number(Math.max(0, verifiedTotal - nonRefundableTotal).toFixed(2));

  // 6. Resolution Classification
  let recommendedResolution = 'no_refund';
  let physicalReleaseType = 'none'; // 'none' | 'parts' | 'current_build'

  if (!hasStarted) {
    if (verifiedTotal > 0) {
      recommendedResolution = 'full_refund';
    } else if (forVerificationTotal > 0) {
      recommendedResolution = 'full_refund_pending_verification';
    } else {
      recommendedResolution = 'no_refund';
    }
  } else {
    // Started project
    if (progress < 25) {
      // Early stage
      const hasPurchasedParts = partsPurchasedCost > 0 || purchasedPartsList.length > 0;
      if (refundableAmount > 0 && hasPurchasedParts) {
        recommendedResolution = 'partial_refund_and_parts';
        physicalReleaseType = 'parts';
      } else if (refundableAmount > 0 && !hasPurchasedParts) {
        recommendedResolution = 'partial_refund';
      } else if (hasPurchasedParts) {
        recommendedResolution = 'parts_returned';
        physicalReleaseType = 'parts';
      } else {
        recommendedResolution = 'no_refund';
      }
    } else {
      // Mid to near completion stage (>= 25%)
      physicalReleaseType = 'current_build';
      if (refundableAmount > 0) {
        recommendedResolution = 'partial_refund_and_build';
      } else {
        recommendedResolution = 'current_build_released';
      }
    }
  }

  // 7. Active Refund Request Details
  const refundReqRes = await pool.query(
    `SELECT * FROM refund_requests
     WHERE project_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  );
  const activeRefund = refundReqRes.rows[0] || null;

  let refundStatus = 'not_applicable';
  if (activeRefund) {
    refundStatus = activeRefund.status;
  } else if (project.status === 'cancelled') {
    if (forVerificationTotal > 0 && verifiedTotal === 0) {
      refundStatus = 'pending_payment_verification';
    } else if (refundableAmount > 0) {
      refundStatus = 'pending';
    } else {
      refundStatus = 'no_refund_due';
    }
  }

  // 8. Active Current Build Claim Details
  const claimRes = await pool.query(
    `SELECT * FROM current_build_claims
     WHERE project_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  );
  const activeClaim = claimRes.rows[0] || null;

  // 9. Structured 11-Question Customer-Facing Answers
  const qa = {
    why_cancelled: project.cancel_reason || (project.status === 'cancelled' ? 'Project cancelled by customer request.' : 'Not cancelled.'),
    how_much_paid: verifiedTotal,
    what_happened_to_payment: hasStarted
      ? `You have paid ${formatPhp(verifiedTotal)}. ₱${partsPurchasedCost.toLocaleString()} was used for build parts/materials, and ₱${completedLaborCost.toLocaleString()} accounted for completed labor/workmanship (${progress}% completed). The remaining refundable balance is ₱${refundableAmount.toLocaleString()}.`
      : `You have paid ${formatPhp(verifiedTotal)}. Since work had not started and no project parts were consumed, your eligible verified payment is 100% refundable.`,
    how_much_refund: activeRefund?.approved_amount !== null && activeRefund?.approved_amount !== undefined
      ? Number(activeRefund.approved_amount)
      : activeRefund?.refunded_amount !== null && activeRefund?.refunded_amount !== undefined
      ? Number(activeRefund.refunded_amount)
      : activeRefund?.amount_requested
      ? Number(activeRefund.amount_requested)
      : refundableAmount,
    why_refundable: `Calculated from total verified payments (₱${verifiedTotal.toLocaleString()}) minus non-refundable incurred costs: parts purchased (₱${partsPurchasedCost.toLocaleString()}) and completed work (₱${completedLaborCost.toLocaleString()}).`,
    what_happened_to_parts: purchasedPartsList.length > 0
      ? `${purchasedPartsList.length} part(s) totaling ₱${partsPurchasedCost.toLocaleString()} were acquired for your build and are designated for release to you.`
      : 'No project parts were purchased or received for this build.',
    what_happened_to_work: lastCompletedStage
      ? `Manufacturing progressed to "${lastCompletedStage}" (${progress}% completed). The current guitar build is snapshotted for release.`
      : hasStarted
      ? `Manufacturing had started (${progress}% completed) before cancellation.`
      : 'No manufacturing work was performed before cancellation.',
    do_i_receive_items: physicalReleaseType === 'current_build'
      ? 'You will receive the guitar in its current build state.'
      : physicalReleaseType === 'parts'
      ? 'You will receive the purchased parts/materials for your build.'
      : 'No physical parts or build items are released; settlement is processed via cash/online refund.',
    when_refund: activeRefund?.status === 'refunded'
      ? `Refund was completed on ${new Date(activeRefund.refunded_at || activeRefund.updated_at).toLocaleDateString('en-PH')}.`
      : activeRefund?.status === 'processing'
      ? 'Your refund is currently being processed by our finance team.'
      : activeRefund?.status === 'approved'
      ? 'Your refund has been approved and is queued for payout.'
      : refundStatus === 'pending_payment_verification'
      ? 'Your refund will proceed once your payment proof is verified by admin.'
      : refundableAmount > 0
      ? 'Your refund is under review by admin.'
      : 'No cash refund is due for this cancellation settlement.',
    where_receive_items: activeClaim?.claim_method === 'courier'
      ? `Courier delivery arranged${activeClaim.courier_service ? ` via ${activeClaim.courier_service}` : ''}${activeClaim.courier_reference ? ` (Tracking: ${activeClaim.courier_reference})` : ''}.`
      : activeClaim?.claim_method === 'pickup'
      ? `Available for pickup at our workshop${activeClaim.pickup_location ? `: ${activeClaim.pickup_location}` : ''}.`
      : physicalReleaseType !== 'none'
      ? 'Awaiting pickup or delivery arrangement choice.'
      : 'N/A — Monetary settlement only.',
    refund_reference_number: activeRefund?.refund_reference || activeRefund?.request_number || (activeRefund ? `RF-${activeRefund.refund_request_id.slice(0, 8).toUpperCase()}` : null),
  };

  return {
    project_id: projectId,
    order_id: project.order_id,
    order_number: project.order_number,
    custom_build_id: project.custom_build_id,
    project_title: project.title || project.name,
    project_status: project.status,
    customer_id: project.customer_id,
    customer_name: project.customer_name,
    customer_email: project.customer_email,
    customer_phone: project.customer_phone,
    payment_plan: project.order_payment_plan || 'full_payment',

    // Financial breakdown
    financials: {
      total_price: totalPrice,
      total_paid: verifiedTotal,
      verified_total: verifiedTotal,
      for_verification_total: forVerificationTotal,
      refunded_total: refundedTotal,
      payment_status: paymentStatus,
      payments,
      parts_purchased_cost: partsPurchasedCost,
      parts_received_cost: partsReceivedCost,
      all_parts_cost: allPartsCost,
      completed_labor_cost: completedLaborCost,
      total_labor_value: laborBase,
      non_refundable_total: nonRefundableTotal,
      refundable_amount: refundableAmount,
    },

    // Progress & Stages
    progress: {
      percentage: progress,
      has_started: hasStarted,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      last_completed_stage: lastCompletedStage,
      cancelled_stage_snapshot: project.cancelled_stage_snapshot,
      stages,
    },

    // Parts
    parts: {
      all_parts: allPartsList,
      purchased_parts: purchasedPartsList,
      purchased_count: purchasedPartsList.length,
      total_parts_count: allPartsList.length,
    },

    // Resolution & States
    resolution: {
      recommended: recommendedResolution,
      actual: project.cancel_resolution || (project.status === 'cancelled' ? recommendedResolution : null),
      physical_release_type: physicalReleaseType,
      cancel_option: project.cancel_option,
      cancel_reason: project.cancel_reason,
      cancel_requested_at: project.cancel_requested_at,
      cancel_approved_at: project.cancel_approved_at,
      cancel_approved_by: project.cancel_approved_by,
    },

    // Refund details
    refund: activeRefund ? {
      refund_request_id: activeRefund.refund_request_id,
      request_number: activeRefund.request_number,
      status: activeRefund.status,
      refund_type: activeRefund.refund_type,
      amount_requested: Number(activeRefund.amount_requested || 0),
      approved_amount: activeRefund.approved_amount !== null ? Number(activeRefund.approved_amount) : null,
      refunded_amount: activeRefund.refunded_amount !== null ? Number(activeRefund.refunded_amount) : null,
      refund_method: activeRefund.refund_method,
      refund_reference: activeRefund.refund_reference,
      refund_fee: Number(activeRefund.refund_fee || 0),
      rejection_reason: activeRefund.rejection_reason,
      created_at: activeRefund.created_at,
      approved_at: activeRefund.approved_at,
      processing_at: activeRefund.processing_at,
      refunded_at: activeRefund.refunded_at,
    } : null,
    refund_status: refundStatus,

    // Build claim details
    build_claim: activeClaim ? {
      claim_id: activeClaim.claim_id,
      claim_status: activeClaim.claim_status,
      claim_method: activeClaim.claim_method,
      progress_at_cancellation: activeClaim.progress_at_cancellation,
      current_build_stage: activeClaim.current_build_stage,
      current_state_photos: activeClaim.current_state_photos,
      courier_service: activeClaim.courier_service,
      courier_reference: activeClaim.courier_reference,
      delivery_fee: activeClaim.delivery_fee,
      estimated_delivery_date: activeClaim.estimated_delivery_date,
      pickup_location: activeClaim.pickup_location,
      pickup_schedule: activeClaim.pickup_schedule,
      admin_confirmation_notes: activeClaim.admin_confirmation_notes,
      received_at: activeClaim.received_at,
    } : null,
    claim_status: activeClaim?.claim_status || (physicalReleaseType !== 'none' ? 'pending_customer_selection' : 'not_required'),

    // 11 Critical Questions Answered
    qa,
  };
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

  // Compute settlement
  const settlement = await exports.calculateProjectCancellationSettlement(projectId, userId, userRole);

  if (settlement.progress.has_started) {
    eligible = false;
    reasons.push('Build has already started. Your down payment was used to purchase parts and materials, which are not refundable. You will receive the guitar in its current build state through the Current Build Claim process.');
  }

  const pay = settlement.financials;

  if (pay.payments.length === 0) {
    eligible = false;
    reasons.push('No payment record found for this project.');
  } else if (pay.verified_total === 0) {
    eligible = false;
    if (pay.for_verification_total > 0) {
      reasons.push('Payment verification is currently pending. Refund request can proceed once payment is verified.');
    } else {
      reasons.push('No verified payments recorded for this project.');
    }
  }

  // 3. Payment has not already been refunded.
  if (pay.refunded_total > 0 && pay.refundable_amount <= 0) {
    eligible = false;
    reasons.push('This payment has already been refunded.');
  }

  // 4. No existing pending or approved request for this project/payment.
  const existingRes = await pool.query(
    `SELECT refund_request_id FROM refund_requests
     WHERE project_id = $1
       AND status IN ('pending', 'approved', 'processing')
       AND deleted_at IS NULL
     LIMIT 1`,
    [projectId]
  );
  if (existingRes.rows.length > 0) {
    eligible = false;
    reasons.push('A refund request is already pending or approved for this project.');
  }

  const latestVerified = pay.payments.filter((p) => p.status === 'verified').slice(-1)[0] || null;

  return {
    eligible,
    refundable_amount: settlement.financials.refundable_amount,
    payment_type: project.order_payment_plan || 'full_payment',
    payment_status: latestVerified?.status || null,
    payment_id: latestVerified?.payment_id || null,
    has_build_progress: settlement.progress.has_started,
    settlement,
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

  return sharedRefundService.applyTransition(refundRequestId, status, adminUserId, userRole, {
    adminNotes: data.adminNotes,
    rejectionReason: data.rejectionReason || data.rejection_reason,
    approvedAmount: data.approvedAmount ?? data.approved_amount,
    adjustmentReason: data.adjustmentReason,
    refundMethod: data.refundMethod || data.refund_method,
    refundReference: data.refundReference || data.refund_reference,
    refundFee: data.refundFee ?? data.refund_fee,
  });
};

/**
 * Customer withdraws a project refund request while still pending.
 */
exports.withdrawProjectRefund = async (refundRequestId, userId) => {
  return sharedRefundService.withdrawRefund(refundRequestId, userId);
};
