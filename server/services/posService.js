const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
/**
 * POS SERVICE
 * Manages Point of Sale transactions for walk-in customers
 */

// ─── SALE CREATION & MANAGEMENT ──────────────────────────────────────────────

/**
 * Generate unique sale number
 */
const generateSaleNumber = async () => {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  
  // Get counter for today
  const countRes = await pool.query(
    `SELECT COUNT(*) as count FROM pos_sales 
     WHERE DATE(created_at) = CURRENT_DATE`
  );
  
  const counter = String(parseInt(countRes.rows[0].count, 10) + 1).padStart(4, '0');
  return `POS-${dateStr}-${counter}`;
};

/**
 * Create a new POS sale
 * Inserts a POS sale record directly into pos_sales.
 */
exports.createSale = async (
  staffId,
  {
    customerName = null,
    customerPhone = null,
    notes = null,
    subtotal = 0,
    taxAmount = 0,
    totalAmount = 0,
    paymentMethod = 'cash',
    referenceNumber = null,
    status = 'completed'
  } = {}
) => {
  // Validate staff exists
  const staffRes = await pool.query(
    'SELECT user_id FROM users WHERE user_id = $1 AND is_active = true',
    [staffId]
  );
  if (!staffRes.rows[0]) {
    throw new AppError('Staff member not found or inactive', 404);
  }

  const normalizedPaymentMethod = ['cash', 'gcash', 'bank_transfer'].includes(paymentMethod) ? paymentMethod : 'cash';
  const normalizedStatus = ['pending', 'completed', 'cancelled'].includes(status) ? status : 'completed';
  const normalizedSubtotal = Math.max(0, Number(subtotal || 0));
  const normalizedTaxAmount = Math.max(0, Number(taxAmount || 0));
  const normalizedTotalAmount = Math.max(0, Number(totalAmount || 0));
  const paymentStatus = normalizedPaymentMethod === 'cash' ? 'verified' : 'pending';
  const completedAt = normalizedStatus === 'completed' ? new Date() : null;
  const saleNumber = await generateSaleNumber();

  const res = await pool.query(
    `INSERT INTO pos_sales (
      sale_number, staff_id, customer_name, customer_phone,
      subtotal, tax_amount, total_amount,
      payment_method, payment_status, status, reference_number, notes, completed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING 
      sale_id, sale_number, staff_id, customer_name, customer_phone,
      subtotal, discount_amount, tax_amount, total_amount,
      payment_method, payment_status, status, reference_number, created_at, completed_at`,
    [
      saleNumber,
      staffId,
      customerName,
      customerPhone,
      normalizedSubtotal,
      normalizedTaxAmount,
      normalizedTotalAmount,
      normalizedPaymentMethod,
      paymentStatus,
      normalizedStatus,
      referenceNumber,
      notes,
      completedAt
    ]
  );

  return res.rows[0];
};

/**
 * Get POS sale details with items
 */
exports.getSaleById = async (saleId) => {
  const saleRes = await pool.query(
    `SELECT 
      ps.sale_id, ps.sale_number, ps.staff_id, u.first_name, u.last_name,
      ps.customer_name, ps.customer_phone,
      ps.subtotal, ps.discount_amount, ps.tax_amount, ps.total_amount,
      ps.payment_method, ps.payment_status, ps.status,
      ps.reference_number, ps.notes,
      ps.created_at, ps.updated_at, ps.completed_at
     FROM pos_sales ps
     LEFT JOIN users u ON ps.staff_id = u.user_id
     WHERE ps.sale_id = $1`,
    [saleId]
  );

  if (!saleRes.rows[0]) return null;

  const sale = saleRes.rows[0];

  // Get items
  const itemsRes = await pool.query(
    `SELECT 
      psi.item_id, psi.product_id, p.sku, 
      psi.service_id, s.name AS service_name,
      psi.item_name, psi.quantity, psi.unit_price,
      psi.discount_amount, psi.subtotal, psi.notes
     FROM pos_sale_items psi
     LEFT JOIN products p ON psi.product_id = p.product_id
     LEFT JOIN services s ON psi.service_id = s.service_id
     WHERE psi.sale_id = $1
     ORDER BY psi.item_id ASC`,
    [saleId]
  );

  sale.items = itemsRes.rows;
  return sale;
};

/**
 * List POS sales with filters
 */
exports.listSales = async ({
  staffId = null,
  status = null,
  paymentStatus = null,
  startDate = null,
  endDate = null,
  limit = 50,
  offset = 0
} = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (staffId) {
    where.push(`ps.staff_id = $${idx}`);
    params.push(staffId);
    idx++;
  }
  if (status) {
    where.push(`ps.status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (paymentStatus) {
    where.push(`ps.payment_status = $${idx}`);
    params.push(paymentStatus);
    idx++;
  }
  if (startDate) {
    where.push(`ps.created_at >= $${idx}`);
    params.push(new Date(startDate));
    idx++;
  }
  if (endDate) {
    where.push(`ps.created_at < $${idx}`);
    params.push(new Date(endDate));
    idx++;
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT 
      ps.sale_id, ps.sale_number, ps.staff_id, u.first_name, u.last_name,
      ps.customer_name, ps.total_amount, ps.payment_method,
      ps.payment_status, ps.status,
      (SELECT COUNT(*) FROM pos_sale_items WHERE sale_id = ps.sale_id) as item_count,
      ps.created_at
     FROM pos_sales ps
     LEFT JOIN users u ON ps.staff_id = u.user_id
     ${condition}
     ORDER BY ps.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return res.rows;
};

/**
 * Get sales count
 */
exports.getSalesCount = async ({
  staffId = null,
  status = null,
  paymentStatus = null
} = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (staffId) {
    where.push(`staff_id = $${idx}`);
    params.push(staffId);
    idx++;
  }
  if (status) {
    where.push(`status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (paymentStatus) {
    where.push(`payment_status = $${idx}`);
    params.push(paymentStatus);
    idx++;
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const res = await pool.query(`SELECT COUNT(*) as count FROM pos_sales ${condition}`, params);
  return parseInt(res.rows[0].count, 10);
};

// ─── SALE ITEMS MANAGEMENT ──────────────────────────────────────────────────

/**
 * Add product to POS sale
 */
exports.addProductItem = async (saleId, productId, quantity, { discount = 0, notes = null } = {}) => {
  if (quantity <= 0) {
    throw new AppError('Quantity must be greater than 0', 400);
  }
  if (discount < 0) {
    throw new AppError('Discount cannot be negative', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify sale exists and is pending
    const saleRes = await client.query(
      'SELECT sale_id, status FROM pos_sales WHERE sale_id = $1 FOR UPDATE',
      [saleId]
    );
    if (!saleRes.rows[0]) {
      throw new AppError('Sale not found', 404);
    }
    if (saleRes.rows[0].status !== 'pending') {
      throw new AppError('Can only add items to pending sales', 400);
    }

    // Get product
    const productRes = await client.query(
      `SELECT p.product_id, p.name, p.sku, p.price, i.stock FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.product_id = $1`,
      [productId]
    );
    if (!productRes.rows[0]) {
      throw new AppError('Product not found', 404);
    }

    const product = productRes.rows[0];
    const unitPrice = product.price;
    const subtotal = unitPrice * quantity - discount;

    // Add item
    const itemRes = await client.query(
      `INSERT INTO pos_sale_items (
        sale_id, product_id, item_name, quantity, unit_price, discount_amount, subtotal, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING item_id, product_id, item_name, quantity, unit_price, discount_amount, subtotal`,
      [saleId, productId, product.name, quantity, unitPrice, discount, subtotal, notes]
    );

    // Recalculate sale totals
    await recalculateSaleTotals(client, saleId);

    await client.query('COMMIT');
    return itemRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Add service to POS sale
 */
exports.addServiceItem = async (saleId, serviceId, { quantity = 1, discount = 0, notes = null } = {}) => {
  if (quantity <= 0) {
    throw new AppError('Quantity must be greater than 0', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify sale exists and is pending
    const saleRes = await client.query(
      'SELECT sale_id, status FROM pos_sales WHERE sale_id = $1 FOR UPDATE',
      [saleId]
    );
    if (!saleRes.rows[0]) {
      throw new AppError('Sale not found', 404);
    }
    if (saleRes.rows[0].status !== 'pending') {
      throw new AppError('Can only add items to pending sales', 400);
    }

    // Get service
    const serviceRes = await client.query(
      'SELECT service_id, name, price FROM services WHERE service_id = $1 AND is_active = true',
      [serviceId]
    );
    if (!serviceRes.rows[0]) {
      throw new AppError('Service not found or inactive', 404);
    }

    const service = serviceRes.rows[0];
    const unitPrice = service.price;
    const subtotal = unitPrice * quantity - discount;

    // Add item
    const itemRes = await client.query(
      `INSERT INTO pos_sale_items (
        sale_id, service_id, item_name, quantity, unit_price, discount_amount, subtotal, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING item_id, service_id, item_name, quantity, unit_price, discount_amount, subtotal`,
      [saleId, serviceId, service.name, quantity, unitPrice, discount, subtotal, notes]
    );

    // Recalculate sale totals
    await recalculateSaleTotals(client, saleId);

    await client.query('COMMIT');
    return itemRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Remove item from POS sale
 */
exports.removeItem = async (saleId, itemId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify sale is pending
    const saleRes = await client.query(
      'SELECT status FROM pos_sales WHERE sale_id = $1 FOR UPDATE',
      [saleId]
    );
    if (!saleRes.rows[0]) {
      throw new AppError('Sale not found', 404);
    }
    if (saleRes.rows[0].status !== 'pending') {
      throw new AppError('Can only remove items from pending sales', 400);
    }

    // Remove item
    const itemRes = await client.query(
      'DELETE FROM pos_sale_items WHERE item_id = $1 AND sale_id = $2 RETURNING item_id',
      [itemId, saleId]
    );
    if (!itemRes.rows[0]) {
      throw new AppError('Item not found', 404);
    }

    // Recalculate totals
    await recalculateSaleTotals(client, saleId);

    await client.query('COMMIT');
    return { message: 'Item removed successfully' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Update sale payment method and customer info
 */
exports.updateSaleInfo = async (saleId, { paymentMethod, customerName, customerPhone, notes } = {}) => {
  const updates = [];
  const values = [];
  let idx = 1;

  if (paymentMethod) {
    updates.push(`payment_method = $${idx}`);
    values.push(paymentMethod);
    idx++;
  }
  if (customerName !== undefined) {
    updates.push(`customer_name = $${idx}`);
    values.push(customerName);
    idx++;
  }
  if (customerPhone !== undefined) {
    updates.push(`customer_phone = $${idx}`);
    values.push(customerPhone);
    idx++;
  }
  if (notes !== undefined) {
    updates.push(`notes = $${idx}`);
    values.push(notes);
    idx++;
  }

  if (updates.length === 0) {
    return exports.getSaleById(saleId);
  }

  updates.push(`updated_at = now()`);
  values.push(saleId);

  const res = await pool.query(
    `UPDATE pos_sales SET ${updates.join(', ')} 
     WHERE sale_id = $${idx} 
     RETURNING sale_id, payment_method, customer_name, customer_phone, notes`,
    values
  );

  return res.rows[0] || null;
};

// ─── CHECKOUT & PAYMENT ──────────────────────────────────────────────────────

/**
 * Checkout a POS sale (complete transaction and deduct inventory)
 * Main transaction handling inventory + pos_payments
 */
exports.checkoutSale = async (
  saleId,
  paymentMethod,
  { referenceNumber = null, notes = null }
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get sale with items
    const saleRes = await client.query(
      `SELECT 
        ps.sale_id, ps.subtotal, ps.discount_amount, ps.tax_amount, ps.total_amount,
        ps.status, ps.payment_status
       FROM pos_sales ps
       WHERE ps.sale_id = $1 FOR UPDATE`,
      [saleId]
    );

    if (!saleRes.rows[0]) {
      throw new AppError('Sale not found', 404);
    }

    const sale = saleRes.rows[0];

    if (sale.status !== 'pending') {
      throw new AppError('Sale is not in pending status', 400);
    }

    // Get items
    const itemsRes = await client.query(
      `SELECT product_id, quantity FROM pos_sale_items 
       WHERE sale_id = $1 AND product_id IS NOT NULL`,
      [saleId]
    );

    const items = itemsRes.rows;
    if (items.length === 0) {
      throw new AppError('Sale must have at least one item', 400);
    }

    // Validate and deduct inventory
    for (const item of items) {
      const stock = await client.query(
        `SELECT i.stock FROM inventory i WHERE i.product_id = $1 FOR UPDATE`,
        [item.product_id]
      );

      if (!stock.rows[0]) {
        throw new AppError(`Product ${item.product_id} not found`, 404);
      }

      if (stock.rows[0].stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for item. Available: ${stock.rows[0].stock}, Requested: ${item.quantity}`,
          400
        );
      }

      // Deduct stock
      await client.query(
        'UPDATE inventory SET stock = stock - $1, updated_at = now() WHERE product_id = $2',
        [item.quantity, item.product_id]
      );

      // Create inventory log
      await client.query(
        `INSERT INTO inventory_logs (product_id, change_type, quantity, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [item.product_id, 'sale', -item.quantity, 'pos_sale', saleId]
      );
    }

    // Update sale status
    const updateRes = await client.query(
      `UPDATE pos_sales SET 
        status = $1, payment_status = $2, payment_method = $3,
        reference_number = $4, completed_at = now(), updated_at = now()
       WHERE sale_id = $5
       RETURNING sale_id, sale_number, total_amount, status, payment_status`,
      ['completed', paymentMethod === 'cash' ? 'verified' : 'pending', paymentMethod, referenceNumber, saleId]
    );

    // Create pos_payment record
    const paymentRes = await client.query(
      `INSERT INTO pos_payments (sale_id, amount, payment_method, status, reference_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING payment_id, sale_id, amount, payment_method, status, reference_number`,
      [
        saleId,
        sale.total_amount,
        paymentMethod,
        paymentMethod === 'cash' ? 'verified' : 'pending',
        referenceNumber,
        notes
      ]
    );

    await client.query('COMMIT');

    return {
      sale: updateRes.rows[0],
      payment: paymentRes.rows[0],
      itemsProcessed: items.length
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Cancel a POS sale and restore inventory
 */
exports.cancelSale = async (saleId, cancelledBy, reason = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get sale
    const saleRes = await client.query(
      'SELECT sale_id, status FROM pos_sales WHERE sale_id = $1 FOR UPDATE',
      [saleId]
    );

    if (!saleRes.rows[0]) {
      throw new AppError('Sale not found', 404);
    }

    const sale = saleRes.rows[0];
    
    // Can only cancel pending sales (completed sales require refund)
    if (sale.status !== 'pending') {
      throw new AppError('Only pending sales can be cancelled. Use refund for completed sales.', 400);
    }

    // Cancel sale
    const updateRes = await client.query(
      `UPDATE pos_sales SET 
        status = $1, cancelled_at = now(), cancelled_by = $2, notes = $3,
        updated_at = now()
       WHERE sale_id = $4
       RETURNING sale_id, sale_number, status`,
      ['cancelled', cancelledBy, reason, saleId]
    );

    await client.query('COMMIT');
    return updateRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Recalculate sale totals (subtotal, tax, total)
 * Assumes transaction context
 */
const recalculateSaleTotals = async (client, saleId) => {
  const itemsRes = await client.query(
    `SELECT SUM(subtotal) as subtotal, SUM(discount_amount) as total_discount
     FROM pos_sale_items
     WHERE sale_id = $1`,
    [saleId]
  );

  const subtotal = parseFloat(itemsRes.rows[0]?.subtotal || 0);
  const discountAmount = parseFloat(itemsRes.rows[0]?.total_discount || 0);
  
  // Tax calculation (12% default - adjust as needed)
  const taxableAmount = subtotal;
  const taxAmount = taxableAmount * 0.12;
  const totalAmount = subtotal + taxAmount;

  await client.query(
    `UPDATE pos_sales SET 
      subtotal = $1, discount_amount = $2, tax_amount = $3, total_amount = $4,
      updated_at = now()
     WHERE sale_id = $5`,
    [subtotal, discountAmount, taxAmount, totalAmount, saleId]
  );
};

// ─── SALES REPORTING & ANALYTICS ────────────────────────────────────────────

/**
 * Get daily sales summary
 */
exports.getDailySalesSummary = async (date = new Date()) => {
  const dateStr = date.toISOString().split('T')[0];

  const res = await pool.query(
    `SELECT 
      DATE(created_at) as date,
      COUNT(DISTINCT sale_id) as total_transactions,
      SUM(total_amount) as total_sales,
      SUM(discount_amount) as total_discounts,
      SUM(tax_amount) as total_tax,
      COUNT(DISTINCT CASE WHEN payment_method = 'cash' THEN sale_id END) as cash_count,
      COUNT(DISTINCT CASE WHEN payment_method = 'gcash' THEN sale_id END) as gcash_count,
      COUNT(DISTINCT CASE WHEN payment_method = 'bank_transfer' THEN sale_id END) as bank_count,
      COUNT(DISTINCT staff_id) as staff_count
     FROM pos_sales
     WHERE DATE(created_at) = $1 AND status = 'completed'
     GROUP BY DATE(created_at)`,
    [dateStr]
  );

  return res.rows[0] || {
    date: dateStr,
    total_transactions: 0,
    total_sales: 0,
    total_discounts: 0,
    total_tax: 0
  };
};

/**
 * Get staff productivity summary
 */
exports.getStaffSummary = async ({ staffId = null, startDate = null, endDate = null } = {}) => {
  let where = [`ps.status = 'completed'`];
  let params = [];
  let idx = 1;

  if (staffId) {
    where.push(`ps.staff_id = $${idx}`);
    params.push(staffId);
    idx++;
  }
  if (startDate) {
    where.push(`ps.created_at >= $${idx}`);
    params.push(new Date(startDate));
    idx++;
  }
  if (endDate) {
    where.push(`ps.created_at < $${idx}`);
    params.push(new Date(endDate));
    idx++;
  }

  const condition = where.join(' AND ');

  const res = await pool.query(
    `SELECT 
      ps.staff_id, u.first_name, u.last_name,
      COUNT(DISTINCT ps.sale_id) as total_sales,
      SUM(ps.total_amount) as total_amount,
      AVG(ps.total_amount) as avg_sale_value,
      COUNT(DISTINCT CASE WHEN ps.payment_method = 'cash' THEN ps.sale_id END) as cash_sales,
      COUNT(DISTINCT CASE WHEN ps.payment_method = 'gcash' THEN ps.sale_id END) as gcash_sales
     FROM pos_sales ps
     LEFT JOIN users u ON ps.staff_id = u.user_id
     WHERE ${condition}
     GROUP BY ps.staff_id, u.first_name, u.last_name
     ORDER BY total_amount DESC`,
    params
  );

  return res.rows;
};
