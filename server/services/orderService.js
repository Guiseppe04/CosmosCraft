const { pool } = require('../config/database')
const { generateOrderNumber, generateRefundRequestNumber, determineOrderTypePrefix } = require('../utils/orderNumber')
const projectRefundService = require('./projectRefundService')
const { calculateOrderTotals } = require('../utils/orderTotals')

const validateShippingFee = (value) => {
  if (value === null || value === undefined || !/^\d+(?:\.\d{1,2})?$/.test(String(value).trim()) ||
      !Number.isFinite(Number(value)) || Number(value) > 9999999999.99) {
    throw createValidationError('Enter a valid additional shipping fee (0 or more, with up to 2 decimal places) before shipping.');
  }
  return Number(value);
};

/**
 * Reads the customer for an order so an order event names a person, not just an
 * order number. One extra read per event, only when the caller did not already
 * have the customer loaded.
 */
const readOrderCustomer = async (orderId, knownUserId = null) => {
  const userId = knownUserId || null;
  if (!userId) return {};
  try {
    const { rows } = await pool.query(
      `SELECT TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS customer_name,
              email AS customer_email
       FROM users WHERE user_id = $1`,
      [userId]
    );
    return rows[0] || {};
  } catch (err) {
    console.warn('Could not resolve order customer:', err.message);
    return {};
  }
}

/**
 * Records an order status change in the audit trail.
 *
 * Order status transitions used to be invisible in the audit screen, so a
 * reviewer could see a payment verification with no explanation of why the order
 * itself moved forward. The order number, type and customer are captured here at
 * event time.
 */
const logOrderStatusEvent = async ({
  orderId,
  previousStatus,
  order,
  actorId = null,
  action = 'ORDER_STATUS_CHANGED',
  details = {},
  extraContext = {},
  client = null,
}) => {
  const auditService = require('./auditService');
  const customer = await readOrderCustomer(orderId, order?.user_id || extraContext.customerId || null);

  await auditService.logOrderEvent({
    userId: actorId,
    action,
    entityId: orderId,
    status: order?.status ?? null,
    previousStatus: previousStatus ?? null,
    details,
    context: {
      orderId,
      orderNumber: order?.order_number ?? extraContext.orderNumber ?? null,
      orderType: order?.order_type ?? extraContext.orderType ?? null,
      orderStatus: order?.status ?? null,
      previousStatus: previousStatus ?? null,
      paymentStatus: order?.payment_status ?? extraContext.paymentStatus ?? null,
      totalAmount: order?.total_amount ?? extraContext.totalAmount ?? null,
      customerName: customer.customer_name || extraContext.customerName || null,
      customerEmail: customer.customer_email || extraContext.customerEmail || null,
      ...extraContext,
    },
    executor: client,
  });
}

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

let ensureCustomizationBuildColumnsReady = false;
let ensureCustomizationBuildColumnsPromise = null;

const ensureCustomizationBuildColumns = async () => {
  if (ensureCustomizationBuildColumnsReady) return;
  if (!ensureCustomizationBuildColumnsPromise) {
    ensureCustomizationBuildColumnsPromise = pool.query(`
      ALTER TABLE customizations
      ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS stickers JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS preview_image TEXT
    `).then(() => {
      ensureCustomizationBuildColumnsReady = true;
    }).catch((error) => {
      ensureCustomizationBuildColumnsPromise = null;
      throw error;
    });
  }
  await ensureCustomizationBuildColumnsPromise;
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
  if (paymentMethod.includes('gcash')) return 'gcash'
  if (paymentMethod.includes('bank') || paymentMethod.includes('transfer')) return 'bank_transfer'
  if (paymentMethod.includes('cash') || paymentMethod.includes('cod')) return 'cash'
  return paymentMethod
}

const getAddressSignature = (address = {}) => ([
  address.line1 ?? address.streetLine1 ?? address.street,
  address.line2 ?? address.streetLine2 ?? address.street2,
  address.city,
  address.barangay ?? '',
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

const sanitizeStickersForStorage = async (stickers) => {
  if (!Array.isArray(stickers)) return [];
  const result = [];
  for (const item of stickers) {
    if (!item || typeof item !== 'object') continue;
    let src = item.src;
    if (typeof src === 'string' && src.startsWith('data:')) {
      try {
        const { uploadImage } = require('./cloudinaryService');
        src = await uploadImage(src, { folder: 'cosmoscraft_assets/stickers' });
      } catch (err) {
        console.warn('Failed to upload data-URI sticker to Cloudinary on backend:', err.message);
      }
    }
    result.push({
      ...item,
      src,
    });
  }
  return result;
};

const upsertCustomizationForOrder = async (client, userId, customization, fallbackPrice) => {
  const {
    name,
    config = {},
    stickers,
    preview_image,
    summary = {},
    baseBuildPrice,
    additionalParts = [],
  } = customization

  const requestedCustomizationId = getRequestedCustomizationId(customization)
  const totalPrice = Number(baseBuildPrice ?? fallbackPrice ?? 0)
  const guitarType = config.guitarType || (config.bassType ? 'bass' : 'electric')
  const bodyModel = String(config.body || config.bodyStyle || config.model || '').trim().toLowerCase() || null

  const resolvedStickers = Array.isArray(stickers) ? await sanitizeStickersForStorage(stickers) : null

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
           body_model = $3,
           body_wood = $4,
           neck_wood = $5,
           fingerboard_wood = $6,
           bridge_type = $7,
           pickups = $8,
           color = $9,
           finish_type = $10,
           config_json = COALESCE($11::jsonb, config_json),
           stickers = CASE WHEN $12::jsonb IS NOT NULL THEN $12::jsonb ELSE stickers END,
           preview_image = COALESCE($13, preview_image),
           total_price = $14,
           is_saved = $15,
           updated_at = now()
         WHERE customization_id = $16`,
        [
          name || 'Custom Build',
          guitarType,
          bodyModel,
          summary.bodyWood || config.bodyWood || null,
          summary.neck || config.neck || null,
          summary.fretboard || config.fretboard || null,
          summary.bridge || config.bridge || null,
          summary.pickups || config.pickups || null,
          summary.bodyFinish || config.bodyFinish || null,
          summary.bodyFinish || config.bodyFinish || null,
          JSON.stringify(config),
          resolvedStickers ? JSON.stringify(resolvedStickers) : null,
          preview_image || null,
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
       body_model,
       body_wood,
       neck_wood,
       fingerboard_wood,
       bridge_type,
       pickups,
       color,
       finish_type,
       config_json,
       stickers,
       preview_image,
       total_price,
       is_saved
     )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, COALESCE($13::jsonb, '[]'::jsonb), $14, $15, $16)
     RETURNING customization_id`,
    [
      userId,
      name || 'Custom Build',
      guitarType,
      bodyModel,
      summary.bodyWood || config.bodyWood || null,
      summary.neck || config.neck || null,
      summary.fretboard || config.fretboard || null,
      summary.bridge || config.bridge || null,
      summary.pickups || config.pickups || null,
      summary.bodyFinish || config.bodyFinish || null,
      summary.bodyFinish || config.bodyFinish || null,
      JSON.stringify(config),
      resolvedStickers ? JSON.stringify(resolvedStickers) : null,
      preview_image || null,
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
      `SELECT p.product_id, p.name, p.is_active, i.stock, i.low_stock_threshold, i.max_stock
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
      `SELECT stock, low_stock_threshold, max_stock
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
    const maxStock = Number(inventoryRes.rows[0].max_stock) || 0
    const lowStockLimit = maxStock > 0 ? maxStock * (lowStockThreshold / 100) : 0

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

    if (newStock <= lowStockLimit && newStock > 0) {
      await client.query(
        `INSERT INTO low_stock_alerts (product_id, current_stock, threshold)
         VALUES ($1, $2, $3)`,
        [productId, newStock, Math.round(lowStockLimit)]
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
  'shipped': ['out_for_delivery', 'received'],
  'out_for_delivery': ['delivered', 'received'],
  'delivered': ['received'],
  'received': [],
  'cancelled': []
}

const STATUS_FIELD_REQUIREMENTS = {
  'shipped': ['tracking_number'],
  'out_for_delivery': ['rider_name'],
  'delivered': ['tracking_number']
}

exports.createOrder = async (orderData) => {
  const { userId, notes, shippingMethod, paymentMethod, billingAddress, termsAccepted, paymentPlan, initialPaymentPercentage, installmentTenureMonths } = orderData
  
  // Ensure database columns exist
  await ensureOrderItemsColumns()
  await ensureInstallmentColumns()
  await ensureCustomizationBuildColumns()
  
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')

    let items = orderData.items || []
    const cartItemIds = orderData.cartItemIds
    if (Array.isArray(cartItemIds)) {
      const cartItemsResult = await client.query(
        `SELECT ci.cart_item_id, ci.product_id, ci.customization_id, ci.quantity,
                p.name AS product_name, p.price AS product_price, p.is_active AS product_is_active,
                cu.name AS customization_name, cu.total_price AS customization_price
         FROM carts cart
         JOIN cart_items ci ON ci.cart_id = cart.cart_id
         LEFT JOIN products p ON p.product_id = ci.product_id
         LEFT JOIN customizations cu ON cu.customization_id = ci.customization_id
         WHERE cart.user_id = $1
           AND ci.cart_item_id = ANY($2::bigint[])
           AND (ci.customization_id IS NULL OR cu.user_id = $1)
         FOR UPDATE OF ci`,
        [userId, cartItemIds]
      )

      if (cartItemsResult.rows.length !== cartItemIds.length) {
        throw createValidationError('One or more selected cart items are invalid.', 400)
      }

      items = cartItemsResult.rows.map((cartItem) => {
        if (cartItem.product_id && !cartItem.product_is_active) {
          throw createValidationError(`Product "${cartItem.product_name || 'Item'}" is no longer available`, 400)
        }

        return {
          productId: cartItem.product_id,
          customization_id: cartItem.customization_id,
          name: cartItem.product_name || cartItem.customization_name || 'Custom Build',
          quantity: Number(cartItem.quantity),
          price: Number(cartItem.product_id ? cartItem.product_price : cartItem.customization_price),
        }
      })
    }

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

    const providedShippingAddressId = orderData.shippingAddressId || billingAddress?.shippingAddressId || null
    let shippingAddressId = null

    // Calculate totals
    const { subtotal, shippingCost, taxAmount: tax, total } = calculateOrderTotals(items, shippingMethod)

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

    if (providedShippingAddressId) {
      const allowedAddress = await client.query(
        `SELECT address_id FROM addresses WHERE address_id = $1 AND user_id = $2`,
        [providedShippingAddressId, userId]
      )
      if (allowedAddress.rows.length === 0) {
        throw createValidationError('Selected shipping address is invalid or does not belong to the current user', 400)
      }
      shippingAddressId = providedShippingAddressId
    } else if (billingAddress?.street && billingAddress?.city) {
      const normalizedBillingProvince = billingAddress.province || billingAddress.stateProvince || null
      const normalizedBillingPostalCode = billingAddress.postalCode || billingAddress.postalZipCode || null
      const normalizedBillingStreet2 = billingAddress.street2 || billingAddress.streetLine2 || null

      // Reuse an existing saved address when the full normalized address matches.
      const existingAddr = await client.query(
        `SELECT address_id, line1, line2, city, barangay, province, postal_code, country
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
        const normalizedBillingBarangay = billingAddress.barangay || null
        const addressRes = await client.query(
          `INSERT INTO addresses (user_id, label, line1, line2, city, barangay, province, postal_code, country)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING address_id`,
          [
            userId,
            'Shipping Address',
            billingAddress.street,
            normalizedBillingStreet2,
            billingAddress.city,
            normalizedBillingBarangay,
            normalizedBillingProvince,
            normalizedBillingPostalCode,
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
      let customizationId = item.customization_id || null

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

  const refundRes = await pool.query(
    `SELECT DISTINCT ON (order_id)
       order_id,
       refund_request_id,
       status,
       created_at,
       refunded_amount,
       approved_amount,
       refund_reference,
       refund_method,
       rejection_reason,
       admin_notes,
       (to_jsonb(refund_requests)->>'workflow_version')::int AS workflow_version,
       to_jsonb(refund_requests)->>'preferred_method' AS preferred_method,
       to_jsonb(refund_requests)->>'refund_sent_at' AS refund_sent_at,
       to_jsonb(refund_requests)->>'completed_at' AS completed_at,
       refund_type,
       request_number
     FROM refund_requests
     WHERE order_id = ANY($1) AND deleted_at IS NULL
     ORDER BY order_id, created_at DESC`,
    [orderIds]
  )
  const refundByOrder = refundRes.rows.reduce((acc, row) => {
    acc[row.order_id] = row
    return acc
  }, {})

  const reviewsRes = await pool.query(
    `SELECT * FROM product_reviews WHERE order_id = ANY($1) AND deleted_at IS NULL`,
    [orderIds]
  )
  const reviewsByItemId = reviewsRes.rows.reduce((acc, rev) => {
    acc[rev.order_item_id] = rev
    return acc
  }, {})

  const feedbackRes = await pool.query(
    `SELECT * FROM customization_feedback WHERE order_id = ANY($1) AND deleted_at IS NULL`,
    [orderIds]
  )
  const feedbackByOrder = feedbackRes.rows.reduce((acc, fb) => {
    acc[fb.order_id] = fb
    return acc
  }, {})

  const projectsRes = await pool.query(
    `SELECT project_id, order_id, title, status, fulfillment_status FROM projects WHERE order_id = ANY($1) AND deleted_at IS NULL`,
    [orderIds]
  )
  const projectByOrder = projectsRes.rows.reduce((acc, proj) => {
    acc[proj.order_id] = proj
    return acc
  }, {})

  return res.rows.map((order) => {
    const rawItems = itemsByOrder[order.order_id] || []
    const items = rawItems.map(item => ({
      ...item,
      review: reviewsByItemId[item.order_item_id] || null,
    }))
    const payment = paymentsByOrder[order.order_id] || null
    const refund = refundByOrder[order.order_id] || null
    const customization_feedback = feedbackByOrder[order.order_id] || null
    const project = projectByOrder[order.order_id] || null

    return {
      ...order,
      status: project?.status === 'cancelled' ? 'cancelled' : order.status,
      items,
      payment,
      project,
      customization_feedback,
      payment_method: resolveOrderPaymentMethod(order, payment),
      customization_ids: items
        .map((item) => item.customization_id)
        .filter(Boolean),
      has_refund_request: Boolean(refund),
      refund_request_id: refund?.refund_request_id || null,
      refund_request_status: refund?.status || null,
      refund_requested_at: refund?.created_at || null,
      refund_refunded_amount: refund?.refunded_amount || null,
      refund_approved_amount: refund?.approved_amount || null,
      refund_reference: refund?.refund_reference || null,
      refund_method: refund?.refund_method || null,
      refund_rejection_reason: refund?.rejection_reason || null,
      refund_admin_notes: refund?.admin_notes || null,
      refund_workflow_version: refund?.workflow_version || 1,
      refund_preferred_method: refund?.preferred_method || null,
      refund_sent_at: refund?.refund_sent_at || null,
      refund_completed_at: refund?.completed_at || null,
      refund_type: refund?.refund_type || null,
      refund_request_number: refund?.request_number || null,
    }
  })
}

exports.getOrderById = async (orderId, userId = null) => {
  const queryParams = [orderId]
  let whereClause = 'WHERE o.order_id = $1'
  if (userId) {
    queryParams.push(userId)
    whereClause += ' AND o.user_id = $2'
  }

  const res = await pool.query(
    `SELECT o.*, 
      a.line1 as shipping_line1, a.line2 as shipping_line2, a.city as shipping_city, 
      a.province as shipping_province, a.postal_code as shipping_postal_code, a.country as shipping_country,
      u.first_name, u.middle_name, u.last_name, u.email, u.phone as contact_phone
      FROM orders o
      LEFT JOIN addresses a ON o.shipping_address_id = a.address_id
      LEFT JOIN users u ON o.user_id = u.user_id
      ${whereClause}`,
    queryParams
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

  // Get payment information (latest payment for this order)
  const paymentRes = await pool.query(
    `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  )

  // Get the most recent refund request for this order (live status)
  const refundRes = await pool.query(
    `SELECT refund_request_id, status, created_at, rejection_reason, admin_notes,
      (to_jsonb(refund_requests)->>'workflow_version')::int AS workflow_version,
      to_jsonb(refund_requests)->>'preferred_method' AS preferred_method,
      to_jsonb(refund_requests)->>'refund_sent_at' AS refund_sent_at,
      to_jsonb(refund_requests)->>'completed_at' AS completed_at, refunded_amount, approved_amount, refund_reference
     FROM refund_requests
     WHERE order_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderId]
  )
  const refund = refundRes.rows[0] || null

  const order = res.rows[0]
  order.items = itemsRes.rows
  order.payment = paymentRes.rows[0] || null
  order.payment_method = resolveOrderPaymentMethod(order, order.payment)
  order.has_refund_request = Boolean(refund)
  order.refund_request_id = refund?.refund_request_id || null
  order.refund_request_status = refund?.status || null
  order.refund_requested_at = refund?.created_at || null
  order.refund_rejection_reason = refund?.rejection_reason || null
  order.refund_admin_notes = refund?.admin_notes || null
  order.refund_workflow_version = refund?.workflow_version || 1
  order.refund_preferred_method = refund?.preferred_method || null
  order.refund_sent_at = refund?.refund_sent_at || null
  order.refund_completed_at = refund?.completed_at || null
  order.refund_refunded_amount = refund?.refunded_amount || null
  order.refund_approved_amount = refund?.approved_amount || null
  order.refund_reference = refund?.refund_reference || null

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
  const allowedSortColumns = ['created_at', 'order_number', 'total_amount', 'status', 'payment_status', 'customer_name', 'order_type', 'customization_name']
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
    // `for_verification` is a grouped filter ("awaiting payment verification")
    // used when the Dashboard opens Orders from an attention item: it matches
    // orders whose proof was submitted and/or is under review.
    if (payment_status === 'for_verification') {
      where.push(`o.payment_status IN ($${idx++}, $${idx++})`)
      queryParams.push('proof_submitted', 'under_review')
    } else {
      where.push(`o.payment_status = $${idx++}`)
      queryParams.push(payment_status)
    }
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
      `o.tracking_number ILIKE $${idx++}`,
      `o.rider_name ILIKE $${idx++}`,
    ]
    where.push(`(${searchFilters.join(' OR ')})`)
    for (let i = 0; i < searchFilters.length; i++) {
      queryParams.push(term)
    }
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const totalQuery = `
    SELECT COUNT(DISTINCT o.order_id)::int AS total
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN customizations c ON c.customization_id = oi.customization_id
    LEFT JOIN payments p ON p.order_id = o.order_id
    ${whereClause}
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
            : orderBy === 'order_type'
              ? `o.order_type ${orderDir}`
              : orderBy === 'customization_name'
                ? `c.name ${orderDir}`
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
      u.middle_name,
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

  let projectsByOrder = {}
  if (orderIds.length > 0) {
    const projectsRes = await pool.query(
      `SELECT DISTINCT ON (order_id) *
       FROM projects
       WHERE order_id = ANY($1) AND deleted_at IS NULL
       ORDER BY order_id, created_at DESC`,
      [orderIds]
    )
    projectsByOrder = projectsRes.rows.reduce((acc, project) => {
      acc[project.order_id] = project
      return acc
    }, {})
  }

  const orders = dataResult.rows.map((order) => {
    const payment = paymentsByOrder[order.order_id] || null
    const project = projectsByOrder[order.order_id] || null
    return {
      ...order,
      project_id: project?.project_id || order.project_id || null,
      project_progress: project ? Number(project.progress || 0) : Number(order.project_progress || 0),
      project_fulfillment_status: project?.fulfillment_status || order.project_fulfillment_status || null,
      project: project || null,
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
  if (updateData.rider_contact) {
    const normalized = require('../utils/riderContact').normalizeRiderContact(updateData.rider_contact);
    if (!normalized) throw createValidationError('Please enter a valid mobile number.');
    updateData = { ...updateData, rider_contact: normalized };
  }
  const { status, payment_status, notes, tracking_number, courier_name, shipped_at, out_for_delivery_at, delivered_at, received_at, rider_name, rider_contact } = updateData;
  
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
    
    if (status === currentStatus) {
      throw createValidationError(`Order is already ${currentStatus.replace(/_/g, ' ')}. Please select a valid next status.`);
    }
    // Keep the existing workflow and required-field rules for next statuses.
    if (status !== currentStatus) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      
      if (!allowedTransitions.includes(status)) {
        throw createValidationError(`Invalid status transition from '${currentStatus}' to '${status}'`);
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
  
  if (status === 'shipped' || updateData.additional_shipping_fee !== undefined) {
    updateData = { ...updateData, additional_shipping_fee: validateShippingFee(updateData.additional_shipping_fee) };
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
  if (status === 'received') {
    updateData.received_at = updateData.received_at || new Date();
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
         received_at = COALESCE($9, received_at),
         rider_name = COALESCE($10, rider_name),
         rider_contact = COALESCE($11, rider_contact),
         additional_shipping_fee = COALESCE($13, additional_shipping_fee),
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $12 RETURNING *`,
    [status, payment_status, notes, tracking_number, courier_name, updateData.shipped_at, updateData.out_for_delivery_at, updateData.delivered_at, updateData.received_at, rider_name, rider_contact, orderId, updateData.additional_shipping_fee]
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

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get current order to check status transition.
    // Everything the audit trail needs (order number, customer, amount,
    // payment method/reference) is read here so the log is written from real
    // values instead of a second round trip at log time.
    const orderRes = await client.query(
      `SELECT
         o.payment_status,
         o.status,
         o.notes,
         o.order_number,
         o.order_type,
         o.total_amount,
         COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
         c.email AS customer_email,
         latest.payment_id,
         latest.amount AS payment_amount,
         latest.method::text AS latest_payment_method,
         latest.reference_number AS payment_reference_number,
         COALESCE(latest.method::text, (
           SELECT p2.method::text
           FROM payments p2
           WHERE p2.order_id = o.order_id
           ORDER BY p2.created_at DESC
           LIMIT 1
         )) AS payment_method
       FROM orders o
       LEFT JOIN users c ON c.user_id = o.user_id
       LEFT JOIN LATERAL (
         SELECT p.payment_id, p.amount, p.method, p.reference_number
         FROM payments p
         WHERE p.order_id = o.order_id AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE o.order_id = $1`,
      [orderId]
    )
    
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }
    
    const auditSource = orderRes.rows[0]
    const currentStatus = auditSource.payment_status
    const resolvedPaymentMethod = resolveOrderPaymentMethod(
      { notes: orderRes.rows[0].notes, payment_method: orderRes.rows[0].payment_method },
      null
    )

    if (resolvedPaymentMethod === 'cash') {
      await client.query('ROLLBACK')
      throw createValidationError('COD orders do not support manual payment verification updates')
    }
    
    // Validate status transition
    if (!isValidPaymentStatusTransition(currentStatus, status)) {
      await client.query('ROLLBACK')
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

    // A successful payment advances the order into 'processing'.
    // 'failed' / 'rejected' must never move the order forward.
    if (status === 'approved' && orderRes.rows[0].status === 'pending') {
      updateFields.push(`status = 'processing'`)
    }

    updateValues.push(orderId)

    const res = await client.query(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE order_id = $${paramIndex} RETURNING *`,
      updateValues
    )

    let order = res.rows[0]

    // Sync the latest payment record to match the new order payment status
    const paymentStatusMap = {
      'approved': 'verified',
      'rejected': 'rejected',
      'pending': 'pending',
      'proof_submitted': 'for_verification',
      'under_review': 'for_verification',
      'failed': 'cancelled',
    }
    const newPaymentStatus = paymentStatusMap[status] || status

    // Already read by the order query above (latest payment row)
    const latestPaymentId = orderRes.rows[0].payment_id || null

    if (latestPaymentId) {
      const paymentUpdateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP']
      const paymentUpdateValues = [newPaymentStatus]
      let paymentParamIndex = 2

      if (newPaymentStatus === 'verified') {
        paymentUpdateFields.push(`verified_by = $${paymentParamIndex++}`)
        paymentUpdateValues.push(admin_user_id || null)
        paymentUpdateFields.push(`verified_at = CURRENT_TIMESTAMP`)
      }

      if (newPaymentStatus === 'rejected' && rejection_reason) {
        paymentUpdateFields.push(`rejection_reason = $${paymentParamIndex++}`)
        paymentUpdateValues.push(rejection_reason)
      }

      paymentUpdateFields.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${paymentParamIndex++}`)
      paymentUpdateValues.push(JSON.stringify({ admin_notes: admin_notes || null, reference_number: reference_number || null }))

      paymentUpdateValues.push(latestPaymentId)

      await client.query(
        `UPDATE payments SET ${paymentUpdateFields.join(', ')} WHERE payment_id = $${paymentParamIndex}`,
        paymentUpdateValues
      )

      // Existing databases have a payment trigger that maps for_verification
      // back to proof_submitted (and cancelled to pending). Preserve the more
      // specific admin status after that trigger runs, within this transaction.
      const finalOrderRes = await client.query(
        `UPDATE orders SET payment_status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2 RETURNING *`,
        [status, orderId]
      )
      order = finalOrderRes.rows[0]
    }

    // Auto-transition any pending_payment_verification refunds for this order
    if (status === 'approved' || status === 'rejected') {
      await projectRefundService.transitionRefundStatusesForPayment(client, orderId, status === 'approved' ? 'verified' : 'rejected')
    }

    await client.query('COMMIT')

    // Log to consolidated audit_logs table
    try {
      const auditService = require('./auditService');
      await auditService.logPaymentEvent({
        userId: admin_user_id,
        action: status === 'approved' ? 'VERIFY' : status === 'rejected' ? 'REJECT' : 'UPDATE',
        entityId: latestPaymentId || orderId,
        status,
        previousStatus: currentStatus,
        details: {
          reference_number,
          rejection_reason,
          admin_notes,
          admin_name,
          admin_email,
        },
        context: {
          paymentId: latestPaymentId,
          amount: auditSource.payment_amount ?? auditSource.total_amount,
          method: resolvedPaymentMethod || auditSource.latest_payment_method,
          referenceNumber: reference_number || auditSource.payment_reference_number,
          rejectionReason: rejection_reason,
          paymentStatus: newPaymentStatus,
          orderId,
          orderNumber: auditSource.order_number,
          orderType: auditSource.order_type,
          customerName: auditSource.customer_name,
          customerEmail: auditSource.customer_email,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log not available:', auditErr.message);
    }

    // An approved payment can also advance the order itself from pending to
    // processing. That transition is its own event, otherwise the order looks
    // like it changed status without explanation.
    if (order.status !== auditSource.status) {
      try {
        const auditService = require('./auditService');
        await auditService.logOrderEvent({
          userId: admin_user_id || null,
          action: 'ORDER_STATUS_CHANGED',
          entityId: orderId,
          status: order.status,
          previousStatus: auditSource.status,
          details: {
            triggered_by: `payment_${status}`,
            payment_status: status,
            admin_notes: admin_notes || null,
          },
          context: {
            orderId,
            orderNumber: auditSource.order_number,
            orderType: auditSource.order_type,
            orderStatus: order.status,
            previousStatus: auditSource.status,
            paymentStatus: order.payment_status,
            totalAmount: order.total_amount,
            customerName: auditSource.customer_name,
            customerEmail: auditSource.customer_email,
          },
        });
      } catch (auditErr) {
        console.warn('Audit log not available:', auditErr.message);
      }
    }

    return order
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

exports.approvePayment = async (orderId, options = {}) => {
  const { admin_name, admin_email, admin_user_id } = options

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get current status first, together with everything the audit trail needs
    const currentRes = await client.query(
      `SELECT o.payment_status, o.status, o.order_number, o.order_type, o.total_amount,
              COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
              c.email AS customer_email,
              latest.payment_id, latest.amount AS payment_amount,
              latest.method::text AS latest_payment_method,
              latest.reference_number AS payment_reference_number
       FROM orders o
       LEFT JOIN users c ON c.user_id = o.user_id
       LEFT JOIN LATERAL (
         SELECT p.payment_id, p.amount, p.method, p.reference_number
         FROM payments p
         WHERE p.order_id = o.order_id AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE o.order_id = $1`,
      [orderId]
    )
    
    if (currentRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }
    
    const currentStatus = currentRes.rows[0].payment_status
    
    // Validate transition to approved
    if (!isValidPaymentStatusTransition(currentStatus, 'approved')) {
      await client.query('ROLLBACK')
      throw createValidationError(`Cannot approve payment with current status: ${currentStatus}`)
    }

    // A successful payment advances the order into 'processing'.
    const nextOrderStatus =
      currentRes.rows[0].status === 'pending' ? 'processing' : currentRes.rows[0].status
    
    const res = await client.query(
      `UPDATE orders SET 
        payment_status = 'approved', 
        status = $3,
        reviewed_by = $1, 
        reviewed_at = CURRENT_TIMESTAMP,
        rejection_reason = NULL,
        updated_at = CURRENT_TIMESTAMP 
      WHERE order_id = $2 RETURNING *`,
      [admin_user_id || null, orderId, nextOrderStatus]
    )
    
    const order = res.rows[0]

    // Sync the latest payment record to verified
    const latestPaymentId = currentRes.rows[0].payment_id || null

    if (latestPaymentId) {
      await client.query(
        `UPDATE payments SET
          status = 'verified',
          verified_by = $1,
          verified_at = CURRENT_TIMESTAMP,
          metadata = COALESCE(metadata, '{}'::jsonb) || $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE payment_id = $3`,
        [admin_user_id || null, JSON.stringify({ admin_notes: null, reference_number: null }), latestPaymentId]
      )
    }

    // Auto-transition any pending_payment_verification refunds for this order
    await projectRefundService.transitionRefundStatusesForPayment(client, orderId, 'verified')

    await client.query('COMMIT')

    // Log to consolidated audit_logs table
    try {
      const auditService = require('./auditService');
      const auditSource = currentRes.rows[0];
      await auditService.logPaymentEvent({
        userId: admin_user_id || null,
        action: 'VERIFY',
        entityId: latestPaymentId || orderId,
        status: 'approved',
        previousStatus: currentStatus,
        details: { admin_name, admin_email },
        context: {
          paymentId: latestPaymentId,
          amount: auditSource.payment_amount ?? auditSource.total_amount,
          method: auditSource.latest_payment_method,
          referenceNumber: auditSource.payment_reference_number,
          paymentStatus: 'verified',
          orderId,
          orderNumber: auditSource.order_number,
          orderType: auditSource.order_type,
          customerName: auditSource.customer_name,
          customerEmail: auditSource.customer_email,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log not available:', auditErr.message);
    }
    
    return order
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

exports.updateShipment = async (orderId, shipmentData, actorId = null) => {
  const { tracking_number, courier_name, rider_name, rider_contact } = shipmentData;
  const additionalShippingFee = validateShippingFee(shipmentData.additional_shipping_fee);
  
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
         additional_shipping_fee = $6,
         shipped_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $5 RETURNING *`,
    [tracking_number, courier_name, rider_name || null, rider_contact || null, orderId, additionalShippingFee]
  );

  await logOrderStatusEvent({
    orderId,
    previousStatus: order.status,
    order: res.rows[0],
    actorId,
    action: 'ORDER_SHIPPED',
    details: {
      tracking_number,
      courier_name,
      additional_shipping_fee: additionalShippingFee,
      rider_name: rider_name || null,
    },
    extraContext: { courierName: courier_name, trackingNumber: tracking_number },
  });

  return res.rows[0];
}

exports.updateOutForDelivery = async (orderId, riderData, actorId = null) => {
  const { rider_name } = riderData;
  const rider_contact = require('../utils/riderContact').normalizeRiderContact(riderData.rider_contact);
  if (!rider_contact) throw createValidationError('Please enter a valid mobile number.');
  
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

  await logOrderStatusEvent({
    orderId,
    previousStatus: order.status,
    order: res.rows[0],
    actorId,
    action: 'ORDER_OUT_FOR_DELIVERY',
    details: { rider_name, out_for_delivery_at: res.rows[0].out_for_delivery_at },
  });

  return res.rows[0];
}

exports.markDelivered = async (orderId, actorId = null) => {
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

  await logOrderStatusEvent({
    orderId,
    previousStatus: order.status,
    order: res.rows[0],
    actorId,
    action: 'ORDER_MARKED_DELIVERED',
    details: { delivered_at: res.rows[0].delivered_at },
  });

  return res.rows[0];
}

exports.cancelOrder = async (orderId, actorId = null) => {
  const currentRes = await pool.query(
    `SELECT status, order_number, order_type, total_amount, user_id FROM orders WHERE order_id = $1`,
    [orderId]
  );
  if (currentRes.rows.length === 0) return null;
  const current = currentRes.rows[0];

  const res = await pool.query(
    `UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *`,
    [orderId]
  );
  if (res.rows.length === 0) return null;

  await logOrderStatusEvent({
    orderId,
    previousStatus: current.status,
    order: res.rows[0],
    actorId,
    action: 'ORDER_CANCELLED',
    extraContext: { customerId: current.user_id },
  });

  return res.rows[0];
}

const refundService = require('./refundService');

exports.cancelMyOrder = async (orderId, userId, reason) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const checkRes = await client.query(
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

    // Get the latest payment for this order
    const paymentRes = await client.query(
      `SELECT payment_id, amount, status FROM payments
       WHERE order_id = $1 AND status NOT IN ('rejected', 'cancelled', 'refunded')
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId]
    );
    const latestPayment = paymentRes.rows[0] || null;

    const cancellationStamp = new Date().toISOString()
    const cancellationNote = `Customer cancellation reason (${cancellationStamp}): ${reason}`
    const nextNotes = [notes, cancellationNote].filter(Boolean).join('\n')

    const res = await client.query(
      `UPDATE orders
       SET status = 'cancelled',
           notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1 AND user_id = $2
       RETURNING *`,
      [orderId, userId, nextNotes]
    );

    // Create refund request based on payment status
    if (latestPayment) {
      const existingRefundRes = await client.query(
        `SELECT refund_request_id, status FROM refund_requests
         WHERE order_id = $1
           AND status IN ('pending', 'approved', 'pending_payment_verification')
           AND deleted_at IS NULL
         LIMIT 1`,
        [orderId]
      );

      if (existingRefundRes.rows.length === 0) {
        let refundStatus = 'pending';
        let amountRequested = Number(latestPayment.amount);

        if (latestPayment.status === 'verified') {
          refundStatus = 'pending';
        } else if (['pending', 'for_verification'].includes(latestPayment.status)) {
          refundStatus = 'pending_payment_verification';
        } else {
          amountRequested = 0;
          refundStatus = null;
        }

        if (refundStatus && amountRequested > 0) {
          const requestNumber = await generateRefundRequestNumber(client, 'RF');

          await client.query(
            `INSERT INTO refund_requests (
               order_id, user_id, payment_id, reason, customer_notes,
               amount_requested, status, request_number, refund_type
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'money_refund')`,
            [
              orderId,
              userId,
              latestPayment.payment_id,
              'Automatic refund request from order cancellation',
              reason,
              amountRequested,
              refundStatus,
              requestNumber,
            ]
          );

          await client.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              userId,
              'refund_requested',
              'order',
              orderId,
              JSON.stringify({
                refund_request_reason: 'Automatic refund request from order cancellation',
                amount_requested: amountRequested,
                refund_status: refundStatus,
                payment_status_at_cancel: latestPayment.status,
              }),
            ]
          );
        }
      }
    }

    // Recorded inside the transaction so the cancellation and its audit entry can
    // never disagree.
    await logOrderStatusEvent({
      orderId,
      previousStatus: status,
      order: res.rows[0],
      actorId: userId,
      action: 'ORDER_CANCELLED',
      details: {
        reason,
        cancelled_by: 'customer',
        refund_request_created: Boolean(latestPayment),
      },
      client,
    });

    await client.query('COMMIT');

    return res.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

exports.markAsReceived = async (orderId, userId) => {
  const checkRes = await pool.query(
    `SELECT status FROM orders WHERE order_id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (checkRes.rows.length === 0) {
    throw new Error('Order not found');
  }
  const order = checkRes.rows[0];
  const allowedStatuses = ['shipped', 'out_for_delivery', 'delivered', 'received'];
  if (!allowedStatuses.includes(order.status)) {
    throw new Error(`Order must be shipped, out for delivery, or delivered before marking as received. Current status: ${order.status}`);
  }
  if (order.status === 'received') {
    return checkRes.rows[0];
  }
  const res = await pool.query(
    `UPDATE orders SET status = 'received', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *`,
    [orderId]
  );

  await logOrderStatusEvent({
    orderId,
    previousStatus: order.status,
    order: res.rows[0],
    actorId: userId,
    action: 'ORDER_MARKED_RECEIVED',
    details: { received_at: res.rows[0].received_at },
  });

  return res.rows[0];
}

exports.createRefundRequest = async (data) => {
  const { orderId, userId, reason, customerNotes, items, images } = data;
  const workflow = require('./orderRefundWorkflow');
  const destination = workflow.validateDestination(data.destination);
  await workflow.ensureReady();
  if (!Array.isArray(items) || new Set(items.map(item => item.order_item_id)).size !== items.length) throw new Error('Duplicate refund items are not allowed');

  const orderRes = await pool.query(
    `SELECT status, delivered_at, received_at, notes FROM orders WHERE order_id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (orderRes.rows.length === 0) {
    throw new Error('Order not found');
  }
  const order = orderRes.rows[0];
  const cancelledByCustomer = order.status === 'cancelled' && /Customer cancellation reason \(/.test(order.notes || '');
  let cancellationPayment = null;
  if (cancelledByCustomer) {
    cancellationPayment = (await pool.query(`SELECT COALESCE(SUM(amount),0) AS submitted,
      COALESCE(SUM(amount) FILTER (WHERE status='verified'),0) AS verified
      FROM payments WHERE order_id=$1 AND status IN ('pending','for_verification','verified')`, [orderId])).rows[0];
    if (Number(cancellationPayment.submitted) <= 0) throw new Error('No submitted payment is available to refund');
  }
  const eligibleStatuses = ['delivered', 'received'];
  if (!eligibleStatuses.includes(order.status) && !cancelledByCustomer) {
    throw new Error(`Refund requests are only allowed for delivered or received orders. Current status: ${order.status}`);
  }

  const deliveryDate = order.received_at || order.delivered_at;
  if (deliveryDate) {
    const daysSinceDelivery = (Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 30) {
      throw new Error('Refund requests can only be made within 30 days of delivery');
    }
  }

  const existingRes = await pool.query(
    `SELECT * FROM refund_requests WHERE order_id = $1 AND status NOT IN ('rejected', 'refunded', 'completed', 'withdrawn') AND deleted_at IS NULL LIMIT 1`,
    [orderId]
  );
  const automaticRefund = existingRes.rows[0];
  const completeAutomatic = cancelledByCustomer && automaticRefund && automaticRefund.workflow_version !== 2 &&
    automaticRefund.reason === 'Automatic refund request from order cancellation' &&
    ['pending', 'pending_payment_verification', 'approved', 'processing'].includes(automaticRefund.status);
  if (existingRes.rows.length > 0 && !completeAutomatic) {
    throw new Error('A refund request already exists for this order');
  }

  if (!items || items.length === 0) {
    throw new Error('At least one item must be selected for refund');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let refundRequest;
    if (completeAutomatic) {
      refundRequest = (await client.query(`UPDATE refund_requests SET reason=$2, customer_notes=$3
        WHERE refund_request_id=$1 AND workflow_version<>2 AND status IN ('pending','pending_payment_verification','approved','processing') RETURNING *`, [automaticRefund.refund_request_id, reason, customerNotes || null])).rows[0];
      if (!refundRequest) throw new Error('This refund request has already been submitted or reviewed');
    } else {
      const requestNumber = await generateRefundRequestNumber(client, 'RF');
      refundRequest = (await client.query(
        `INSERT INTO refund_requests (order_id, user_id, reason, customer_notes, request_number) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [orderId, userId, reason, customerNotes || null, requestNumber]
      )).rows[0];
    }

    for (const item of items) {
      if (!item.order_item_id) {
        throw new Error('Invalid item selected for refund');
      }
      const itemRes = await client.query(
        `SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.product_id WHERE oi.order_item_id = $1 AND oi.order_id = $2`,
        [item.order_item_id, orderId]
      );
      if (itemRes.rows.length === 0) {
        throw new Error('Order item not found');
      }
      const orderItem = itemRes.rows[0];
      const refundQty = Number(item.quantity);
      if (!Number.isInteger(refundQty) || refundQty < 1 || refundQty > Number(orderItem.quantity)) throw new Error('Invalid refund quantity');
      const unitPrice = Number(orderItem.unit_price || 0);
      const refundAmount = unitPrice * refundQty;

      await client.query(
        `INSERT INTO refund_request_items (refund_request_id, order_item_id, product_id, product_name, quantity, unit_price, refund_amount) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [refundRequest.refund_request_id, item.order_item_id, orderItem.product_id, orderItem.product_name || 'Product', refundQty, unitPrice, refundAmount]
      );
    }

    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await client.query(
          `INSERT INTO refund_request_images (refund_request_id, image_url, sort_order) VALUES ($1, $2, $3)`,
          [refundRequest.refund_request_id, images[i], i]
        );
      }
    }

    const attachedRequest = await workflow.attachRequest(client, refundRequest, destination, userId,
      cancellationPayment ? { cancellationAmount: Number(cancellationPayment.submitted), awaitingVerification: Number(cancellationPayment.verified) < Number(cancellationPayment.submitted) } : {});
    await client.query('COMMIT');
    return attachedRequest;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

exports.getRefundRequests = async (params = {}) => {
  const {
    status,
    orderId,
    userId,
    search,
    sort_by = 'created_at',
    sort_dir = 'desc',
    page = 1,
    page_size = 10,
  } = params;

  const limit = Math.min(Math.max(Number(page_size) || 10, 1), 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const allowedSortColumns = ['created_at', 'status', 'reason', 'refund_request_id', 'request_number'];
  const orderBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const orderDir = sort_dir === 'asc' ? 'ASC' : 'DESC';

  const where = [];
  const queryParams = [];
  let idx = 1;

  if (status) {
    where.push(`rr.status = $${idx++}`);
    queryParams.push(status);
  }
  if (orderId) {
    where.push(`rr.order_id = $${idx++}`);
    queryParams.push(orderId);
  }
  if (userId) {
    where.push(`rr.user_id = $${idx++}`);
    queryParams.push(userId);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')} AND rr.deleted_at IS NULL` : 'WHERE rr.deleted_at IS NULL';

  let searchClause = '';
  if (search && String(search).trim()) {
    const term = `%${String(search).trim().toLowerCase()}%`;
    searchClause = `AND (rr.reason ILIKE $${idx++} OR rr.request_number ILIKE $${idx++} OR o.order_number ILIKE $${idx++} OR u.first_name ILIKE $${idx++} OR u.last_name ILIKE $${idx++})`;
    for (let i = 0; i < 5; i++) {
      queryParams.push(term);
    }
  }

  const totalQuery = `
    SELECT COUNT(*)::int AS total
    FROM refund_requests rr
    LEFT JOIN orders o ON rr.order_id = o.order_id
    LEFT JOIN users u ON rr.user_id = u.user_id
    ${whereClause}
    ${searchClause}
  `;
  const totalResult = await pool.query(totalQuery, queryParams);
  const total = totalResult.rows[0]?.total || 0;

  const dataQuery = `
    SELECT rr.*, o.order_number, o.payment_status, o.payment_status as order_payment_status, o.total_amount as order_total_amount, o.status as order_status, u.first_name, u.last_name, u.email as customer_email
    FROM refund_requests rr
    LEFT JOIN orders o ON rr.order_id = o.order_id
    LEFT JOIN users u ON rr.user_id = u.user_id
    ${whereClause}
    ${searchClause}
    ORDER BY ${orderBy} ${orderDir}
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  const dataResult = await pool.query(dataQuery, [...queryParams, limit, offset]);

  const refundRequestIds = dataResult.rows.map(r => r.refund_request_id);
  let itemsByRequest = {};
  let imagesByRequest = {};

  if (refundRequestIds.length > 0) {
    const itemsRes = await pool.query(
      `SELECT * FROM refund_request_items WHERE refund_request_id = ANY($1) AND deleted_at IS NULL`,
      [refundRequestIds]
    );
    itemsByRequest = itemsRes.rows.reduce((acc, item) => {
      if (!acc[item.refund_request_id]) acc[item.refund_request_id] = [];
      acc[item.refund_request_id].push(item);
      return acc;
    }, {});

    const imagesRes = await pool.query(
      `SELECT * FROM refund_request_images WHERE refund_request_id = ANY($1) AND deleted_at IS NULL ORDER BY sort_order`,
      [refundRequestIds]
    );
    imagesByRequest = imagesRes.rows.reduce((acc, img) => {
      if (!acc[img.refund_request_id]) acc[img.refund_request_id] = [];
      acc[img.refund_request_id].push(img);
      return acc;
    }, {});
  }

  const requests = dataResult.rows.map(req => ({
    ...req,
    items: itemsByRequest[req.refund_request_id] || [],
    images: imagesByRequest[req.refund_request_id] || [],
  }));

  return {
    requests,
    pagination: {
      page,
      page_size: limit,
      total,
      total_pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

exports.getRefundRequestById = async (refundRequestId, includeSensitive = false) => {
  const res = await pool.query(
    `SELECT rr.*, o.order_number, o.payment_status, o.payment_status as order_payment_status, o.total_amount as order_total_amount, o.status as order_status, u.first_name, u.last_name, u.email as customer_email
     FROM refund_requests rr
     LEFT JOIN orders o ON rr.order_id = o.order_id
     LEFT JOIN users u ON rr.user_id = u.user_id
     WHERE rr.refund_request_id = $1 AND rr.deleted_at IS NULL`,
    [refundRequestId]
  );
  if (res.rows.length === 0) return null;

  const request = res.rows[0];
  if (includeSensitive && request.workflow_version === 2) {
    const destinationRes = await pool.query('SELECT payment_destination FROM refund_private_destinations WHERE refund_request_id=$1', [refundRequestId]);
    request.payment_destination = destinationRes.rows[0]?.payment_destination || null;
  }
  const filesRes = request.workflow_version === 2
    ? await pool.query('SELECT kind FROM refund_private_files WHERE refund_request_id=$1', [refundRequestId])
    : { rows: [] };
  request.has_qr = filesRes.rows.some(file => file.kind === 'qr');
  request.has_proof = filesRes.rows.some(file => file.kind === 'proof');
  const itemsRes = await pool.query(
    `SELECT * FROM refund_request_items WHERE refund_request_id = $1 AND deleted_at IS NULL`,
    [refundRequestId]
  );
  const imagesRes = await pool.query(
    `SELECT * FROM refund_request_images WHERE refund_request_id = $1 AND deleted_at IS NULL ORDER BY sort_order`,
    [refundRequestId]
  );

  let payment = null;
  if (request.order_id) {
    const paymentRes = await pool.query(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [request.order_id]
    );
    payment = paymentRes.rows[0] || null;
  }

  return {
    ...request,
    items: itemsRes.rows,
    images: imagesRes.rows,
    payment,
  };
}

exports.updateRefundStatus = async (refundRequestId, status, options = {}) => {
  const { adminUserId, adminNotes } = options;

  const checkRes = await pool.query(
    `SELECT status, (to_jsonb(refund_requests)->>'workflow_version')::int AS workflow_version FROM refund_requests WHERE refund_request_id = $1 AND deleted_at IS NULL`,
    [refundRequestId]
  );
  if (checkRes.rows.length === 0) {
    throw new Error('Refund request not found');
  }
  const currentStatus = checkRes.rows[0].status;
  if (checkRes.rows[0].workflow_version === 2) throw new Error('Use the reviewed refund workflow for this request');
  const allowedTransitions = {
    pending: ['approved', 'rejected', 'refunded'],
    approved: ['processing', 'refunded'],
    processing: ['refunded'],
    rejected: [],
    refunded: [],
  };
  if (!allowedTransitions[currentStatus]?.includes(status)) {
    throw new Error(`Invalid refund status transition from '${currentStatus}' to '${status}'`);
  }

  const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
  const updateValues = [status];
  let paramIndex = 2;

  if (adminUserId) {
    updateFields.push(`reviewed_by = $${paramIndex++}`);
    updateValues.push(adminUserId);
    updateFields.push(`reviewed_at = CURRENT_TIMESTAMP`);
  }
  if (adminNotes) {
    updateFields.push(`admin_notes = $${paramIndex++}`);
    updateValues.push(adminNotes);
    if (status === 'rejected') {
      updateFields.push(`rejection_reason = $${paramIndex++}`);
      updateValues.push(adminNotes);
    }
  }
  if (status === 'processing') {
    updateFields.push(`processing_at = CURRENT_TIMESTAMP`);
  }
  if (status === 'refunded') {
    updateFields.push(`refunded_at = CURRENT_TIMESTAMP`);
  }

  updateValues.push(refundRequestId);
  const res = await pool.query(
    `UPDATE refund_requests SET ${updateFields.join(', ')} WHERE refund_request_id = $${paramIndex} RETURNING *`,
    updateValues
  );

  return res.rows[0];
}
