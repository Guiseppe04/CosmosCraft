const paymentService = require('../services/paymentService');
const { AppError } = require('../middleware/errorHandler');
const paymentValidation = require('../utils/paymentValidation');
const { hasRole } = require('../utils/roles');

const validate = (data, schema) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    const messages = error.details.map(detail => detail.message).join('; ');
    throw new AppError(messages, 400);
  }
  return value;
};

async function checkPaymentAccess(paymentId, userId, userRole) {
  const payment = await paymentService.getPaymentById(paymentId);

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (hasRole(userRole, 'admin', 'staff')) {
    return payment;
  }

  if (payment.user_id && payment.user_id !== userId) {
    throw new AppError('Access denied to this payment', 403);
  }

  return payment;
}

exports.createPayment = async (req, res, next) => {
  try {
    const validated = validate(req.body, paymentValidation.createPaymentSchema);

    const userId = req.user ? req.user.user_id : null;

    const payment = await paymentService.createPayment({
      order_id: validated.order_id,
      user_id: userId,
      method: validated.method,
      amount: validated.amount,
      currency: validated.currency,
      reference_number: validated.reference_number,
      proof_url: validated.proof_url || null,
    });

    res.status(201).json({
      status: 'success',
      data: {
        payment,
        instructions: payment.payment_instructions,
      },
      message: 'Payment record created successfully. Please upload proof of payment.',
    });
  } catch (err) {
    next(err);
  }
};

exports.getPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    await validate({ id }, paymentValidation.paymentIdParamSchema);

    const payment = await checkPaymentAccess(
      id,
      req.user ? req.user.user_id : null,
      req.user ? req.user.role : 'customer'
    );

    res.json({
      status: 'success',
      data: {
        payment,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.uploadProof = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reference_number } = req.body;
    const proofUrl = req.file ? `/uploads/proofs/${req.file.filename}` : null;

    await validate({ id }, paymentValidation.paymentIdParamSchema);

    await checkPaymentAccess(
      id,
      req.user ? req.user.user_id : null,
      req.user ? req.user.role : 'customer'
    );

    if (!proofUrl && !reference_number) {
      throw new AppError('Either proof of payment file or reference number is required', 400);
    }

    const payment = await paymentService.uploadProofOfPayment(id, {
      reference_number,
      proof_url: proofUrl,
    });

    res.json({
      status: 'success',
      data: {
        payment,
      },
      message: 'Proof of payment uploaded successfully. Payment is now pending verification.',
    });
  } catch (err) {
    next(err);
  }
};

exports.listPayments = async (req, res, next) => {
  try {
    const validated = validate(req.query, paymentValidation.listPaymentsSchema);

    if (req.user.role === 'customer') {
      validated.user_id = req.user.user_id;
    }

    const payments = await paymentService.listPayments(validated);
    const total = await paymentService.getPaymentsCount(validated);

    res.json({
      status: 'success',
      data: {
        payments,
        pagination: {
          total,
          limit: parseInt(validated.limit, 10),
          offset: parseInt(validated.offset, 10),
          pages: Math.ceil(total / parseInt(validated.limit, 10)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await validate({ id }, paymentValidation.paymentIdParamSchema);
    await validate({ notes }, paymentValidation.verifyPaymentSchema);

    if (!hasRole(req.user.role, 'admin', 'staff')) {
      throw new AppError('Only admins and staff can verify payments', 403);
    }

    const payment = await paymentService.verifyPayment(
      id,
      req.user.user_id,
      notes
    );

    res.json({
      status: 'success',
      data: {
        payment,
      },
      message: 'Payment verified successfully. Order payment has been approved.',
    });
  } catch (err) {
    next(err);
  }
};

exports.rejectPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    await validate({ id }, paymentValidation.paymentIdParamSchema);
    await validate({ reason, notes }, paymentValidation.rejectPaymentSchema);

    if (!hasRole(req.user.role, 'admin', 'staff')) {
      throw new AppError('Only admins and staff can reject payments', 403);
    }

    const payment = await paymentService.rejectPayment(
      id,
      req.user.user_id,
      reason,
      notes
    );

    res.json({
      status: 'success',
      data: {
        payment,
      },
      message: 'Payment rejected. The customer will be notified.',
    });
  } catch (err) {
    next(err);
  }
};

exports.cancelPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    await validate({ id }, paymentValidation.paymentIdParamSchema);

    const payment = await checkPaymentAccess(
      id,
      req.user ? req.user.user_id : null,
      req.user ? req.user.role : 'customer'
    );

    const cancelled = await paymentService.cancelPayment(id, req.user.user_id);

    res.json({
      status: 'success',
      data: {
        payment: cancelled,
      },
      message: 'Payment cancelled successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.getPaymentMethods = async (req, res, next) => {
  try {
    const methods = await paymentService.getAllPaymentMethods();

    const sanitizedMethods = methods.map(method => ({
      method: method.payment_method,
      display_name: method.display_name,
      instructions: method.instructions,
      gcash_number: method.gcash_number,
      gcash_qr_code: method.gcash_qr_code,
      bank_name: method.bank_name,
      bank_account_name: method.bank_account_name,
      bank_account_number: method.bank_account_number,
      bank_branch: method.bank_branch,
    }));

    res.json({
      status: 'success',
      data: {
        payment_methods: sanitizedMethods,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getPaymentInstructions = async (req, res, next) => {
  try {
    const { method } = req.params;

    if (!['gcash', 'bank_transfer', 'cash'].includes(method)) {
      throw new AppError('Invalid payment method', 400);
    }

    const instructions = await paymentService.getPaymentInstructions(method);

    res.json({
      status: 'success',
      data: {
        instructions,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getUserPayments = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, method, limit = 20, offset = 0, start_date, end_date } = req.query;

    if (req.user.role === 'customer' && userId !== req.user.user_id) {
      throw new AppError('Access denied', 403);
    }

    const filters = {
      status,
      method,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      start_date,
      end_date,
    };

    const payments = await paymentService.getPaymentsByUser(userId, filters);
    const total = await paymentService.getPaymentsByUserCount(userId, filters);

    res.json({
      status: 'success',
      data: {
        user_id: userId,
        payments,
        pagination: {
          total,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getPaymentStats = async (req, res, next) => {
  try {
    if (!hasRole(req.user.role, 'admin', 'staff')) {
      throw new AppError('Only admins and staff can view payment statistics', 403);
    }

    const { start_date, end_date, user_id } = req.query;

    const stats = await paymentService.getPaymentStats({
      start_date,
      end_date,
      user_id,
    });

    res.json({
      status: 'success',
      data: {
        statistics: {
          total_payments: parseInt(stats.total_payments, 10),
          verified_count: parseInt(stats.verified_count, 10),
          pending_count: parseInt(stats.pending_count, 10),
          for_verification_count: parseInt(stats.for_verification_count, 10),
          rejected_count: parseInt(stats.rejected_count, 10),
          total_amount: parseFloat(stats.total_amount || 0),
          total_verified_amount: parseFloat(stats.total_verified_amount || 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.refundPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!hasRole(req.user.role, 'admin')) {
      throw new AppError('Only admins can process refunds', 403);
    }

    const payment = await paymentService.refundPayment(
      id,
      req.user.user_id,
      reason
    );

    res.json({
      status: 'success',
      data: {
        payment,
      },
      message: 'Payment refunded successfully',
    });
  } catch (err) {
    next(err);
  }
};
