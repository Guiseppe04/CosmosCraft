const { pool } = require('../config/database')

// Helper to validate UUID format
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

exports.createOrder = async (orderData) => {
  const { userId, items, notes, shippingMethod, paymentMethod, billingAddress } = orderData
  
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')

    // Validate required fields
    if (!billingAddress) {
      throw new Error('Billing address is required')
    }
    if (!billingAddress.street || !billingAddress.city) {
      throw new Error('Address must include street and city')
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shippingCost = shippingMethod === 'express' ? 500 : 0
    const tax = subtotal * 0.1
    const total = subtotal + shippingCost + tax

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Insert billing address into addresses table
    let shippingAddressId = null
    if (billingAddress.street && billingAddress.city) {
      const addressRes = await client.query(
        `INSERT INTO addresses (user_id, label, line1, line2, city, province, postal_code, country)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING address_id`,
        [
          userId,
          'Shipping Address',
          billingAddress.street,
          billingAddress.street2 || null,
          billingAddress.city,
          billingAddress.province || null,
          billingAddress.postalCode || null,
          'PH' // Philippines - default country
        ]
      )
      shippingAddressId = addressRes.rows[0].address_id
    }

    // Insert order with shipping_address_id
    const orderRes = await client.query(
      `INSERT INTO orders (order_number, user_id, shipping_address_id, subtotal, tax_amount, shipping_cost, total_amount, status, payment_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'pending', $8)
       RETURNING *`,
      [orderNumber, userId, shippingAddressId, subtotal, tax, shippingCost, total, notes || null]
    )
    
    const order = orderRes.rows[0]

    // Insert order items - handle both UUID and non-UUID product IDs
    for (const item of items) {
      // Check if product_id is a valid UUID
      const productId = isValidUUID(item.productId) ? item.productId : null
      
      // For mock products (non-UUID IDs like "prod-001"), store in product_sku
      const productSku = !productId ? item.productId : null
      // Always store product name if provided
      const productName = item.name || null
      
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_sku, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.order_id, productId, productSku, productName, item.quantity, item.price]
      )
    }

    // Append payment method details to notes
    let finalNotes = notes || ''
    if (paymentMethod) {
      finalNotes += `${finalNotes ? '\n\n' : ''}Payment Method: ${paymentMethod}`
    }

    if (finalNotes) {
      await client.query(
        `UPDATE orders SET notes = $1 WHERE order_id = $2`,
        [finalNotes, order.order_id]
      )
    }

    await client.query('COMMIT')

    return order
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Create order error:', error)
    throw new Error(error.message || 'Failed to create order')
  } finally {
    client.release()
  }
}

exports.getUserOrders = async (userId) => {
  const res = await pool.query(
    `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )
  return res.rows
}

exports.getOrderById = async (orderId, userId) => {
  const res = await pool.query(
    `SELECT * FROM orders WHERE order_id = $1 AND user_id = $2`,
    [orderId, userId]
  )
  
  if (res.rows.length === 0) {
    throw new Error('Order not found')
  }

  // Get order items with product images
  const itemsRes = await pool.query(
    `SELECT oi.*, pi.image_url FROM order_items oi
     LEFT JOIN product_images pi ON oi.product_id = pi.product_id AND pi.is_primary = true
     WHERE oi.order_id = $1`,
    [orderId]
  )

  // Get payment information
  const paymentRes = await pool.query(
    `SELECT * FROM payments WHERE order_id = $1`,
    [orderId]
  )

  const order = res.rows[0]
  order.items = itemsRes.rows
  order.payment = paymentRes.rows[0] || null

  return order
}

exports.getAllOrders = async (params = {}) => {
  const { search, include_items } = params;
  let query = 'SELECT * FROM orders';
  const queryParams = [];

  if (search) {
    query += ` WHERE order_number ILIKE $1`;
    queryParams.push(`%${search}%`);
  }

  query += ' ORDER BY created_at DESC';
  const res = await pool.query(query, queryParams);
  
  if (include_items === 'true' || include_items === true) {
    const orderIds = res.rows.map(o => o.order_id);
    if (orderIds.length > 0) {
      const itemsRes = await pool.query(
        `SELECT oi.*, pi.image_url FROM order_items oi
         LEFT JOIN product_images pi ON oi.product_id = pi.product_id AND pi.is_primary = true
         WHERE oi.order_id = ANY($1)`,
        [orderIds]
      );
      const itemsByOrder = itemsRes.rows.reduce((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      }, {});
      
      // Get payment information for all orders
      const paymentsRes = await pool.query(
        `SELECT * FROM payments WHERE order_id = ANY($1)`,
        [orderIds]
      );
      const paymentsByOrder = paymentsRes.rows.reduce((acc, payment) => {
        acc[payment.order_id] = payment;
        return acc;
      }, {});
      return res.rows.map(order => ({
        ...order,
        items: itemsByOrder[order.order_id] || [],
        payment: paymentsByOrder[order.order_id] || null
      }));
    }
  }
  
  return res.rows;
}

exports.updateOrder = async (orderId, updateData) => {
  const { status, payment_status, notes } = updateData;
  const res = await pool.query(
    `UPDATE orders 
     SET status = COALESCE($1, status),
         payment_status = COALESCE($2, payment_status),
         notes = COALESCE($3, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $4 RETURNING *`,
    [status, payment_status, notes, orderId]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

exports.cancelOrder = async (orderId) => {
  const res = await pool.query(
    `UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *`,
    [orderId]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

exports.cancelMyOrder = async (orderId, userId) => {
  const checkRes = await pool.query(
    `SELECT status FROM orders WHERE order_id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (checkRes.rows.length === 0) {
    throw new Error('Order not found');
  }
  const status = checkRes.rows[0].status;
  if (status !== 'pending') {
    throw new Error('Only pending orders can be cancelled');
  }

  const res = await pool.query(
    `UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 AND user_id = $2 RETURNING *`,
    [orderId, userId]
  );
  return res.rows[0];
}

exports.approvePayment = async (orderId) => {
  const res = await pool.query(
    `UPDATE orders SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *`,
    [orderId]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}