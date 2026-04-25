const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

exports.PAYMENT_METHODS = {
  GCASH: 'gcash',
  BANK_TRANSFER: 'bank_transfer',
  CASH: 'cash',
};

exports.PAYMENT_STATUS = {
  PENDING: 'pending',
  FOR_VERIFICATION: 'for_verification',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

const ORDER_PAYMENT_STATUS = {
  PENDING: 'pending',
  PROOF_SUBMITTED: 'proof_submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FAILED: 'failed',
};

exports.createPayment = createPayment;
exports.uploadProofOfPayment = uploadProofOfPayment;
exports.verifyPayment = verifyPayment;
exports.rejectPayment = rejectPayment;
exports.cancelPayment = cancelPayment;
exports.listPayments = listPayments;
exports.getPaymentsCount = getPaymentsCount;
exports.getPaymentInstructions = getPaymentInstructions;
exports.getAllPaymentMethods = getAllPaymentMethods;
exports.getPaymentStats = getPaymentStats;
exports.refundPayment = refundPayment;
exports.getPaymentsByUser = getPaymentsByUser;
exports.getPaymentsByUserCount = getPaymentsByUserCount;
exports.getPaymentById = getPaymentById;
exports.getPaymentByOrderId = getPaymentByOrderId;
exports.checkIdempotency = checkIdempotency;

const STATUS_TRANSITIONS = {
  [exports.PAYMENT_STATUS.PENDING]: [exports.PAYMENT_STATUS.FOR_VERIFICATION, exports.PAYMENT_STATUS.CANCELLED],
  [exports.PAYMENT_STATUS.FOR_VERIFICATION]: [exports.PAYMENT_STATUS.VERIFIED, exports.PAYMENT_STATUS.REJECTED, exports.PAYMENT_STATUS.CANCELLED],
  [exports.PAYMENT_STATUS.VERIFIED]: [exports.PAYMENT_STATUS.REFUNDED],
  [exports.PAYMENT_STATUS.REJECTED]: [exports.PAYMENT_STATUS.PENDING],
  [exports.PAYMENT_STATUS.CANCELLED]: [],
  [exports.PAYMENT_STATUS.REFUNDED]: [],
};

async function ensureProjectForCustomBuildOrder(client, orderId) {
  const existingProjectRes = await client.query(
    'SELECT project_id FROM projects WHERE order_id = $1',
    [orderId]
  );

  if (existingProjectRes.rows.length > 0) {
    return existingProjectRes.rows[0];
  }

  const customBuildOrderRes = await client.query(
    `SELECT
       o.order_id,
       o.order_number,
       o.notes,
       COALESCE(c.name, oi.product_name, 'Custom Build') AS build_name
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.order_id
     LEFT JOIN customizations c ON c.customization_id = oi.customization_id
     WHERE o.order_id = $1
       AND oi.customization_id IS NOT NULL
     ORDER BY oi.quantity DESC, oi.unit_price DESC
     LIMIT 1`,
    [orderId]
  );

  const customBuildOrder = customBuildOrderRes.rows[0];

  if (!customBuildOrder) {
    return null;
  }

  const title = customBuildOrder.order_number
    ? `${customBuildOrder.build_name} (${customBuildOrder.order_number})`
    : customBuildOrder.build_name;

  const notes = [
    customBuildOrder.notes,
    `Auto-created from custom build payment for order ${customBuildOrder.order_number || customBuildOrder.order_id}.`,
  ].filter(Boolean).join('\n\n');

  const projectRes = await client.query(
    `INSERT INTO projects (order_id, title, status, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [orderId, title, 'not_started', notes || null]
  );

  return projectRes.rows[0] || null;
}

async function getOrderById(orderId) {
  const result = await pool.query(
    'SELECT * FROM orders WHERE order_id = $1',
    [orderId]
  );
  return result.rows[0];
}

async function getPaymentConfig(method) {
  const result = await pool.query(
    'SELECT * FROM payment_config WHERE payment_method = $1 AND is_active = true',
    [method]
  );
  return result.rows[0];
}

async function getAllActivePaymentConfigs() {
  const result = await pool.query(
    'SELECT * FROM payment_config WHERE is_active = true ORDER BY sort_order'
  );
  return result.rows;
}

async function getPaymentById(paymentId) {
  const result = await pool.query(
    `SELECT p.*, o.order_number, o.total_amount as order_total
     FROM payments p
     JOIN orders o ON p.order_id = o.order_id
     WHERE p.payment_id = $1`,
    [paymentId]
  );
  return result.rows[0];
}

async function getPaymentByOrderId(orderId) {
  const result = await pool.query(
    `SELECT p.*, o.order_number
     FROM payments p
     JOIN orders o ON p.order_id = o.order_id
     WHERE p.order_id = $1
     ORDER BY p.created_at DESC`,
    [orderId]
  );
  return result.rows;
}

function normalizeAmount(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function createPayment({ order_id, user_id, method, amount, currency = 'PHP', reference_number, proof_url }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const order = await client.query('SELECT * FROM orders WHERE order_id = $1', [order_id]);
    if (order.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const existingPayments = await client.query(
      `SELECT p.* FROM payments p 
       WHERE p.order_id = $1`,
      [order_id]
    );

    const hasActiveSubmission = existingPayments.rows.some(payment =>
      ['pending', 'for_verification'].includes(payment.status)
    );

    if (hasActiveSubmission) {
      throw new AppError('An active payment already exists for this order. Please complete or cancel the existing payment first.', 400);
    }

    const orderTotal = normalizeAmount(order.rows[0].total_amount);
    const requestedAmount = normalizeAmount(amount);
    const totalVerifiedAmount = normalizeAmount(
      existingPayments.rows
        .filter(payment => payment.status === exports.PAYMENT_STATUS.VERIFIED)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    );
    const remainingBalance = normalizeAmount(orderTotal - totalVerifiedAmount);

    if (requestedAmount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    if (remainingBalance <= 0) {
      throw new AppError('This order has already been fully paid.', 400);
    }

    if (requestedAmount > remainingBalance) {
      throw new AppError(`Payment amount must not exceed the remaining balance (${remainingBalance.toFixed(2)})`, 400);
    }

    const config = await client.query(
      'SELECT * FROM payment_config WHERE payment_method = $1 AND is_active = true',
      [method]
    );

    let paymentInstructions = null;
    if (config.rows.length > 0) {
      paymentInstructions = {
        display_name: config.rows[0].display_name,
        instructions: config.rows[0].instructions,
        gcash_number: config.rows[0].gcash_number,
        gcash_qr_code: config.rows[0].gcash_qr_code,
        bank_name: config.rows[0].bank_name,
        bank_account_name: config.rows[0].bank_account_name,
        bank_account_number: config.rows[0].bank_account_number,
        bank_branch: config.rows[0].bank_branch,
      };
    }

    const result = await client.query(
      `INSERT INTO payments (order_id, user_id, method, amount, currency, reference_number, proof_url, payment_instructions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [order_id, user_id, method, requestedAmount, currency, reference_number, proof_url || null, JSON.stringify(paymentInstructions), exports.PAYMENT_STATUS.PENDING]
    );

    await ensureProjectForCustomBuildOrder(client, order_id);

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function uploadProofOfPayment(paymentId, { reference_number, proof_url }) {
  const payment = await getPaymentById(paymentId);
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.status !== exports.PAYMENT_STATUS.PENDING) {
    throw new AppError('Proof can only be uploaded for pending payments', 400);
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (reference_number) {
      updateFields.push(`reference_number = $${paramIndex++}`);
      updateValues.push(reference_number);
    }

    if (proof_url) {
      updateFields.push(`proof_url = $${paramIndex++}`);
      updateValues.push(proof_url);
    }

    updateFields.push(`status = $${paramIndex++}`);
    updateValues.push(exports.PAYMENT_STATUS.FOR_VERIFICATION);

    updateFields.push(`updated_at = $${paramIndex++}`);
    updateValues.push(new Date());

    updateValues.push(paymentId);

    const result = await client.query(
      `UPDATE payments SET ${updateFields.join(', ')} WHERE payment_id = $${paramIndex} RETURNING *`,
      updateValues
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function verifyPayment(paymentId, verifiedByUserId, notes) {
  const payment = await getPaymentById(paymentId);
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  const allowedTransitions = STATUS_TRANSITIONS[payment.status] || [];
  if (!allowedTransitions.includes(exports.PAYMENT_STATUS.VERIFIED)) {
    throw new AppError(`Cannot verify payment with current status: ${payment.status}`, 400);
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE payments 
       SET status = $1, verified_by = $2, verified_at = $3, metadata = COALESCE(metadata, '{}'::jsonb) || $4, updated_at = $3
       WHERE payment_id = $5
       RETURNING *`,
      [
        exports.PAYMENT_STATUS.VERIFIED,
        verifiedByUserId,
        new Date(),
        JSON.stringify({ verification_notes: notes }),
        paymentId
      ]
    );

    await client.query(
      `UPDATE orders SET payment_status = $1, updated_at = $2 WHERE order_id = $3`,
      [ORDER_PAYMENT_STATUS.APPROVED, new Date(), payment.order_id]
    );

    await ensureProjectForCustomBuildOrder(client, payment.order_id);

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function rejectPayment(paymentId, rejectedByUserId, reason, notes) {
  const payment = await getPaymentById(paymentId);
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  const allowedTransitions = STATUS_TRANSITIONS[payment.status] || [];
  if (!allowedTransitions.includes(exports.PAYMENT_STATUS.REJECTED)) {
    throw new AppError(`Cannot reject payment with current status: ${payment.status}`, 400);
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE payments 
       SET status = $1, verified_by = $2, verified_at = $3, rejection_reason = $4, metadata = COALESCE(metadata, '{}'::jsonb) || $5, updated_at = $3
       WHERE payment_id = $6
       RETURNING *`,
      [
        exports.PAYMENT_STATUS.REJECTED,
        rejectedByUserId,
        new Date(),
        reason,
        JSON.stringify({ rejection_notes: notes }),
        paymentId
      ]
    );

    await client.query(
      `UPDATE orders SET payment_status = $1, updated_at = $2 WHERE order_id = $3`,
      [ORDER_PAYMENT_STATUS.PENDING, new Date(), payment.order_id]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cancelPayment(paymentId, cancelledByUserId) {
  const payment = await getPaymentById(paymentId);
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  const allowedTransitions = STATUS_TRANSITIONS[payment.status] || [];
  if (!allowedTransitions.includes(exports.PAYMENT_STATUS.CANCELLED)) {
    throw new AppError(`Cannot cancel payment with current status: ${payment.status}`, 400);
  }

  const result = await pool.query(
    `UPDATE payments 
     SET status = $1, metadata = COALESCE(metadata, '{}'::jsonb) || $2, updated_at = $3
     WHERE payment_id = $4
     RETURNING *`,
    [
      exports.PAYMENT_STATUS.CANCELLED,
      JSON.stringify({ cancelled_by: cancelledByUserId }),
      new Date(),
      paymentId
    ]
  );

  return result.rows[0];
}

async function listPayments(filters = {}) {
  const { status, method, order_id, user_id, start_date, end_date, limit = 20, offset = 0 } = filters;
  
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`p.status = $${paramIndex++}`);
    values.push(status);
  }

  if (method) {
    conditions.push(`p.method = $${paramIndex++}`);
    values.push(method);
  }

  if (order_id) {
    conditions.push(`p.order_id = $${paramIndex++}`);
    values.push(order_id);
  }

  if (user_id) {
    conditions.push(`p.user_id = $${paramIndex++}`);
    values.push(user_id);
  }

  if (start_date) {
    conditions.push(`p.created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }

  if (end_date) {
    conditions.push(`p.created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT p.*, o.order_number, u.email as user_email, 
            CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as user_name
     FROM payments p
     JOIN orders o ON p.order_id = o.order_id
     LEFT JOIN users u ON p.user_id = u.user_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  return result.rows;
}

async function getPaymentsCount(filters = {}) {
  const { status, method, order_id, user_id, start_date, end_date } = filters;
  
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`p.status = $${paramIndex++}`);
    values.push(status);
  }

  if (method) {
    conditions.push(`p.method = $${paramIndex++}`);
    values.push(method);
  }

  if (order_id) {
    conditions.push(`p.order_id = $${paramIndex++}`);
    values.push(order_id);
  }

  if (user_id) {
    conditions.push(`p.user_id = $${paramIndex++}`);
    values.push(user_id);
  }

  if (start_date) {
    conditions.push(`p.created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }

  if (end_date) {
    conditions.push(`p.created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT COUNT(*) as total FROM payments p ${whereClause}`,
    values
  );

  return parseInt(result.rows[0].total, 10);
}

async function getPaymentInstructions(method) {
  const config = await getPaymentConfig(method);
  
  if (!config) {
    throw new AppError('Payment method not found or is inactive', 404);
  }

  return {
    method: config.payment_method,
    display_name: config.display_name,
    instructions: config.instructions,
    gcash_number: config.gcash_number,
    gcash_qr_code: config.gcash_qr_code,
    bank_name: config.bank_name,
    bank_account_name: config.bank_account_name,
    bank_account_number: config.bank_account_number,
    bank_branch: config.bank_branch,
  };
}

async function getAllPaymentMethods() {
  return getAllActivePaymentConfigs();
}

async function getPaymentStats(filters = {}) {
  const { start_date, end_date, user_id } = filters;
  
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (start_date) {
    conditions.push(`p.created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }

  if (end_date) {
    conditions.push(`p.created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  if (user_id) {
    conditions.push(`p.user_id = $${paramIndex++}`);
    values.push(user_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT 
       COUNT(*) as total_payments,
       SUM(CASE WHEN p.status = 'verified' THEN 1 ELSE 0 END) as verified_count,
       SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
       SUM(CASE WHEN p.status = 'for_verification' THEN 1 ELSE 0 END) as for_verification_count,
       SUM(CASE WHEN p.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
       SUM(CASE WHEN p.status = 'verified' THEN p.amount ELSE 0 END) as total_verified_amount,
       SUM(p.amount) as total_amount
     FROM payments p
     ${whereClause}`,
    values
  );

  return result.rows[0];
}

async function refundPayment(paymentId, refundedByUserId, reason) {
  const payment = await getPaymentById(paymentId);
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.status !== exports.PAYMENT_STATUS.VERIFIED) {
    throw new AppError('Only verified payments can be refunded', 400);
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE payments 
       SET status = $1, metadata = COALESCE(metadata, '{}'::jsonb) || $2, updated_at = $3
       WHERE payment_id = $4
       RETURNING *`,
      [
        exports.PAYMENT_STATUS.REFUNDED,
        JSON.stringify({ refunded_by: refundedByUserId, refund_reason: reason }),
        new Date(),
        paymentId
      ]
    );

    await client.query(
      `UPDATE orders SET payment_status = $1, updated_at = $2 WHERE order_id = $3`,
      [ORDER_PAYMENT_STATUS.PENDING, new Date(), payment.order_id]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getPaymentsByUser(userId, filters = {}) {
  const { status, method, limit = 20, offset = 0, start_date, end_date } = filters;
  
  const conditions = ['p.user_id = $1'];
  const values = [userId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`p.status = $${paramIndex++}`);
    values.push(status);
  }

  if (method) {
    conditions.push(`p.method = $${paramIndex++}`);
    values.push(method);
  }

  if (start_date) {
    conditions.push(`p.created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }

  if (end_date) {
    conditions.push(`p.created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await pool.query(
    `SELECT p.*, o.order_number, o.total_amount as order_total
     FROM payments p
     JOIN orders o ON p.order_id = o.order_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  return result.rows;
}

async function getPaymentsByUserCount(userId, filters = {}) {
  const { status, method, start_date, end_date } = filters;
  
  const conditions = ['p.user_id = $1'];
  const values = [userId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`p.status = $${paramIndex++}`);
    values.push(status);
  }

  if (method) {
    conditions.push(`p.method = $${paramIndex++}`);
    values.push(method);
  }

  if (start_date) {
    conditions.push(`p.created_at >= $${paramIndex++}`);
    values.push(new Date(start_date));
  }

  if (end_date) {
    conditions.push(`p.created_at <= $${paramIndex++}`);
    values.push(new Date(end_date));
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await pool.query(
    `SELECT COUNT(*) as total FROM payments p ${whereClause}`,
    values
  );

  return parseInt(result.rows[0].total, 10);
}

async function checkIdempotency(orderId, method, amount) {
  const existingPayment = await pool.query(
    `SELECT * FROM payments 
     WHERE order_id = $1 AND method = $2 AND amount = $3 
     AND status NOT IN ('rejected', 'cancelled') 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [orderId, method, amount]
  );

  if (existingPayment.rows.length > 0) {
    return {
      is_duplicate: true,
      existing_payment: existingPayment.rows[0],
    };
  }

  return { is_duplicate: false };
}
