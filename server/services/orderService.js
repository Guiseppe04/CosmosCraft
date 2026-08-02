const { pool } = require('../config/database')
const { generateOrderNumber, determineOrderTypePrefix } = require('../utils/orderNumber')

const syncStockToBuilderParts = async (productId, delta) => {
  if (!productId || delta === 0) return;
  await pool.query(
    'UPDATE guitar_builder_parts SET stock = stock + $1, updated_at = now() WHERE product_id = $2',
    [delta, productId]
  );
};

let ensureOrderItemsColumnsReady = false;
let ensureOrderItemsColumnsPromise = null;

const ensureOrderItemsColumns = async () => {
  if (ensureOrderItemsColumnsReady) return;
  if (!ensureOrderItemsColumnsPromise) {
    ensureOrderItemsColumnsPromise = (async () => {
      const checkRes = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'order_items'
           AND table_schema = current_schema()
           AND column_name IN ('product_sku', 'deleted_at')`
      );
      const existing = new Set(checkRes.rows.map((row) => row.column_name));
      if (!existing.has('product_sku')) {
        await pool.query(`ALTER TABLE order_items ADD COLUMN product_sku VARCHAR(50)`);
      }
      if (!existing.has('deleted_at')) {
        await pool.query(`ALTER TABLE order_items ADD COLUMN deleted_at TIMESTAMPTZ`);
      }
      ensureOrderItemsColumnsReady = true;
    })().catch((error) => {
      ensureOrderItemsColumnsPromise = null;
      throw error;
    });
  }
  await ensureOrderItemsColumnsPromise;
};

let ensureInstallmentColumnsReady = false;
let ensureInstallmentColumnsPromise = null;

const ensureInstallmentColumns = async () => {
  if (ensureInstallmentColumnsReady) return;
  if (!ensureInstallmentColumnsPromise) {
    ensureInstallmentColumnsPromise = (async () => {
      const checkRes = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'orders'
           AND table_schema = current_schema()
           AND column_name = 'payment_plan'`
      );
      if (checkRes.rows.length === 0) {
        await pool.query(`ALTER TABLE orders ADD COLUMN payment_plan VARCHAR(20) CHECK (payment_plan IN ('full_payment', 'installment'))`);
        await pool.query(`ALTER TABLE orders ADD COLUMN initial_payment_percentage NUMERIC(5,2) CHECK (initial_payment_percentage >= 0 AND initial_payment_percentage <= 1)`);
        await pool.query(`ALTER TABLE orders ADD COLUMN installment_tenure_months INT CHECK (installment_tenure_months >= 1)`);
        await pool.query(`ALTER TABLE orders ADD COLUMN initial_payment_amount NUMERIC(12, 2) CHECK (initial_payment_amount >= 0)`);
        await pool.query(`ALTER TABLE orders ADD COLUMN monthly_installment_amount NUMERIC(12, 2) CHECK (monthly_installment_amount >= 0)`);
        console.log('Added installment plan columns to orders table');
      }
      ensureInstallmentColumnsReady = true;
    })().catch((error) => {
      ensureInstallmentColumnsPromise = null;
      throw error;
    });
  }
  await ensureInstallmentColumnsPromise;
};

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

const countryNameToCode = (() => {
  const map = new Map([
    ['philippines', 'PH'],
    ['the philippines', 'PH'],
    ['usa', 'US'],
    ['united states', 'US'],
    ['united states of america', 'US'],
    ['uk', 'GB'],
    ['united kingdom', 'GB'],
  ])

  if (typeof Intl?.DisplayNames !== 'function' || typeof Intl?.supportedValuesOf !== 'function') {
    return map
  }

  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })

    for (const code of Intl.supportedValuesOf('region')) {
      if (!/^[A-Z]{2}$/.test(code)) continue

      const name = displayNames.of(code)
      const normalizedName = normalizeAddressValue(name)

      if (normalizedName) {
        map.set(normalizedName, code)
      }
    }
  } catch (error) {
    // Keep the alias map if the runtime does not support full region metadata.
  }

  return map
})()

const normalizeCountryCode = (value, fallback = 'PH') => {
  const rawValue = String(value || '').trim()

  if (!rawValue) {
    return fallback
  }

  const upperValue = rawValue.toUpperCase()
  if (/^[A-Z]{2}$/.test(upperValue)) {
    return upperValue
  }

  return countryNameToCode.get(normalizeAddressValue(rawValue)) || null
}

const createValidationError = (message, statusCode = 400) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const extractPaymentMethodFromNotes = (notes = '') => {
  const match = String(notes || '').match(/Payment Method:\s*([a-z_]+)/i)
  return match?.[1] ? String(match[1]).toLowerCase() : ''
}

const resolveOrderPaymentMethod = (order = {}, payment = null) => {
  const paymentMethod = String(
    payment?.method
    || order?.payment_method
    || extractPaymentMethodFromNotes(order?.notes)
    || ''
  ).toLowerCase()

  if (!paymentMethod) return null
  if (paymentMethod.includes('cash') || paymentMethod.includes('cod')) return 'cash'
  if (paymentMethod.includes('gcash')) return 'gcash'
  if (paymentMethod.includes('bank') || paymentMethod.includes('transfer')) return 'bank_transfer'
  return paymentMethod
}

const getAddressSignature = (address = {}) => ([
  address.line1 ?? address.streetLine1 ?? address.street,
  address.line2 ?? address.streetLine2 ?? address.street2,
  address.city,
  address.province ?? address.stateProvince,
  address.postal_code ?? address.postalZipCode ?? address.postalCode,
  normalizeCountryCode(address.country, ''),
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
      throw createValidationError(`Product ${productId} not found`, 404)
    }

    if (!product.is_active) {
      throw createValidationError(`Product "${product.name}" is no longer available`, 400)
    }

    const inventoryRes = await client.query(
      `SELECT stock, low_stock_threshold
       FROM inventory
       WHERE product_id = $1
       FOR UPDATE`,
      [productId]
    )

    if (inventoryRes.rows.length === 0) {
      throw createValidationError(`Inventory record not found for "${product.name}"`, 404)
    }

    const currentStock = Number(inventoryRes.rows[0].stock) || 0
    const lowStockThreshold = Number(inventoryRes.rows[0].low_stock_threshold) || 10

    if (currentStock < quantity) {
      throw createValidationError(`Not enough stock for ${product.name}. Available stock: ${currentStock}.`, 400)
    }

    const updateRes = await client.query(
      `UPDATE inventory
       SET stock = stock - $1, updated_at = now()
       WHERE product_id = $2
       RETURNING stock`,
      [quantity, productId]
    )

    await syncStockToBuilderParts(productId, -quantity)

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
  'proof_submitted': ['under_review', 'approved', 'rejected', 'pending', 'proof_submitted'],
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
  'pending': ['processing'],
  'processing': ['shipped'],
  'shipped': ['out_for_delivery'],
  'out_for_delivery': ['delivered'],
  'delivered': [],
  'cancelled': []
}

const STATUS_FIELD_REQUIREMENTS = {
  'shipped': ['tracking_number'],
  'out_for_delivery': ['rider_name'],
  'delivered': ['tracking_number']
}

exports.createOrder = async (orderData) => {
  const { userId, items, notes, shippingMethod, paymentMethod, billingAddress, termsAccepted, paymentPlan, initialPaymentPercentage, installmentTenureMonths } = orderData
  
  // Ensure database columns exist
  await ensureOrderItemsColumns()
  await ensureInstallmentColumns()
  
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')

    // Validate required fields
    if (!billingAddress) {
      throw createValidationError('Billing address is required')
    }
    if (!billingAddress.street || !billingAddress.city) {
      throw createValidationError('Address must include street and city')
    }

    const normalizedCountryCode = normalizeCountryCode(billingAddress.country)
    if (!normalizedCountryCode) {
      throw createValidationError('Address must include a valid 2-letter country code')
    }

    let shippingAddressId = null

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shippingCost = shippingMethod === 'express' ? 500 : 0
    const tax = subtotal * 0.1
    const total = subtotal + shippingCost + tax

    const orderTypePrefix = determineOrderTypePrefix(items)
    const orderNumber = await generateOrderNumber(client, orderTypePrefix)

    // Determine if this is a custom build order
    const isCustomBuild = hasCustomBuildItems(items)

    // Determine payment plan and initial order status
    const resolvedPaymentPlan = paymentPlan || 'full_payment';
    const isInstallment = resolvedPaymentPlan === 'installment';
    
    // Calculate installment amounts if applicable
    let initialPaymentAmount = null;
    let monthlyInstallmentAmount = null;
    const resolvedInitialPaymentPercentage = isInstallment ? (Number(initialPaymentPercentage) || 0.50) : null;
    const resolvedTenureMonths = isInstallment ? (Number(installmentTenureMonths) || 6) : null;
    
    if (isInstallment && isCustomBuild) {
      const financedAmount = total * (1 - resolvedInitialPaymentPercentage);
      initialPaymentAmount = Math.round(total * resolvedInitialPaymentPercentage * 100) / 100;
      monthlyInstallmentAmount = financedAmount > 0
        ? Math.round((financedAmount * (1 + 0.03) / resolvedTenureMonths) * 100) / 100
        : 0;
    }

    // Set initial order status based on payment plan
    // Installment: starts as 'pending' until initial payment is verified
    // Full payment: starts as 'processing' if payment method is cash, otherwise 'pending'
    const initialOrderStatus = isInstallment ? 'pending' : 'pending';

    // Insert billing address into addresses table (check for existing first)
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
            normalizedCountryCode
          ]
        )
        shippingAddressId = addressRes.rows[0].address_id
      }
    }

    // Insert order with shipping_address_id and installment plan columns
    const orderRes = await client.query(
      `INSERT INTO orders (order_number, order_type, user_id, shipping_address_id, subtotal, tax_amount, shipping_cost, total_amount, status, payment_status, notes, payment_plan, initial_payment_percentage, installment_tenure_months, initial_payment_amount, monthly_installment_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        orderNumber,
        orderTypePrefix === 'CO' ? 'customization' : 'product',
        userId,
        shippingAddressId,
        subtotal,
        tax,
        shippingCost,
        total,
        initialOrderStatus,
        notes || null,
        isInstallment ? 'installment' : 'full_payment',
        resolvedInitialPaymentPercentage,
        resolvedTenureMonths,
        initialPaymentAmount,
        monthlyInstallmentAmount,
      ]
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
    if (isInstallment) {
      finalNotes += `${finalNotes ? '\n\n' : ''}Payment Plan: Installment (${resolvedTenureMonths} months, ${Math.round(resolvedInitialPaymentPercentage * 100)}% initial payment)`
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
    throw error
  } finally {
    client.release()
  }
}

exports.getUserOrders = async (userId) => {
  const res = await pool.query(
    `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )

  if (res.rows.length === 0) {
    return res.rows
  }

  const orderIds = res.rows.map((order) => order.order_id)
  const itemsRes = await pool.query(
    `SELECT oi.*, pi.image_url
     FROM order_items oi
     LEFT JOIN product_images pi ON oi.product_id = pi.product_id AND pi.is_primary = true
     WHERE oi.order_id = ANY($1)`,
    [orderIds]
  )

  const itemsByOrder = itemsRes.rows.reduce((acc, item) => {
    if (!acc[item.order_id]) acc[item.order_id] = []
    acc[item.order_id].push(item)
    return acc
  }, {})

  const paymentsRes = await pool.query(
    `SELECT DISTINCT ON (order_id) *
     FROM payments
     WHERE order_id = ANY($1)
     ORDER BY order_id, created_at DESC`,
    [orderIds]
  )

  const paymentsByOrder = paymentsRes.rows.reduce((acc, payment) => {
    acc[payment.order_id] = payment
    return acc
  }, {})

  return res.rows.map((order) => {
    const items = itemsByOrder[order.order_id] || []
    const payment = paymentsByOrder[order.order_id] || null

    return {
      ...order,
      items,
      payment,
      payment_method: resolveOrderPaymentMethod(order, payment),
      customization_ids: items
        .map((item) => item.customization_id)
        .filter(Boolean),
    }
  })
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
  order.payment_method = resolveOrderPaymentMethod(order, order.payment)

  return order
}

exports.getAllOrders = async (params = {}) => {
  const {
    search,
    order_type,
    status,
    payment_status,
    date_from,
    date_to,
    payment_method,
    sort_by = 'created_at',
    sort_dir = 'desc',
    page = 1,
    page_size = 10,
    include_items = false,
  } = params;

  const limit = Math.min(Math.max(Number(page_size) || 10, 1), 100)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit
  const allowedSortColumns = ['created_at', 'order_number', 'total_amount', 'status', 'payment_status', 'customer_name']
  const orderBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at'
  const orderDir = sort_dir === 'asc' ? 'ASC' : 'DESC'

  const where = []
  const queryParams = []
  let idx = 1

  if (order_type) {
    where.push(`o.order_type = $${idx++}`)
    queryParams.push(order_type)
  }
  if (status) {
    where.push(`o.status = $${idx++}`)
    queryParams.push(status)
  }
  if (payment_status) {
    where.push(`o.payment_status = $${idx++}`)
    queryParams.push(payment_status)
  }
  if (date_from) {
    where.push(`o.created_at >= $${idx++}`)
    queryParams.push(date_from)
  }
  if (date_to) {
    where.push(`o.created_at <= $${idx++}`)
    queryParams.push(date_to)
  }
  if (payment_method) {
    where.push(`EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.order_id AND p.method = $${idx++})`)
    queryParams.push(payment_method)
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  let searchClause = ''
  if (search && String(search).trim()) {
    const term = `%${String(search).trim().toLowerCase()}%`
    const searchFilters = [
      `o.order_number ILIKE $${idx++}`,
      `u.first_name ILIKE $${idx++}`,
      `u.last_name ILIKE $${idx++}`,
      `u.email ILIKE $${idx++}`,
      `u.phone ILIKE $${idx++}`,
      `oi.product_name ILIKE $${idx++}`,
      `c.name ILIKE $${idx++}`,
      `p.reference_number ILIKE $${idx++}`,
      `o.status::TEXT ILIKE $${idx++}`,
      `o.payment_status::TEXT ILIKE $${idx++}`,
    ]
    searchClause = `AND (${searchFilters.join(' OR ')})`
    for (let i = 0; i < searchFilters.length; i++) {
      queryParams.push(term)
    }
  }

  const totalQuery = `
    SELECT COUNT(DISTINCT o.order_id)::int AS total
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN customizations c ON c.customization_id = oi.customization_id
    LEFT JOIN payments p ON p.order_id = o.order_id
    ${whereClause}
    ${searchClause}
  `

  const totalResult = await pool.query(totalQuery, queryParams)
  const total = totalResult.rows[0]?.total || 0

  const sortColumn = orderBy === 'customer_name'
    ? `u.last_name ${orderDir}, u.first_name ${orderDir}`
    : orderBy === 'order_number'
      ? `o.order_number ${orderDir}`
      : orderBy === 'total_amount'
        ? `o.total_amount ${orderDir}`
        : orderBy === 'status'
          ? `o.status ${orderDir}`
          : orderBy === 'payment_status'
            ? `o.payment_status ${orderDir}`
            : `o.created_at ${orderDir}`

  const dataQuery = `
    SELECT
      o.*,
      a.line1 AS shipping_line1,
      a.line2 AS shipping_line2,
      a.city AS shipping_city,
      a.province AS shipping_province,
      a.postal_code AS shipping_postal_code,
      a.country AS shipping_country,
      u.first_name,
      u.last_name,
      u.email,
      u.phone AS contact_phone
    FROM orders o
    LEFT JOIN addresses a ON a.address_id = o.shipping_address_id
    LEFT JOIN users u ON u.user_id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN customizations c ON c.customization_id = oi.customization_id
    LEFT JOIN payments p ON p.order_id = o.order_id
    ${whereClause}
    ${searchClause}
    GROUP BY o.order_id, a.address_id, u.user_id
    ORDER BY ${sortColumn}
    LIMIT $${idx++} OFFSET $${idx++}
  `

  const dataResult = await pool.query(dataQuery, [...queryParams, limit, offset])

  const orderIds = dataResult.rows.map(r => r.order_id)
  let paymentsByOrder = {}
  if (orderIds.length > 0) {
    const paymentsRes = await pool.query(
      `SELECT DISTINCT ON (order_id) *
       FROM payments
       WHERE order_id = ANY($1)
       ORDER BY order_id, created_at DESC`,
      [orderIds]
    )
    paymentsByOrder = paymentsRes.rows.reduce((acc, payment) => {
      acc[payment.order_id] = payment
      return acc
    }, {})
  }

  let itemsByOrder = {}
  if (include_items === 'true' || include_items === true) {
    if (orderIds.length > 0) {
      const itemsRes = await pool.query(
        `SELECT oi.*, pi.image_url FROM order_items oi
         LEFT JOIN product_images pi ON oi.product_id = pi.product_id AND pi.is_primary = true
         WHERE oi.order_id = ANY($1)`,
        [orderIds]
      )
      itemsByOrder = itemsRes.rows.reduce((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = []
        acc[item.order_id].push(item)
        return acc
      }, {})
    }
  }

  const orders = dataResult.rows.map((order) => {
    const payment = paymentsByOrder[order.order_id] || null
    return {
      ...order,
      items: itemsByOrder[order.order_id] || [],
      payment,
      payment_method: resolveOrderPaymentMethod(order, payment),
    }
  })

  return {
    orders,
    pagination: {
      page,
      page_size: limit,
      total,
      total_pages: Math.max(Math.ceil(total / limit), 1),
    },
  }
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
        const missingFields = STATUS_FIELD_REQUIREMENTS[status].filter(field =>
          !updateData[field] && !order[field]
        );
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields for status '${status}': ${missingFields.join(', ')}`);
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
    `SELECT
       o.payment_status,
       o.status,
       o.notes,
       (
         SELECT p.method::text
         FROM payments p
         WHERE p.order_id = o.order_id
         ORDER BY p.created_at DESC
         LIMIT 1
       ) AS payment_method
     FROM orders o
     WHERE o.order_id = $1`,
    [orderId]
  )
  
  if (orderRes.rows.length === 0) return null
  
  const currentStatus = orderRes.rows[0].payment_status
  const resolvedPaymentMethod = resolveOrderPaymentMethod(
    { notes: orderRes.rows[0].notes, payment_method: orderRes.rows[0].payment_method },
    null
  )

  if (resolvedPaymentMethod === 'cash') {
    throw createValidationError('COD orders do not support manual payment verification updates')
  }
  
  // Validate status transition
  if (!isValidPaymentStatusTransition(currentStatus, status)) {
    throw createValidationError(`Invalid payment status transition from '${currentStatus}' to '${status}'`)
  }

  // Build update query dynamically
  const updateFields = ['payment_status = $1', 'updated_at = CURRENT_TIMESTAMP']
  const updateValues = [status]
  let paramIndex = 2

  if (reference_number !== undefined) {
    updateFields.push(`payment_reference_number = $${paramIndex++}`)
    updateValues.push(reference_number)
  }

  if (status === 'approved' || status === 'rejected') {
    updateFields.push(`reviewed_by = $${paramIndex++}`)
    updateValues.push(admin_user_id || null)
    updateFields.push(`reviewed_at = CURRENT_TIMESTAMP`)
  }

  if (status !== 'rejected') {
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

  // Log to consolidated audit_logs table
  try {
    const auditService = require('./auditService');
    await auditService.logAction(
      admin_user_id,
      status === 'approved' ? 'VERIFY' : status === 'rejected' ? 'REJECT' : 'UPDATE',
      'payment',
      orderId,
      {
        previous_status: currentStatus,
        new_status: status,
        reference_number,
        rejection_reason,
        admin_notes,
        admin_name,
        admin_email
      }
    );
  } catch (auditErr) {
    console.warn('Audit log not available:', auditErr.message);
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
    throw createValidationError(`Cannot approve payment with current status: ${currentStatus}`)
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
  
  // Log to consolidated audit_logs table
  try {
    const auditService = require('./auditService');
    await auditService.logAction(
      admin_user_id || null,
      'VERIFY',
      'payment',
      orderId,
      {
        previous_status: currentStatus,
        new_status: 'approved',
        admin_name,
        admin_email
      }
    );
  } catch (auditErr) {
    console.warn('Audit log not available:', auditErr.message);
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

exports.cancelMyOrder = async (orderId, userId, reason) => {
  const checkRes = await pool.query(
    `SELECT status, notes FROM orders WHERE order_id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (checkRes.rows.length === 0) {
    throw new Error('Order not found');
  }
  const { status, notes } = checkRes.rows[0];
  if (status !== 'pending') {
    throw new Error('Only pending orders can be cancelled');
  }

  const cancellationStamp = new Date().toISOString()
  const cancellationNote = `Customer cancellation reason (${cancellationStamp}): ${reason}`
  const nextNotes = [notes, cancellationNote].filter(Boolean).join('\n')

  const res = await pool.query(
    `UPDATE orders
     SET status = 'cancelled',
         notes = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $1 AND user_id = $2
     RETURNING *`,
    [orderId, userId, nextNotes]
  );
  return res.rows[0];
}
