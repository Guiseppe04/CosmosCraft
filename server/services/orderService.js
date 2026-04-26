const { pool } = require('../config/database')

const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

const resolveProductId = (...values) => {
  for (const value of values) {
    if (isValidUUID(value)) return value
  }

  return null
}

const hasCustomBuildItems = (items = []) => items.some((item) => Boolean(
  item?.customization ||
  item?.customization_id ||
  String(item?.type || '').toLowerCase() === 'customization' ||
  String(item?.type || '').toLowerCase() === 'custom_build'
))

const normalizePositiveQuantity = (value, fallback = 1) => {
  const quantity = Number(value)

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return fallback
  }

  return Math.max(1, Math.trunc(quantity))
}

const normalizeAddressValue = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()

const getAddressSignature = (address = {}) => ([
  address.line1 ?? address.streetLine1 ?? address.street,
  address.line2 ?? address.streetLine2 ?? address.street2,
  address.city,
  address.province ?? address.stateProvince,
  address.postal_code ?? address.postalZipCode ?? address.postalCode,
  address.country,
].map(normalizeAddressValue).join('|'))

const addInventoryReservation = (reservations, productId, quantity) => {
  if (!productId || quantity <= 0) return

  const currentQuantity = reservations.get(productId) || 0
  reservations.set(productId, currentQuantity + quantity)
}

const collectInventoryReservations = (items = []) => {
  const reservations = new Map()

  for (const item of items) {
    const itemQuantity = normalizePositiveQuantity(item.quantity)
    const directProductId = item.customization ? null : resolveProductId(item.productId, item.id)

    addInventoryReservation(reservations, directProductId, itemQuantity)

    if (!item.customization) continue

    const additionalParts = Array.isArray(item.customization.additionalParts)
      ? item.customization.additionalParts
      : []

    for (const part of additionalParts) {
      const partProductId = resolveProductId(part.product_id, part.productId, part.id)
      const partQuantity = normalizePositiveQuantity(part.quantity)

      addInventoryReservation(reservations, partProductId, itemQuantity * partQuantity)
    }
  }

  return reservations
}

const getRequestedCustomizationId = (customization = {}) => {
  if (!customization || typeof customization !== 'object') return null

  return resolveProductId(
    customization.customizationId,
    customization.dbCustomizationId,
    customization.customization_id
  )
}

const syncCustomizationParts = async (client, customizationId, additionalParts = []) => {
  await client.query(
    'DELETE FROM customization_parts WHERE customization_id = $1',
    [customizationId]
  )

  for (const part of additionalParts) {
    const customizationPartProductId = resolveProductId(part.product_id, part.productId, part.id)

    await client.query(
      `INSERT INTO customization_parts (customization_id, product_id, part_name, quantity, price)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        customizationId,
        customizationPartProductId,
        part.name || part.part_name || 'Custom Part',
        Number(part.quantity) > 0 ? Number(part.quantity) : 1,
        Number(part.price) || 0,
      ]
    )
  }
}

const upsertCustomizationForOrder = async (client, userId, customization, fallbackPrice) => {
  const {
    name,
    config = {},
    summary = {},
    baseBuildPrice,
    additionalParts = [],
  } = customization

  const requestedCustomizationId = getRequestedCustomizationId(customization)
  const totalPrice = Number(baseBuildPrice ?? fallbackPrice ?? 0)
  const guitarType = config.guitarType || (config.bassType ? 'bass' : 'electric')

  if (requestedCustomizationId) {
    const existingCustomizationRes = await client.query(
      `SELECT customization_id
       FROM customizations
       WHERE customization_id = $1 AND user_id = $2`,
      [requestedCustomizationId, userId]
    )

    if (existingCustomizationRes.rows.length > 0) {
      const activeOrderRes = await client.query(
        `SELECT o.order_id
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         WHERE oi.customization_id = $1
           AND o.status <> 'cancelled'
         LIMIT 1`,
        [requestedCustomizationId]
      )

      if (activeOrderRes.rows.length > 0) {
        throw new Error('This custom build is already attached to an active order.')
      }

      await client.query(
        `UPDATE customizations
         SET name = $1,
             guitar_type = $2,
             body_wood = $3,
             neck_wood = $4,
             fingerboard_wood = $5,
             bridge_type = $6,
             pickups = $7,
             color = $8,
             finish_type = $9,
             total_price = $10,
             is_saved = $11,
             updated_at = now()
         WHERE customization_id = $12`,
        [
          name || 'Custom Build',
          guitarType,
          summary.bodyWood || config.bodyWood || null,
          summary.neck || config.neck || null,
          summary.fretboard || config.fretboard || null,
          summary.bridge || config.bridge || null,
          summary.pickups || config.pickups || null,
          summary.bodyFinish || config.bodyFinish || null,
          summary.bodyFinish || config.bodyFinish || null,
          totalPrice,
          true,
          requestedCustomizationId,
        ]
      )

      await syncCustomizationParts(client, requestedCustomizationId, additionalParts)

      return requestedCustomizationId
    }
  }

  const customizationRes = await client.query(
    `INSERT INTO customizations (
       user_id,
       name,
       guitar_type,
       body_wood,
       neck_wood,
       fingerboard_wood,
       bridge_type,
       pickups,
       color,
       finish_type,
       total_price,
       is_saved
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING customization_id`,
    [
      userId,
      name || 'Custom Build',
      guitarType,
      summary.bodyWood || config.bodyWood || null,
      summary.neck || config.neck || null,
      summary.fretboard || config.fretboard || null,
      summary.bridge || config.bridge || null,
      summary.pickups || config.pickups || null,
      summary.bodyFinish || config.bodyFinish || null,
      summary.bodyFinish || config.bodyFinish || null,
      totalPrice,
      true
    ]
  )

  const customizationId = customizationRes.rows[0].customization_id
  await syncCustomizationParts(client, customizationId, additionalParts)

  return customizationId
}

const validateAndDeductInventory = async (client, reservations, orderId) => {
  const productIds = Array.from(reservations.keys()).sort()

  for (const productId of productIds) {
    const quantity = reservations.get(productId)

    const productRes = await client.query(
      `SELECT p.product_id, p.name, p.is_active, i.stock, i.low_stock_threshold
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.product_id = $1`,
      [productId]
    )

    const product = productRes.rows[0]

    if (!product) {
      throw new Error(`Product ${productId} not found`)
    }

    if (!product.is_active) {
      throw new Error(`Product "${product.name}" is no longer available`)
    }

    const inventoryRes = await client.query(
      `SELECT stock, low_stock_threshold
       FROM inventory
       WHERE product_id = $1
       FOR UPDATE`,
      [productId]
    )

    if (inventoryRes.rows.length === 0) {
      throw new Error(`Inventory record not found for "${product.name}"`)
    }

    const currentStock = Number(inventoryRes.rows[0].stock) || 0
    const lowStockThreshold = Number(inventoryRes.rows[0].low_stock_threshold) || 10

    if (currentStock < quantity) {
      throw new Error(`Insufficient stock for "${product.name}". Available: ${currentStock}`)
    }

    const updateRes = await client.query(
      `UPDATE inventory
       SET stock = stock - $1, updated_at = now()
       WHERE product_id = $2
       RETURNING stock`,
      [quantity, productId]
    )

    await client.query(
      `INSERT INTO inventory_logs (product_id, change_type, quantity, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, 'sale', -quantity, 'order', orderId]
    )

    const newStock = Number(updateRes.rows[0]?.stock) || 0

    if (newStock <= lowStockThreshold && newStock > 0) {
      await client.query(
        `INSERT INTO low_stock_alerts (product_id, current_stock, threshold)
         VALUES ($1, $2, $3)`,
        [productId, newStock, lowStockThreshold]
      )
    }
  }
}

// Payment status enum for order payment_status field
exports.PAYMENT_STATUS = {
  PENDING: 'pending',
  PROOF_SUBMITTED: 'proof_submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FAILED: 'failed'
}

// Valid payment status transitions (including self-transition for idempotent updates)
const PAYMENT_STATUS_TRANSITIONS = {
  'pending': ['proof_submitted', 'pending'],
  'proof_submitted': ['under_review', 'pending', 'proof_submitted'],
  'under_review': ['approved', 'rejected', 'under_review'],
  'approved': ['approved', 'rejected', 'failed'],
  'rejected': ['pending', 'proof_submitted', 'rejected'],
  'failed': ['pending', 'proof_submitted', 'failed']
}

function isValidPaymentStatusTransition(currentStatus, newStatus) {
  // Allow same status (idempotent)
  if (currentStatus === newStatus) return true
  const allowed = PAYMENT_STATUS_TRANSITIONS[currentStatus] || []
  return allowed.includes(newStatus)
}

const VALID_STATUS_TRANSITIONS = {
  'pending': ['processing', 'cancelled', 'pending'],
  'processing': ['shipped', 'cancelled', 'processing'],
  'shipped': ['out_for_delivery', 'cancelled', 'shipped'],
  'out_for_delivery': ['delivered', 'cancelled', 'out_for_delivery'],
  'delivered': ['delivered'],
  'cancelled': ['pending', 'cancelled']
}

const STATUS_FIELD_REQUIREMENTS = {
  'shipped': ['tracking_number'],
  'out_for_delivery': ['tracking_number', 'rider_details'],
  'delivered': ['tracking_number']
}

exports.createOrder = async (orderData) => {
  const { userId, items, notes, shippingMethod, paymentMethod, billingAddress, termsAccepted } = orderData
  
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

    if (paymentMethod === 'cash' && hasCustomBuildItems(items)) {
      throw new Error('COD is only available for regular product orders. Customized guitars require down payment.')
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shippingCost = shippingMethod === 'express' ? 500 : 0
    const tax = subtotal * 0.1
    const total = subtotal + shippingCost + tax

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Insert billing address into addresses table (check for existing first)
    let shippingAddressId = null
    if (billingAddress.street && billingAddress.city) {
      // Reuse an existing saved address when the full normalized address matches.
      const existingAddr = await client.query(
        `SELECT address_id, line1, line2, city, province, postal_code, country
         FROM addresses
         WHERE user_id = $1`,
        [userId]
      )
      const matchedAddress = existingAddr.rows.find(
        (address) => getAddressSignature(address) === getAddressSignature(billingAddress)
      )
      
      if (matchedAddress) {
        shippingAddressId = matchedAddress.address_id
      } else {
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
            billingAddress.country || 'PH'
          ]
        )
        shippingAddressId = addressRes.rows[0].address_id
      }
    }

    // Insert order with shipping_address_id
    const orderRes = await client.query(
      `INSERT INTO orders (order_number, user_id, shipping_address_id, subtotal, tax_amount, shipping_cost, total_amount, status, payment_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'pending', $8)
       RETURNING *`,
      [orderNumber, userId, shippingAddressId, subtotal, tax, shippingCost, total, notes || null]
    )
    
    const order = orderRes.rows[0]
    const inventoryReservations = collectInventoryReservations(items)
    const customizationIds = []
    const orderedCustomBuilds = []

    await validateAndDeductInventory(client, inventoryReservations, order.order_id)

    // Insert order items - handle products and custom builds
    for (const item of items) {
      let customizationId = null

      if (item.customization) {
        customizationId = await upsertCustomizationForOrder(
          client,
          userId,
          item.customization,
          item.price
        )

        customizationIds.push(customizationId)
        orderedCustomBuilds.push({
          build_id: item.customization.buildId || null,
          customization_id: customizationId,
        })
      }

      // Check if product_id is a valid UUID
      const productId = customizationId ? null : resolveProductId(item.productId, item.id)
      
      // For mock products (non-UUID IDs like "prod-001"), store in product_sku
      const productSku = !customizationId && !productId ? item.productId : null
      // Always store product name if provided
      const productName = item.name || null
      
      await client.query(
        `INSERT INTO order_items (order_id, product_id, customization_id, product_sku, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.order_id, productId, customizationId, productSku, productName, item.quantity, item.price]
      )
    }

    // Append payment method details to notes
    let finalNotes = notes || ''
    if (termsAccepted === true) {
      finalNotes += `${finalNotes ? '\n\n' : ''}Terms and Conditions accepted: yes`
    }
    if (paymentMethod) {
      finalNotes += `${finalNotes ? '\n\n' : ''}Payment Method: ${paymentMethod}`
    }

    if (finalNotes) {
      await client.query(
        `UPDATE orders SET notes = $1 WHERE order_id = $2`,
        [finalNotes, order.order_id]
      )
    }

    order.customization_ids = Array.from(new Set(customizationIds))
    order.ordered_custom_builds = orderedCustomBuilds

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

  for (const order of res.rows) {
    const itemsRes = await pool.query(
      `SELECT customization_id
       FROM order_items
       WHERE order_id = $1
         AND customization_id IS NOT NULL`,
      [order.order_id]
    )

    order.customization_ids = itemsRes.rows.map(item => item.customization_id)
  }

  return res.rows
}

exports.getOrderById = async (orderId, userId) => {
  const res = await pool.query(
    `SELECT o.*, 
      a.line1 as shipping_line1, a.line2 as shipping_line2, a.city as shipping_city, 
      a.province as shipping_province, a.postal_code as shipping_postal_code, a.country as shipping_country,
      u.first_name, u.last_name, u.email, u.phone as contact_phone
      FROM orders o
      LEFT JOIN addresses a ON o.shipping_address_id = a.address_id
      LEFT JOIN users u ON o.user_id = u.user_id
      WHERE o.order_id = $1 AND o.user_id = $2`,
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
  let query = `SELECT o.*, 
    a.line1 as shipping_line1, a.line2 as shipping_line2, a.city as shipping_city, 
    a.province as shipping_province, a.postal_code as shipping_postal_code, a.country as shipping_country,
    u.first_name, u.last_name, u.email, u.phone as contact_phone
    FROM orders o
    LEFT JOIN addresses a ON o.shipping_address_id = a.address_id
    LEFT JOIN users u ON o.user_id = u.user_id`;
  const queryParams = [];

  if (search) {
    query += ` WHERE o.order_number ILIKE $1`;
    queryParams.push(`%${search}%`);
  }

  query += ' ORDER BY o.created_at DESC';
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
  const { status, payment_status, notes, tracking_number, courier_name, shipped_at, out_for_delivery_at, delivered_at, rider_name, rider_contact } = updateData;
  
  if (status) {
    const currentRes = await pool.query(
      `SELECT status, tracking_number, rider_name, rider_contact FROM orders WHERE order_id = $1`,
      [orderId]
    );
    
    if (currentRes.rows.length === 0) {
      return null;
    }
    
    const currentStatus = currentRes.rows[0].status;
    const order = currentRes.rows[0];
    
    // Skip validation if status is not actually changing (idempotent)
    if (status !== currentStatus) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      
      if (!allowedTransitions.includes(status)) {
        throw new Error(`Invalid status transition from '${currentStatus}' to '${status}'`);
      }
      
      if (STATUS_FIELD_REQUIREMENTS[status]) {
        // Check for required fields - accept either in updateData or existing order
        // Also support rider_details combining rider_name and rider_contact
        const orderRiderDetails = order.rider_name || order.rider_contact || null
        const orderFields = {
          ...order,
          rider_details: orderRiderDetails
        }
        
        const missingFields = STATUS_FIELD_REQUIREMENTS[status].filter(field => 
          !updateData[field] && !orderFields[field]
        );
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields for status '${status}': ${missingFields.join(', ')}`);
        }
        
        // Map rider_details to separate fields if provided
        if (updateData.rider_details && !updateData.rider_name && !updateData.rider_contact) {
          updateData.rider_name = updateData.rider_details
          updateData.rider_contact = updateData.rider_details
        }
      }
    }
  }
  
  if (status === 'shipped' && !shipped_at && tracking_number) {
    updateData.shipped_at = new Date();
  }
  if (status === 'out_for_delivery' && !out_for_delivery_at) {
    updateData.out_for_delivery_at = new Date();
  }
  if (status === 'delivered' && !delivered_at) {
    updateData.delivered_at = new Date();
  }

  const res = await pool.query(
    `UPDATE orders 
     SET status = COALESCE($1, status),
         payment_status = COALESCE($2, payment_status),
         notes = COALESCE($3, notes),
         tracking_number = COALESCE($4, tracking_number),
         courier_name = COALESCE($5, courier_name),
         shipped_at = COALESCE($6, shipped_at),
         out_for_delivery_at = COALESCE($7, out_for_delivery_at),
         delivered_at = COALESCE($8, delivered_at),
         rider_name = COALESCE($9, rider_name),
         rider_contact = COALESCE($10, rider_contact),
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $11 RETURNING *`,
    [status, payment_status, notes, tracking_number, courier_name, shipped_at, out_for_delivery_at, delivered_at, rider_name, rider_contact, orderId]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

exports.updatePaymentStatus = async (orderId, status, options = {}) => {
  const { 
    reference_number, 
    admin_name, 
    admin_email, 
    rejection_reason, 
    admin_notes,
    admin_user_id 
  } = options

  // Get current order to check status transition
  const orderRes = await pool.query(
    'SELECT payment_status, status FROM orders WHERE order_id = $1',
    [orderId]
  )
  
  if (orderRes.rows.length === 0) return null
  
  const currentStatus = orderRes.rows[0].payment_status
  
  // Validate status transition
  if (!isValidPaymentStatusTransition(currentStatus, status)) {
    throw new Error(`Invalid payment status transition from '${currentStatus}' to '${status}'`)
  }

  // Build update query dynamically
  const updateFields = ['payment_status = $1', 'updated_at = CURRENT_TIMESTAMP']
  const updateValues = [status]
  let paramIndex = 2

  if (reference_number !== undefined) {
    updateFields.push(`payment_reference_number = $${paramIndex++}`)
    updateValues.push(reference_number)
  }

  if (status === 'approved') {
    updateFields.push(`reviewed_by = $${paramIndex++}`)
    updateValues.push(admin_user_id || null)
    updateFields.push(`reviewed_at = CURRENT_TIMESTAMP`)
    updateFields.push(`rejection_reason = NULL`)
  }

  if (status === 'rejected' && rejection_reason) {
    updateFields.push(`rejection_reason = $${paramIndex++}`)
    updateValues.push(rejection_reason)
  }

  if (admin_notes) {
    updateFields.push(`admin_notes = $${paramIndex++}`)
    updateValues.push(admin_notes)
  }

  updateValues.push(orderId)

  const res = await pool.query(
    `UPDATE orders SET ${updateFields.join(', ')} WHERE order_id = $${paramIndex} RETURNING *`,
    updateValues
  )

  const order = res.rows[0]

  // Log to audit table if it exists
  try {
    await pool.query(
      `INSERT INTO payment_audit_log (order_id, action, previous_status, new_status, admin_name, admin_email, reference_number, rejection_reason, admin_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        orderId,
        status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'reviewed',
        currentStatus,
        status,
        admin_name,
        admin_email,
        reference_number,
        rejection_reason,
        admin_notes
      ]
    )
  } catch (auditErr) {
    // Log but don't fail if audit table doesn't exist
    console.warn('Payment audit log not available:', auditErr.message)
  }

  return order
}

exports.approvePayment = async (orderId, options = {}) => {
  const { admin_name, admin_email, admin_user_id } = options
  
  // Get current status first
  const currentRes = await pool.query(
    'SELECT payment_status FROM orders WHERE order_id = $1',
    [orderId]
  )
  
  if (currentRes.rows.length === 0) return null
  
  const currentStatus = currentRes.rows[0].payment_status
  
  // Validate transition to approved
  if (!isValidPaymentStatusTransition(currentStatus, 'approved')) {
    throw new Error(`Cannot approve payment with current status: ${currentStatus}`)
  }
  
  const res = await pool.query(
    `UPDATE orders SET 
      payment_status = 'approved', 
      reviewed_by = $1, 
      reviewed_at = CURRENT_TIMESTAMP,
      rejection_reason = NULL,
      updated_at = CURRENT_TIMESTAMP 
    WHERE order_id = $2 RETURNING *`,
    [admin_user_id || null, orderId]
  )
  
  const order = res.rows[0]
  
  // Log audit
  try {
    await pool.query(
      `INSERT INTO payment_audit_log (order_id, action, previous_status, new_status, admin_name, admin_email)
       VALUES ($1, 'approved', $2, 'approved', $3, $4)`,
      [orderId, currentStatus, admin_name, admin_email]
    )
  } catch (auditErr) {
    console.warn('Payment audit log not available:', auditErr.message)
  }
  
  return order
}

exports.updateShipment = async (orderId, shipmentData) => {
  const { tracking_number, courier_name, rider_name, rider_contact } = shipmentData;
  
  const orderRes = await pool.query(
    `SELECT status, payment_status FROM orders WHERE order_id = $1`,
    [orderId]
  );
  
  if (orderRes.rows.length === 0) {
    throw new Error('Order not found');
  }
  
  const order = orderRes.rows[0];
  
  if (order.payment_status !== exports.PAYMENT_STATUS.APPROVED) {
    throw new Error('Cannot ship order - payment not completed');
  }
  
  const validShipStatuses = ['processing'];
  if (!validShipStatuses.includes(order.status)) {
    throw new Error(`Cannot ship order - current status is '${order.status}'. Order must be in 'processing' status to be shipped.`);
  }
  
  if (!tracking_number || !courier_name) {
    throw new Error('Tracking number and courier name are required for shipment');
  }
  
  const res = await pool.query(
    `UPDATE orders 
     SET status = 'shipped',
         tracking_number = $1,
         courier_name = $2,
         rider_name = $3,
         rider_contact = $4,
         shipped_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $5 RETURNING *`,
    [tracking_number, courier_name, rider_name || null, rider_contact || null, orderId]
  );
  
  return res.rows[0];
}

exports.updateOutForDelivery = async (orderId, riderData) => {
  const { rider_name, rider_contact } = riderData;
  
  const orderRes = await pool.query(
    `SELECT status FROM orders WHERE order_id = $1`,
    [orderId]
  );
  
  if (orderRes.rows.length === 0) {
    throw new Error('Order not found');
  }
  
  const order = orderRes.rows[0];
  
  if (order.status !== 'shipped') {
    throw new Error(`Cannot mark as out for delivery - current status is '${order.status}'. Order must be in 'shipped' status.`);
  }
  
  if (!rider_name || !rider_contact) {
    throw new Error('Rider name and contact are required for out for delivery status');
  }
  
  const res = await pool.query(
    `UPDATE orders 
     SET status = 'out_for_delivery',
         rider_name = $1,
         rider_contact = $2,
         out_for_delivery_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $3 RETURNING *`,
    [rider_name, rider_contact, orderId]
  );
  
  return res.rows[0];
}

exports.markDelivered = async (orderId) => {
  const orderRes = await pool.query(
    `SELECT status FROM orders WHERE order_id = $1`,
    [orderId]
  );
  
  if (orderRes.rows.length === 0) {
    throw new Error('Order not found');
  }
  
  const order = orderRes.rows[0];
  
  if (order.status !== 'out_for_delivery') {
    throw new Error(`Cannot mark as delivered - current status is '${order.status}'. Order must be in 'out_for_delivery' status.`);
  }
  
  const res = await pool.query(
    `UPDATE orders 
     SET status = 'delivered',
         delivered_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $1 RETURNING *`,
    [orderId]
  );
  
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
