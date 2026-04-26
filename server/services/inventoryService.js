const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

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
    `SELECT p.product_id, p.name, p.sku, p.is_active, i.stock, i.low_stock_threshold, i.cost_price
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
    where.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (category_id) {
    where.push(`p.category_id = $${idx}`);
    params.push(category_id);
    idx++;
  }
  if (low_stock_only === true || low_stock_only === 'true') {
    where.push(`i.stock <= COALESCE(i.low_stock_threshold, 10)`);
  }
  where.push(`p.is_active = true`);

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT 
      p.product_id, p.sku, p.name, p.description, p.price,
      i.cost_price, i.stock, i.low_stock_threshold, i.inventory_id,
      c.name AS category_name,
      (i.stock <= COALESCE(i.low_stock_threshold, 10)) AS is_low_stock,
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
exports.addStock = async (productId, quantity, { notes = null, createdBy = null } = {}) => {
  if (quantity <= 0) {
    throw new AppError('Quantity must be greater than 0', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
      'SELECT product_id, name, sku FROM products WHERE product_id = $1',
      [productId]
    );

    // Create log
    const logRes = await client.query(
      `INSERT INTO inventory_logs (product_id, change_type, quantity, reference_type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [productId, 'stock_in', quantity, 'manual_stocking', notes, createdBy]
    );

    await client.query('COMMIT');

    return {
      product: { ...productRes.rows[0], stock: updateRes.rows[0].stock },
      log: logRes.rows[0]
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
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
  { notes = null, createdBy = null } = {}
) => {
  if (quantity <= 0) {
    throw new AppError('Quantity must be greater than 0', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
      'SELECT product_id, name, sku FROM products WHERE product_id = $1',
      [productId]
    );

    // Create log
    const logRes = await client.query(
      `INSERT INTO inventory_logs (product_id, change_type, quantity, reference_type, reference_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [productId, 'stock_out', -quantity, referenceType, referenceId, notes, createdBy]
    );

    // Check for low stock alert
    const newStock = updateRes.rows[0].stock;
    const thresholdRes = await client.query(
      'SELECT low_stock_threshold FROM inventory WHERE product_id = $1',
      [productId]
    );
    const threshold = thresholdRes.rows[0]?.low_stock_threshold || 10;

    if (newStock <= threshold && newStock > 0) {
      await client.query(
        `INSERT INTO low_stock_alerts (product_id, current_stock, threshold)
         VALUES ($1, $2, $3)`,
        [productId, newStock, threshold]
      );
    }

    await client.query('COMMIT');

    return {
      product: { ...productRes.rows[0], stock: updateRes.rows[0].stock },
      log: logRes.rows[0]
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Adjust stock (manual adjustment)
 * @param {UUID} productId
 * @param {number} quantity - Positive or negative adjustment
 * @param {object} options - { notes, createdBy }
 */
exports.adjustStock = async (productId, quantity, { notes = null, createdBy = null } = {}) => {
  if (quantity === 0) {
    throw new AppError('Adjustment quantity cannot be zero', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
      'SELECT product_id, name, sku FROM products WHERE product_id = $1',
      [productId]
    );

    // Create log
    const logRes = await client.query(
      `INSERT INTO inventory_logs (product_id, change_type, quantity, reference_type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [productId, 'adjustment', quantity, 'manual_adjustment', notes, createdBy]
    );

    await client.query('COMMIT');

    return {
      product: { ...productRes.rows[0], stock: updateRes.rows[0].stock },
      log: logRes.rows[0]
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
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
      il.log_id, il.product_id, p.sku, p.name AS product_name,
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
      lsa.alert_id, lsa.product_id, p.sku, p.name, p.description,
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
      COUNT(DISTINCT CASE WHEN i.stock <= i.low_stock_threshold THEN p.product_id END) as low_stock_count,
      COUNT(DISTINCT CASE WHEN i.stock = 0 THEN p.product_id END) as out_of_stock_count,
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

  const res = await pool.query(
    `UPDATE inventory SET stock = $1, updated_at = now() 
     WHERE product_id = $2 
     RETURNING product_id, stock`,
    [newStock, productId]
  );

  if (!res.rows[0]) {
    throw new AppError('Product inventory not found', 404);
  }

  // Get product info for response
  const productRes = await pool.query(
    'SELECT product_id, name, sku FROM products WHERE product_id = $1',
    [productId]
  );

  return { ...productRes.rows[0], stock: res.rows[0].stock } || null;
};
