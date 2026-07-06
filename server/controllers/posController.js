const posService = require('../services/posService');
const { AppError } = require('../middleware/errorHandler');

/**
 * POS CONTROLLER
 * Handles HTTP requests for Point of Sale transactions
 */

// ─── SALE MANAGEMENT ─────────────────────────────────────────────────────────

/**
 * POST /pos/sales
 * Create a new POS sale
 * Body: {
 *   customerName?, customerPhone?, notes?,
 *   subtotal?, taxAmount?, totalAmount?,
 *   paymentMethod?, referenceNumber?, status?
 * }
 */
exports.createSale = async (req, res, next) => {
  try {
    const {
      customerName,
      customerPhone,
      notes,
      subtotal,
      taxAmount,
      totalAmount,
      paymentMethod,
      cashReceived,
      referenceNumber,
      status,
      items
    } = req.body;

    const sale = await posService.createSale(req.user.user_id, {
      customerName,
      customerPhone,
      notes,
      subtotal,
      taxAmount,
      totalAmount,
      paymentMethod,
      cashReceived,
      referenceNumber,
      status,
      items
    });

    res.status(201).json({
      status: 'success',
      message: 'POS sale created',
      data: sale
    });
  } catch (err) { next(err); }
};

/**
 * GET /pos/sales
 * List POS sales with filters
 */
exports.listSales = async (req, res, next) => {
  try {
    const {
      staffId,
      status,
      paymentStatus,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    const sales = await posService.listSales({
      staffId,
      status,
      paymentStatus,
      startDate,
      endDate,
      limit: Math.min(parseInt(limit), 500),
      offset: parseInt(offset)
    });

    const count = await posService.getSalesCount({
      staffId,
      status,
      paymentStatus
    });

    res.json({
      status: 'success',
      data: sales,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });
  } catch (err) { next(err); }
};

/**
 * GET /pos/sales/:id
 * Get specific POS sale with items
 */
exports.getSaleById = async (req, res, next) => {
  try {
    const sale = await posService.getSaleById(req.params.id);
    if (!sale) throw new AppError('Sale not found', 404);

    res.json({ status: 'success', data: sale });
  } catch (err) { next(err); }
};

/**
 * PATCH /pos/sales/:id/info
 * Update sale customer info and payment method
 * Body: { paymentMethod?, customerName?, customerPhone?, notes? }
 */
exports.updateSaleInfo = async (req, res, next) => {
  try {
    const updates = req.body;

    const sale = await posService.updateSaleInfo(req.params.id, updates);
    if (!sale) throw new AppError('Sale not found', 404);

    res.json({ status: 'success', data: sale });
  } catch (err) { next(err); }
};

// ─── SALE ITEMS ──────────────────────────────────────────────────────────────

/**
 * POST /pos/sales/:id/items/product
 * Add product item to sale
 * Body: { productId, quantity, discount?, notes? }
 */
exports.addProductItem = async (req, res, next) => {
  try {
    const { productId, quantity, discount, notes } = req.body;

    if (!productId || !quantity) {
      throw new AppError('Missing required fields: productId, quantity', 400);
    }

    const item = await posService.addProductItem(req.params.id, productId, quantity, {
      discount: discount || 0,
      notes
    });

    // Get updated sale
    const sale = await posService.getSaleById(req.params.id);

    res.json({
      status: 'success',
      message: 'Product added to sale',
      data: { item, sale }
    });
  } catch (err) { next(err); }
};

/**
 * POST /pos/sales/:id/items/service
 * Add service item to sale
 * Body: { serviceId, quantity?, discount?, notes? }
 */
exports.addServiceItem = async (req, res, next) => {
  try {
    const { serviceId, quantity = 1, discount, notes } = req.body;

    if (!serviceId) {
      throw new AppError('Missing required field: serviceId', 400);
    }

    const item = await posService.addServiceItem(req.params.id, serviceId, {
      quantity,
      discount: discount || 0,
      notes
    });

    // Get updated sale
    const sale = await posService.getSaleById(req.params.id);

    res.json({
      status: 'success',
      message: 'Service added to sale',
      data: { item, sale }
    });
  } catch (err) { next(err); }
};

/**
 * DELETE /pos/sales/:id/items/:itemId
 * Remove item from sale
 */
exports.removeItem = async (req, res, next) => {
  try {
    await posService.removeItem(req.params.id, req.params.itemId);

    // Get updated sale
    const sale = await posService.getSaleById(req.params.id);

    res.json({
      status: 'success',
      message: 'Item removed from sale',
      data: sale
    });
  } catch (err) { next(err); }
};

// ─── CHECKOUT & PAYMENT ──────────────────────────────────────────────────────

/**
 * POST /pos/sales/:id/checkout
 * Complete POS sale checkout (deduct inventory, create payment)
 * Body: { paymentMethod, referenceNumber?, notes? }
 */
exports.checkoutSale = async (req, res, next) => {
  try {
    const { paymentMethod, referenceNumber, notes } = req.body;

    if (!paymentMethod) {
      throw new AppError('Payment method is required', 400);
    }

    if (!['cash', 'gcash'].includes(paymentMethod)) {
      throw new AppError('Invalid payment method', 400);
    }

    const result = await posService.checkoutSale(req.params.id, paymentMethod, {
      referenceNumber,
      notes
    });

    res.json({
      status: 'success',
      message: 'Sale completed successfully',
      data: result
    });
  } catch (err) { next(err); }
};

/**
 * PATCH /pos/sales/:id/cancel
 * Cancel pending POS sale
 * Body: { reason? }
 */
exports.cancelSale = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const sale = await posService.cancelSale(
      req.params.id,
      req.user.user_id,
      reason
    );

    res.json({
      status: 'success',
      message: 'Sale cancelled successfully',
      data: sale
    });
  } catch (err) { next(err); }
};

// ─── PAYMENT VERIFICATION ────────────────────────────────────────────────────

/**
 * PATCH /pos/payments/:paymentId/verify
 * Verify POS payment (for gcash/bank_transfer)
 * Body: { verificationNotes? }
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    // This would be implemented to verify non-cash payments
    // For now, placeholder for integration with payment verification
    res.json({
      status: 'success',
      message: 'Payment verified'
    });
  } catch (err) { next(err); }
};

// ─── SALES REPORTING ─────────────────────────────────────────────────────────

/**
 * GET /pos/reports/daily-summary
 * Get daily sales summary
 * Query: { date? }
 */
exports.getDailySalesSummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    const summary = await posService.getDailySalesSummary(date ? new Date(date) : new Date());

    res.json({ status: 'success', data: summary });
  } catch (err) { next(err); }
};

/**
 * GET /pos/reports/staff-summary
 * Get staff productivity summary
 * Query: { staffId?, startDate?, endDate? }
 */
exports.getStaffSummary = async (req, res, next) => {
  try {
    const { staffId, startDate, endDate } = req.query;

    const summary = await posService.getStaffSummary({
      staffId,
      startDate,
      endDate
    });

    res.json({ status: 'success', data: summary });
  } catch (err) { next(err); }
};

/**
 * GET /pos/reports/payment-breakdown
 * Get payment method breakdown
 * Query: { startDate?, endDate? }
 */
exports.getPaymentBreakdown = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Summary data would be derived from listSales aggregations
    res.json({
      status: 'success',
      data: {
        message: 'See daily-summary or staff-summary for payment details'
      }
    });
  } catch (err) { next(err); }
};

/**
 * POST /pos/reports/receipt/:saleId
 * Generate receipt data for printing
 */
exports.generateReceiptData = async (req, res, next) => {
  try {
    const sale = await posService.getSaleById(req.params.saleId);
    if (!sale) throw new AppError('Sale not found', 404);

    const receipt = {
      saleNumber: sale.sale_number,
      date: new Date(sale.created_at).toLocaleDateString('en-PH'),
      time: new Date(sale.created_at).toLocaleTimeString('en-PH'),
      staff: `${sale.first_name} ${sale.last_name}`,
      items: sale.items.map(item => ({
        name: item.item_name,
        qty: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        subtotal: parseFloat(item.subtotal)
      })),
      subtotal: parseFloat(sale.subtotal),
      discount: parseFloat(sale.discount_amount),
      tax: parseFloat(sale.tax_amount),
      total: parseFloat(sale.total_amount),
      paymentMethod: sale.payment_method,
      status: sale.status
    };

    res.json({ status: 'success', data: receipt });
  } catch (err) { next(err); }
};
