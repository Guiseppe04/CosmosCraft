const inventoryService = require('../services/inventoryService');
const { AppError } = require('../middleware/errorHandler');

/**
 * INVENTORY CONTROLLER
 * Handles HTTP requests for inventory management
 */

// ─── PRODUCT STOCK VIEW ──────────────────────────────────────────────────────

/**
 * GET /inventory/products
 * Get all products with stock information
 */
exports.getProductsWithStock = async (req, res, next) => {
  try {
    const products = await inventoryService.getProductsWithStock(req.query);
    res.json({ status: 'success', data: products });
  } catch (err) { next(err); }
};

/**
 * GET /inventory/products/:id
 * Get specific product stock details
 */
exports.getProductStock = async (req, res, next) => {
  try {
    const product = await inventoryService.getProductStock(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    res.json({ status: 'success', data: product });
  } catch (err) { next(err); }
};

// ─── STOCK OPERATIONS ────────────────────────────────────────────────────────

/**
 * PATCH /inventory/stock-in
 * Add stock to product
 * Body: { productId, quantity, notes }
 */
exports.addStock = async (req, res, next) => {
  try {
    const { productId, quantity, notes } = req.body;
    
    if (!productId || !quantity) {
      throw new AppError('Missing required fields: productId, quantity', 400);
    }

    const result = await inventoryService.addStock(productId, quantity, {
      notes,
      createdBy: req.user.user_id
    });

    res.json({
      status: 'success',
      message: `Added ${quantity} units to stock`,
      data: result
    });
  } catch (err) { next(err); }
};

/**
 * PATCH /inventory/stock-out
 * Deduct stock from product
 * Body: { productId, quantity, referenceType?, referenceId?, notes? }
 */
exports.deductStock = async (req, res, next) => {
  try {
    const { productId, quantity, referenceType = 'manual', referenceId = null, notes } = req.body;
    
    if (!productId || !quantity) {
      throw new AppError('Missing required fields: productId, quantity', 400);
    }

    const result = await inventoryService.deductStock(
      productId,
      quantity,
      referenceType,
      referenceId,
      {
        notes,
        createdBy: req.user.user_id
      }
    );

    res.json({
      status: 'success',
      message: `Deducted ${quantity} units from stock`,
      data: result
    });
  } catch (err) { next(err); }
};

/**
 * PATCH /inventory/adjust
 * Manually adjust stock (positive or negative)
 * Body: { productId, quantity, notes }
 */
exports.adjustStock = async (req, res, next) => {
  try {
    const { productId, quantity, notes } = req.body;
    
    if (!productId || quantity === undefined || quantity === null) {
      throw new AppError('Missing required fields: productId, quantity', 400);
    }

    const result = await inventoryService.adjustStock(productId, quantity, {
      notes,
      createdBy: req.user.user_id
    });

    const action = quantity > 0 ? 'increased' : 'decreased';
    res.json({
      status: 'success',
      message: `Stock ${action} by ${Math.abs(quantity)} units`,
      data: result
    });
  } catch (err) { next(err); }
};

// ─── INVENTORY LOGS ──────────────────────────────────────────────────────────

/**
 * GET /inventory/logs
 * Get inventory movement logs with filters
 */
exports.getInventoryLogs = async (req, res, next) => {
  try {
    const {
      productId,
      changeType,
      referenceType,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = req.query;

    const logs = await inventoryService.getInventoryLogs({
      productId,
      changeType,
      referenceType,
      startDate,
      endDate,
      limit: Math.min(parseInt(limit), 500),
      offset: parseInt(offset)
    });

    const count = await inventoryService.getInventoryLogsCount({
      productId,
      changeType,
      referenceType,
      startDate,
      endDate
    });

    res.json({
      status: 'success',
      data: logs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });
  } catch (err) { next(err); }
};

/**
 * GET /inventory/logs/:productId
 * Get logs for specific product
 */
exports.getProductInventoryLogs = async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const logs = await inventoryService.getInventoryLogs({
      productId: req.params.productId,
      limit: Math.min(parseInt(limit), 500),
      offset: parseInt(offset)
    });

    const count = await inventoryService.getInventoryLogsCount({
      productId: req.params.productId
    });

    res.json({
      status: 'success',
      data: logs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });
  } catch (err) { next(err); }
};

// ─── LOW STOCK ALERTS ────────────────────────────────────────────────────────

/**
 * GET /inventory/alerts/low-stock
 * Get low stock alerts
 */
exports.getLowStockAlerts = async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const alerts = await inventoryService.getLowStockAlerts({
      limit: Math.min(parseInt(limit), 500),
      offset: parseInt(offset)
    });

    res.json({ status: 'success', data: alerts });
  } catch (err) { next(err); }
};

/**
 * PATCH /inventory/alerts/:alertId/read
 * Mark low stock alert as read
 */
exports.markAlertAsRead = async (req, res, next) => {
  try {
    const alert = await inventoryService.markAlertAsRead(req.params.alertId);
    if (!alert) throw new AppError('Alert not found', 404);

    res.json({ status: 'success', data: alert });
  } catch (err) { next(err); }
};

// ─── INVENTORY SUMMARY ────────────────────────────────────────────────────────

/**
 * GET /inventory/summary
 * Get inventory overview and metrics
 */
exports.getInventorySummary = async (req, res, next) => {
  try {
    const summary = await inventoryService.getInventorySummary();
    res.json({ status: 'success', data: summary });
  } catch (err) { next(err); }
};
