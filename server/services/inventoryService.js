const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');

/**
 * Human-readable labels for the raw stock movement types stored in
 * inventory_logs, so the audit trail says "Stock Restored" rather than
 * "stock_in".
 */
const MOVEMENT_LABELS = {
  stock_in: 'Stock Added',
  stock_out: 'Stock Deducted',
  adjustment: 'Manual Stock Adjustment',
  restock: 'Stock Added',
  restocked: 'Stock Restored',
  returned: 'Stock Restored',
  reserved: 'Stock Reserved',
  released: 'Stock Released',
  return_restock: 'Return Restock',
  refund_restock: 'Refund Restock',
  cancellation_restock: 'Cancellation Restock',
  pos_deduction: 'POS Deduction',
  order_deduction: 'Online Order Deduction',
  project_deduction: 'Project Part Deduction',
  builder_part_deduction: 'Builder Part Deduction',
};

/** Where the movement came from, e.g. an order, a POS sale or a manual edit. */
const SOURCE_LABELS = {
  pos_sale: 'POS Sale',
  order: 'Online Order',
  return: 'Customer Return',
  refund: 'Refund',
  cancellation: 'Order Cancellation',
  project: 'Custom Guitar Build',
  appointment: 'Appointment',
  manual_stocking: 'Manual Stock-in',
  manual_adjustment: 'Manual Adjustment',
  supplier: 'Supplier',
};

/** Reference types that represent stock coming back rather than going out. */
const RESTOCK_REFERENCE_TYPES = new Set(['return', 'refund', 'cancellation', 'return_restock']);

/** Reference types whose movement is a custom guitar build part. */
const PROJECT_REFERENCE_TYPES = new Set(['project', 'project_part', 'custom_build']);

/**
 * Maps a reference type to the movement wording used in the audit trail, so a
 * deduction caused by a POS sale reads "POS Deduction", one caused by a custom
 * build reads "Project Part Deduction" and a restock caused by a return reads
 * "Return Restock".
 */
const movementForReference = (referenceType) => {
  if (RESTOCK_REFERENCE_TYPES.has(referenceType)) {
    return referenceType === 'return' ? 'restocked' : `${referenceType}_restock`;
  }
  if (referenceType === 'pos_sale') return 'pos_deduction';
  if (referenceType === 'order') return 'order_deduction';
  if (PROJECT_REFERENCE_TYPES.has(referenceType)) return 'project_deduction';
  if (referenceType === 'manual') return 'adjustment';
  return 'stock_out';
};

/**
 * Resolves the business identifier behind a stock movement so the audit entry
 * can name the order it belongs to. Returns an empty object for reference types
 * that have no order (e.g. a supplier restock).
 */
const readReferenceOrder = async (query, referenceType, referenceId) => {
  if (!referenceId) return {};
  const ordersOnly = ['order', 'pos_sale', 'return', 'refund', 'cancellation'];

  try {
    if (PROJECT_REFERENCE_TYPES.has(referenceType)) {
      const { rows } = await query.query(
        `SELECT p.project_id, p.custom_build_id, p.title, p.order_number
         FROM projects p WHERE p.project_id = $1`,
        [referenceId]
      );
      const row = rows[0] || {};
      return {
        project_id: row.project_id,
        project_number: row.custom_build_id,
        project_title: row.title,
        order_number: row.order_number,
      };
    }

    if (!ordersOnly.includes(referenceType)) return {};

    const { rows } = await query.query(
      `SELECT order_id, order_number FROM orders WHERE order_id = $1`,
      [referenceId]
    );
    const row = rows[0] || {};
    return { order_number: row.order_number };
  } catch (err) {
    // A missing reference must never block the stock movement itself.
    console.warn('Could not resolve stock reference:', err.message);
    return {};
  }
};

/**
 * Reads the product name/SKU that the audit entry needs. Kept as a single
 * lightweight query so every stock movement still costs only one extra read.
 */
const readProductLabel = async (query, productId) => {
  const { rows } = await query.query(
    `SELECT p.name, p.sku FROM products p WHERE p.product_id = $1`,
    [productId]
  );
  return rows[0] || {};
};

/**
 * Records a stock movement in the audit trail.
 *
 * Inventory previously wrote only to inventory_logs, so every deduction and
 * restock was invisible in the admin audit view. This captures the product, its
 * SKU, previous/new quantity, the delta, the movement type and the source.
 */
const logStockEvent = async ({
  query,
  userId,
  productId,
  previousQuantity,
  newQuantity,
  delta,
  changeType,
  source,
  reason,
  context = {},
}) => {
  const product = await readProductLabel(query, productId);

  await auditService.logStockMovement({
    userId,
    entityId: productId,
    entityType: auditService.MODULES.INVENTORY,
    previousQuantity,
    newQuantity,
    delta,
    movement: MOVEMENT_LABELS[changeType] || MOVEMENT_LABELS.adjustment,
    source: SOURCE_LABELS[source] || source || 'Manual Adjustment',
    reason,
    context: { productName: product.name, sku: product.sku, ...context },
    executor: query,
  });
};

const syncStockToBuilderParts = async (productId, delta, client = null) => {
  if (!productId || delta === 0) return;
  const query = client || pool;
  await query.query(
    `UPDATE guitar_builder_parts SET stock = stock + $1, updated_at = now() WHERE product_id = $2`,
    [delta, productId]
  );
};

/**
 * INVENTORY SERVICE
 * Manages product stock, inventory logs, and low stock tracking
 */

// ─── STOCK MANAGEMENT ────────────────────────────────────────────────────────

/**
 * Get current stock level for a product
 */
exports.getProductStock = async (productId) => {
  const res = await pool.query(
    `SELECT        p.product_id, p.name, p.is_active, i.stock, i.low_stock_threshold, i.max_stock, i.cost_price
     FROM products p
     LEFT JOIN inventory i ON p.product_id = i.product_id
     WHERE p.product_id = $1`,
    [productId]
  );
  return res.rows[0] || null;
};

/**
 * Get all products with stock information
 */
exports.getProductsWithStock = async ({ search, category_id, low_stock_only } = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (search) {
    where.push(`(p.name ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (category_id) {
    where.push(`p.category_id = $${idx}`);
    params.push(category_id);
    idx++;
  }
  if (low_stock_only === true || low_stock_only === 'true') {
    where.push(`i.stock <= COALESCE(i.max_stock * (i.low_stock_threshold / 100.0), i.max_stock * 0.10)`);
  }
  where.push(`p.is_active = true`);

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT 
      p.product_id, p.name, p.description, p.price, p.sku, p.updated_at, p.category_id,
      i.cost_price, i.stock, i.low_stock_threshold, i.max_stock, i.inventory_id,
      c.name AS category_name,
      (i.stock <= COALESCE(i.max_stock * (i.low_stock_threshold / 100.0), i.max_stock * 0.10)) AS is_low_stock,
      (SELECT COUNT(*) FROM inventory_logs WHERE product_id = p.product_id) AS total_movements
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN inventory i ON p.product_id = i.product_id
     ${condition}
     ORDER BY i.stock ASC, p.name ASC`,
    params
  );
  return res.rows;
};

/**
 * Add stock (stock-in)
 * @param {UUID} productId
 * @param {number} quantity - Amount to add
 * @param {object} options - { notes, createdBy }
 */
exports.addStock = async (productId, quantity, { notes = null, createdBy = null, client: providedClient = null } = {}) => {
  if (quantity <= 0) {
    throw new AppError('Quantity must be greater than 0', 400);
  }

  const ownClient = !providedClient;
  const client = providedClient || await pool.connect();
  try {
    if (ownClient) await client.query('BEGIN');

    // Get inventory lock for atomicity
    const inventoryRes = await client.query(
      'SELECT product_id, stock FROM inventory WHERE product_id = $1 FOR UPDATE',
      [productId]
    );
    
    if (!inventoryRes.rows[0]) {
      // Seed a missing inventory row at zero so the increment only happens once.
      await client.query(
        `INSERT INTO inventory (product_id, stock)
         VALUES ($1, 0)
         ON CONFLICT (product_id) DO NOTHING`,
        [productId]
      );
    }

    // Update stock in inventory table
    const updateRes = await client.query(
      `UPDATE inventory SET stock = stock + $1, updated_at = now() 
       WHERE product_id = $2 
       RETURNING product_id, stock`,
      [quantity, productId]
    );

    // Get product info for response
    const productRes = await client.query(
      'SELECT product_id, name FROM products WHERE product_id = $1',
      [productId]
    );

    // Create log
    const logRes = await client.query(
      `INSERT INTO inventory_logs (product_id, change_type, quantity, reference_type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [productId, 'stock_in', quantity, 'manual_stocking', notes, createdBy]
    );

    // Audit: record the movement before committing so the trail matches stock
    await logStockEvent({
      query: client,
      userId: createdBy,
      productId,
      previousQuantity: Number(inventoryRes.rows[0]?.stock ?? 0),
      newQuantity: Number(updateRes.rows[0].stock),
      delta: quantity,
      changeType: 'stock_in',
      source: 'manual_stocking',
      reason: notes,
    });

    if (ownClient) await client.query('COMMIT');

    await syncStockToBuilderParts(productId, quantity, client);

    return {
      product: { ...productRes.rows[0], stock: updateRes.rows[0].stock },
      log: logRes.rows[0]
    };
  } catch (err) {
    if (ownClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownClient) client.release();
  }
};

/**
 * Deduct stock (stock-out)
 * @param {UUID} productId
 * @param {number} quantity - Amount to deduct
 * @param {string} referenceType - 'pos_sale', 'order', 'return', etc.
 * @param {UUID} referenceId - ID of the transaction
 * @param {object} options - { notes, createdBy }
 */
exports.deductStock = async (
  productId,
  quantity,
  referenceType,
  referenceId,
  { notes = null, createdBy = null, client: providedClient = null } = {}
) => {
  if (quantity <= 0) {
    throw new AppError('Quantity must be greater than 0', 400);
  }

  const ownClient = !providedClient;
  const client = providedClient || await pool.connect();
  try {
    if (ownClient) await client.query('BEGIN');

    // Get inventory and validate sufficient stock
    const inventoryRes = await client.query(
      'SELECT stock FROM inventory WHERE product_id = $1 FOR UPDATE',
      [productId]
    );
    
    const currentStock = Number(inventoryRes.rows[0]?.stock || 0);
    if (currentStock < quantity) {
      throw new AppError(
        `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`,
        400
      );
    }

    // Update stock in inventory table
    const updateRes = await client.query(
      `UPDATE inventory SET stock = stock - $1, updated_at = now() 
       WHERE product_id = $2 
       RETURNING product_id, stock`,
      [quantity, productId]
    );

    // Get product info for response
    const productRes = await client.query(
      'SELECT product_id, name FROM products WHERE product_id = $1',
      [productId]
    );

    // Create log
    const logRes = await client.query(
      `INSERT INTO inventory_logs (product_id, change_type, quantity, reference_type, reference_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [productId, 'stock_out', -quantity, referenceType, referenceId, notes, createdBy]
    );

    // Audit: a deduction must always say what it was deducted for
    const referenceOrder = await readReferenceOrder(client, referenceType, referenceId);
    await logStockEvent({
      query: client,
      userId: createdBy,
      productId,
      previousQuantity: currentStock,
      newQuantity: Number(updateRes.rows[0].stock),
      delta: -quantity,
      changeType: movementForReference(referenceType),
      source: referenceType,
      reason: notes,
      context: {
        orderNumber: referenceOrder.order_number,
        sourceId: referenceId,
        projectId: referenceOrder.project_id,
        projectNumber: referenceOrder.project_number,
        projectTitle: referenceOrder.project_title,
      },
    });

    // Check for low stock alert
    const newStock = updateRes.rows[0].stock;
    const thresholdRes = await client.query(
      'SELECT low_stock_threshold, max_stock FROM inventory WHERE product_id = $1',
      [productId]
    );
    const pct = Number(thresholdRes.rows[0]?.low_stock_threshold) || 10;
    const maxStock = Number(thresholdRes.rows[0]?.max_stock) || 0;
    const lowStockLimit = maxStock > 0 ? maxStock * (pct / 100) : 0;

    if (newStock <= lowStockLimit && newStock > 0) {
      await client.query(
        `INSERT INTO low_stock_alerts (product_id, current_stock, threshold)
         VALUES ($1, $2, $3)`,
        [productId, newStock, Math.round(lowStockLimit)]
      );
    }

    if (ownClient) await client.query('COMMIT');

    await syncStockToBuilderParts(productId, -quantity, client);

    return {
      product: { ...productRes.rows[0], stock: updateRes.rows[0].stock },
      log: logRes.rows[0]
    };
  } catch (err) {
    if (ownClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownClient) client.release();
  }
};

/**
 * Adjust stock (manual adjustment)
 * @param {UUID} productId
 * @param {number} quantity - Positive or negative adjustment
 * @param {object} options - { notes, createdBy }
 */
exports.adjustStock = async (productId, quantity, { notes = null, createdBy = null, client: providedClient = null } = {}) => {
  if (quantity === 0) {
    throw new AppError('Adjustment quantity cannot be zero', 400);
  }

  const ownClient = !providedClient;
  const client = providedClient || await pool.connect();
  try {
    if (ownClient) await client.query('BEGIN');

    // Get inventory
    const inventoryRes = await client.query(
      'SELECT stock FROM inventory WHERE product_id = $1 FOR UPDATE',
      [productId]
    );
    
    if (!inventoryRes.rows[0]) {
      if (quantity < 0) {
        throw new AppError(
          `Adjustment would result in negative stock. Current: 0, Adjustment: ${quantity}`,
          400
        );
      }

      await client.query(
        `INSERT INTO inventory (product_id, stock)
         VALUES ($1, 0)
         ON CONFLICT (product_id) DO NOTHING`,
        [productId]
      );
    }

    const currentStock = Number(inventoryRes.rows[0]?.stock || 0);
    const newStock = currentStock + quantity;
    if (newStock < 0) {
      throw new AppError(
        `Adjustment would result in negative stock. Current: ${currentStock}, Adjustment: ${quantity}`,
        400
      );
    }

    // Update stock in inventory table
    const updateRes = await client.query(
      `UPDATE inventory SET stock = stock + $1, updated_at = now() 
       WHERE product_id = $2 
       RETURNING product_id, stock`,
      [quantity, productId]
    );

    // Get product info for response
    const productRes = await client.query(
      'SELECT product_id, name FROM products WHERE product_id = $1',
      [productId]
    );

    // Create log
    const logRes = await client.query(
      `INSERT INTO inventory_logs (product_id, change_type, quantity, reference_type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [productId, 'adjustment', quantity, 'manual_adjustment', notes, createdBy]
    );

    await logStockEvent({
      query: client,
      userId: createdBy,
      productId,
      previousQuantity: currentStock,
      newQuantity: Number(updateRes.rows[0].stock),
      delta: quantity,
      changeType: 'adjustment',
      source: 'manual_adjustment',
      reason: notes,
    });

    if (ownClient) await client.query('COMMIT');

    await syncStockToBuilderParts(productId, quantity, client);

    return {
      product: { ...productRes.rows[0], stock: updateRes.rows[0].stock },
      log: logRes.rows[0]
    };
  } catch (err) {
    if (ownClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownClient) client.release();
  }
};

// ─── INVENTORY LOGS ──────────────────────────────────────────────────────────

/**
 * Get inventory logs with filters
 */
exports.getInventoryLogs = async ({
  productId = null,
  changeType = null,
  referenceType = null,
  startDate = null,
  endDate = null,
  limit = 100,
  offset = 0
} = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (productId) {
    where.push(`product_id = $${idx}`);
    params.push(productId);
    idx++;
  }
  if (changeType) {
    where.push(`change_type = $${idx}`);
    params.push(changeType);
    idx++;
  }
  if (referenceType) {
    where.push(`reference_type = $${idx}`);
    params.push(referenceType);
    idx++;
  }
  if (startDate) {
    where.push(`created_at >= $${idx}`);
    params.push(new Date(startDate));
    idx++;
  }
  if (endDate) {
    where.push(`created_at < $${idx}`);
    params.push(new Date(endDate));
    idx++;
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT 
      il.log_id, il.product_id, p.name AS product_name,
      il.change_type, il.quantity, il.reference_type, il.reference_id,
      il.notes, il.created_by, u.first_name, u.last_name,
      il.created_at
     FROM inventory_logs il
     LEFT JOIN products p ON il.product_id = p.product_id
     LEFT JOIN users u ON il.created_by = u.user_id
     ${condition}
     ORDER BY il.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return res.rows;
};

/**
 * Get inventory logs count
 */
exports.getInventoryLogsCount = async ({
  productId = null,
  changeType = null,
  referenceType = null,
  startDate = null,
  endDate = null
} = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (productId) {
    where.push(`product_id = $${idx}`);
    params.push(productId);
    idx++;
  }
  if (changeType) {
    where.push(`change_type = $${idx}`);
    params.push(changeType);
    idx++;
  }
  if (referenceType) {
    where.push(`reference_type = $${idx}`);
    params.push(referenceType);
    idx++;
  }
  if (startDate) {
    where.push(`created_at >= $${idx}`);
    params.push(new Date(startDate));
    idx++;
  }
  if (endDate) {
    where.push(`created_at < $${idx}`);
    params.push(new Date(endDate));
    idx++;
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT COUNT(*) as count FROM inventory_logs il ${condition}`,
    params
  );

  return parseInt(res.rows[0].count, 10);
};

// ─── LOW STOCK MANAGEMENT ────────────────────────────────────────────────────

/**
 * Get low stock alerts
 */
exports.getLowStockAlerts = async ({ limit = 50, offset = 0 } = {}) => {
  const res = await pool.query(
    `SELECT 
      lsa.alert_id, lsa.product_id, p.name, p.description,
      lsa.current_stock, lsa.threshold, lsa.is_read, lsa.read_at,
      lsa.created_at
     FROM low_stock_alerts lsa
     LEFT JOIN products p ON lsa.product_id = p.product_id
     WHERE lsa.is_read = false
     ORDER BY lsa.current_stock ASC, lsa.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return res.rows;
};

/**
 * Mark low stock alert as read
 */
exports.markAlertAsRead = async (alertId) => {
  const res = await pool.query(
    `UPDATE low_stock_alerts SET is_read = true, read_at = now() 
     WHERE alert_id = $1 
     RETURNING *`,
    [alertId]
  );
  return res.rows[0] || null;
};

/**
 * Get inventory summary
 */
exports.getInventorySummary = async () => {
  const res = await pool.query(
    `SELECT 
      COUNT(DISTINCT p.product_id) as total_products,
      SUM(i.stock) as total_units,
      COUNT(DISTINCT CASE WHEN i.stock > 0 AND i.stock <= COALESCE(i.max_stock * (i.low_stock_threshold / 100.0), i.max_stock * 0.10) THEN p.product_id END) as low_stock_count,
      COUNT(DISTINCT CASE WHEN i.stock <= 0 OR i.stock IS NULL THEN p.product_id END) as out_of_stock_count,
      SUM(i.stock * p.price) as total_inventory_value
     FROM products p
     LEFT JOIN inventory i ON p.product_id = i.product_id
     WHERE p.is_active = true`
  );
  
  return res.rows[0] || {
    total_products: 0,
    total_units: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    total_inventory_value: 0
  };
};

// ─── PRODUCT STOCK UPDATE (Simple Update) ──────────────────────────────────

/**
 * Update product stock directly (without logging)
 * Used during POS checkout with detailed logging via inventory_logs
 */
exports.updateProductStock = async (productId, newStock) => {
  if (newStock < 0) {
    throw new AppError('Stock cannot be negative', 400);
  }

  const existingRes = await pool.query(
    'SELECT stock FROM inventory WHERE product_id = $1',
    [productId]
  );
  const oldStock = Number(existingRes.rows[0]?.stock || 0);
  const delta = newStock - oldStock;

  const res = await pool.query(
    `UPDATE inventory SET stock = $1, updated_at = now() 
     WHERE product_id = $2 
     RETURNING product_id, stock`,
    [newStock, productId]
  );

  if (!res.rows[0]) {
    throw new AppError('Product inventory not found', 404);
  }

  await syncStockToBuilderParts(productId, delta);

  // Get product info for response
  const productRes = await pool.query(
    'SELECT product_id, name FROM products WHERE product_id = $1',
    [productId]
  );

  return { ...productRes.rows[0], stock: res.rows[0].stock } || null;
};
