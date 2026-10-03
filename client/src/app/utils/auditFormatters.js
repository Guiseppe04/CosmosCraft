/**
 * auditFormatters.js
 *
 * Turns a stored audit row into the structured, human-readable description an
 * administrator needs:
 *
 *   WHO   → performedBy   (server joins users; falls back to "System")
 *   WHAT  → title + description
 *   WHICH → entity / relatedEntity (order number, refund number, SKU, …)
 *   WHY   → reason, source, rejection reason, notes
 *
 * Design rules:
 *   1. Nothing here mutates state or renders JSX; the table and the modal both
 *      consume the same formatter output, so they can never disagree.
 *   2. A generic word like "Updated" is only used when the record genuinely has
 *      nothing else to say. Whenever before/after data or context exists, the
 *      description names it.
 *   3. Historical rows are first-class: when a row predates the richer context
 *      columns the formatter degrades to what is actually stored and says so,
 *      rather than inventing values.
 *
 * Value formatters (currency, status, percentage, boolean, date) live here and
 * in `auditLabels.js`; `auditLabels` owns the label dictionaries for modules,
 * actions and statuses so both files agree on wording.
 */

import {
  formatAction as formatActionLabel,
  formatAmount,
  formatEntityNoun,
  formatEntityType,
  formatStatus,
} from './auditLabels'

/* ─── Value helpers ─────────────────────────────────────────────────────── */

/** Flattens an audit payload (`{ old, new }` shapes included) into a lookup. */
export function flattenAuditDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {}
  const { old, new: next, ...rest } = details
  const flat = {}
  if (old && typeof old === 'object') Object.assign(flat, old)
  Object.assign(flat, rest)
  if (next && typeof next === 'object') Object.assign(flat, next)
  return flat
}

const isBlank = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && !value.trim())

const text = (value) => (isBlank(value) ? '' : String(value).trim())

/** First non-blank value for a list of keys, searched in `context` then `details`. */
function pick(...sources) {
  const keys = sources.pop()
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const key of keys) {
      const value = source[key]
      if (!isBlank(value) && typeof value !== 'object') return value
    }
  }
  return null
}

/** The normalised context stored by the server at event time. */
export const getContext = (log = {}) =>
  log.context && typeof log.context === 'object' && !Array.isArray(log.context) ? log.context : {}

/** Legacy payload, for rows written before the context columns existed. */
export const getDetails = (log = {}) => flattenAuditDetails(log.details)

/* ─── Field-level change formatting (§6) ────────────────────────────────── */

const CURRENCY_FIELDS = /amount|total|price|subtotal|balance|paid|refund|discount|tax|fee|cost/i
const QUANTITY_FIELDS = /quantity|stock|count|qty|items/i
const PERCENT_FIELDS = /percent|percentage|progress/i
const BOOLEAN_FIELDS = /^(is_|has_|can_|should_)?(active|enabled|verified|primary|featured|published|archived|deleted|hidden|available|stocked)/i
const STATUS_FIELDS = /status|state|stage/i

/** Turns one before/after pair into a human-readable value. */
export function formatChangeValue(field, raw) {
  if (isBlank(raw)) return null
  if (typeof raw === 'boolean') return raw ? 'Enabled' : 'Disabled'
  if (typeof raw === 'number') {
    if (PERCENT_FIELDS.test(field)) return `${raw}%`
    if (CURRENCY_FIELDS.test(field)) return formatAmount(raw)
    if (QUANTITY_FIELDS.test(field)) return String(raw)
    return String(raw)
  }
  if (typeof raw === 'object') return null

  const value = String(raw).trim()
  if (/^(true|false)$/i.test(value) && BOOLEAN_FIELDS.test(field)) {
    return value.toLowerCase() === 'true' ? 'Enabled' : 'Disabled'
  }
  if (STATUS_FIELDS.test(field)) return formatStatus(value)
  if (PERCENT_FIELDS.test(field) && /^\d+(\.\d+)?$/.test(value)) return `${value}%`
  if (CURRENCY_FIELDS.test(field) && /^-?\d+(\.\d+)?$/.test(value)) return formatAmount(value)
  if (BOOLEAN_FIELDS.test(field) && /^(yes|no)$/i.test(value)) {
    return value.toLowerCase() === 'yes' ? 'Enabled' : 'Disabled'
  }
  return value
}

/**
 * Normalised `{ label, from, to, delta }` list from the stored `changes` map.
 *
 * Older rows have no `changes` column, so when it is empty we fall back to
 * comparing the `previous_status` / `new_status` pair the row always had.
 */
export function getChangeList(log = {}) {
  const changes = log.changes && typeof log.changes === 'object' && !Array.isArray(log.changes) ? log.changes : {}
  const entries = []

  for (const [field, value] of Object.entries(changes)) {
    const label = humanizeField(field)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const from = formatChangeValue(field, value.from)
      const to = formatChangeValue(field, value.to)
      if (from === to) continue
      entries.push({ label, from: from || null, to: to || null, delta: numberDelta(value.from, value.to) })
    } else {
      const to = formatChangeValue(field, value)
      if (to) entries.push({ label, from: null, to, delta: null })
    }
  }

  // Status transition recorded on the row itself rather than in `changes`.
  if (!entries.length && (log.previous_status || log.new_status)) {
    const from = text(log.previous_status)
    const to = text(log.new_status)
    if (from !== to) {
      entries.push({ label: 'Status', from: from ? formatStatus(from) : null, to: to ? formatStatus(to) : null, delta: null })
    }
  }

  return entries
}

/** "+5" / "-3" for numeric changes, so a stock movement reads "20 → 15 (-5)". */
function numberDelta(from, to) {
  const a = Number(from)
  const b = Number(to)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const delta = b - a
  if (delta === 0) return null
  return `${delta > 0 ? '+' : ''}${delta}`
}

const FIELD_LABELS = {
  status: 'Status',
  payment_status: 'Payment Status',
  order_status: 'Order Status',
  project_status: 'Project Status',
  appointment_status: 'Appointment Status',
  fulfillment_status: 'Fulfillment Status',
  refund_status: 'Refund Status',
  previous_status: 'Previous Status',
  new_status: 'New Status',
  price: 'Price',
  amount: 'Amount',
  total_amount: 'Total Amount',
  refund_amount: 'Refund Amount',
  approved_amount: 'Approved Amount',
  stock: 'Stock',
  previous_quantity: 'Previous Quantity',
  new_quantity: 'New Quantity',
  quantity: 'Quantity',
  quantity_change: 'Quantity Change',
  role: 'Role',
  is_active: 'Account Status',
  name: 'Name',
  sku: 'SKU',
  category: 'Category',
  customer_name: 'Customer',
  notes: 'Notes',
  reason: 'Reason',
  progress: 'Progress',
  scheduled_at: 'Scheduled Time',
  method: 'Method',
  reference_number: 'Reference Number',
  tracking_number: 'Tracking Number',
  courier_name: 'Courier',
}

function humanizeField(field) {
  const key = String(field || '').trim()
  if (!key) return 'Value'
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ─── Shared read helpers per domain ────────────────────────────────────── */

/** Formats a list of "facts" the table shows as one compact secondary line. */
const joinFacts = (facts) => facts.filter(Boolean).join(' · ')

const money = (value) => {
  const amount = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(amount) ? formatAmount(amount) : null
}

/**
 * Human-friendly payment method.
 * `formatPaymentMethod` lives with the payment screens; this wrapper keeps the
 * formatter module free of payment-screen imports beyond that one helper.
 */
function paymentMethodLabel(method) {
  const raw = text(method)
  if (!raw) return null
  const known = {
    gcash: 'GCash',
    maya: 'Maya',
    bank_transfer: 'Bank Transfer',
    bpi: 'BPI Bank Transfer',
    cash: 'Cash',
    cod: 'Cash on Delivery',
    card: 'Card',
    credit_card: 'Credit Card',
    installment: 'Installment',
  }
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_')
  if (known[key]) return known[key]
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const movementTitle = (movement) => {
  const raw = text(movement)
  if (!raw) return null
  const known = {
    stock_in: 'Stock Added',
    stock_out: 'Stock Deducted',
    restock: 'Stock Added',
    restocked: 'Stock Restored',
    returned: 'Stock Restored',
    return_restock: 'Return Restock',
    refund_restock: 'Refund Restock',
    cancellation_restock: 'Cancellation Restock',
    reserved: 'Stock Reserved',
    released: 'Stock Released',
    adjustment: 'Manual Stock Adjustment',
    pos_deduction: 'POS Deduction',
    order_deduction: 'Online Order Deduction',
    project_deduction: 'Project Part Deduction',
    builder_part_deduction: 'Builder Part Deduction',
  }
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_')
  if (known[key]) return known[key]
  return raw
}

const referenceTitle = (referenceType) => {
  const key = text(referenceType).toLowerCase()
  const known = {
    order: 'Online Order',
    pos_sale: 'POS Sale',
    return: 'Customer Return',
    refund: 'Refund',
    cancellation: 'Order Cancellation',
    project: 'Custom Guitar Build',
    project_part: 'Custom Guitar Build',
    manual: 'Manual Adjustment',
    manual_adjustment: 'Manual Adjustment',
    supplier: 'Supplier Restock',
  }
  return known[key] || null
}

/* ─── Domain formatters (§8) ────────────────────────────────────────────── */

/**
 * Shared result shape:
 * {
 *   module, title, description, entity, relatedEntity,
 *   metadata: [{ label, value, mono? }],
 *   change, secondary, tone
 * }
 */
const emptyResult = (module) => ({
  module,
  title: 'Activity',
  description: '',
  entity: null,
  relatedEntity: null,
  metadata: [],
  change: null,
  secondary: '',
  tone: 'neutral',
})

/** Payment: amount, method, status change, order/project, customer, reference. */
export function formatPaymentAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('payment')

  const amount = pick(context, details, ['amount', 'payment_amount', 'total_amount'])
  const method = paymentMethodLabel(pick(context, details, ['payment_method', 'method']))
  const reference = pick(context, details, ['reference_number', 'payment_reference', 'proof_number'])
  const orderNumber = pick(context, details, ['order_number'])
  const orderType = pick(context, details, ['order_type'])
  const projectNumber = pick(context, details, ['project_number', 'custom_build_id'])
  const projectTitle = pick(context, details, ['project_title'])
  const appointmentNumber = pick(context, details, ['appointment_number', 'reference_code'])
  const customerName = pick(context, details, ['customer_name', 'user_name', 'customer'])
  const customerEmail = pick(context, details, ['customer_email', 'email'])
  const reason = pick(context, details, ['rejection_reason', 'reason', 'adjustment_reason', 'notes'])
  const paymentType = pick(context, details, ['payment_type', 'type'])
  const installment = pick(context, details, ['installment_number'])
  const paymentId = pick(context, details, ['payment_id'])

  const target =
    appointmentNumber
      ? `Appointment ${appointmentNumber}`
      : projectNumber
        ? `Custom Project ${projectNumber}`
        : orderNumber
          ? `Order ${orderNumber}`
          : null

  const amountText = money(amount)

  // Title + description per payment action.
  const action = String(log.action || '').toUpperCase()
  const from = text(log.previous_status)
  const to = text(log.new_status)

  switch (action) {
    case 'PAYMENT_VERIFIED':
    case 'VERIFY':
      result.title = 'Payment Verified'
      result.tone = 'success'
      result.description = [
        amountText ? `Payment of ${amountText}${method ? ` via ${method}` : ''}` : `Payment${method ? ` via ${method}` : ''}`,
        target ? `was verified for ${target}` : 'was verified',
      ].join(' ') + '.'
      break
    case 'PAYMENT_REJECTED':
    case 'REJECT':
      result.title = 'Payment Rejected'
      result.tone = 'danger'
      result.description = target
        ? `Payment for ${target} was rejected.`
        : `Payment${amountText ? ` of ${amountText}` : ''} was rejected.`
      break
    case 'PAYMENT_REFUNDED':
      result.title = 'Payment Refunded'
      result.tone = 'danger'
      result.description = target
        ? `Payment for ${target} was refunded${amountText ? ` (${amountText})` : ''}.`
        : `Payment${amountText ? ` of ${amountText}` : ''} was refunded.`
      break
    case 'PAYMENT_CANCELLED':
      result.title = 'Payment Cancelled'
      result.tone = 'danger'
      result.description = target ? `Payment for ${target} was cancelled.` : 'Payment was cancelled.'
      break
    case 'PAYMENT_PROOF_SUBMITTED':
      result.title = 'Payment Proof Submitted'
      result.tone = 'gold'
      result.description = target
        ? `Payment proof for ${target} was submitted and is awaiting verification${amountText ? ` (${amountText})` : ''}.`
        : `Payment proof was submitted and is awaiting verification${amountText ? ` (${amountText})` : ''}.`
      break
    case 'PAYMENT_RECORDED':
      result.title = paymentType === 'installment' || installment ? 'Installment Payment Recorded' : 'Payment Recorded'
      result.tone = 'gold'
      if (installment) {
        result.description = target
          ? `Installment #${installment} payment${amountText ? ` of ${amountText}` : ''} was recorded for ${target}.`
          : `Installment #${installment} payment${amountText ? ` of ${amountText}` : ''} was recorded.`
      } else {
        result.description = target
          ? `Payment${amountText ? ` of ${amountText}` : ''}${method ? ` via ${method}` : ''} was recorded for ${target}.`
          : `Payment${amountText ? ` of ${amountText}` : ''}${method ? ` via ${method}` : ''} was recorded.`
      }
      break
    default: {
      // Generic payment update: describe the status change when we have one,
      // otherwise name what is known instead of saying "Payment Updated".
      const changeList = getChangeList(log)
      if (changeList.length) {
        result.title = 'Payment Updated'
        result.description = target
          ? `Payment for ${target}: ${changeList.map(describeChange).join('; ')}.`
          : `Payment ${changeList.map(describeChange).join('; ')}.`
      } else if (to) {
        result.title = 'Payment Status Updated'
        result.description = target
          ? `Payment status for ${target} changed from ${from ? formatStatus(from) : 'unknown'} → ${formatStatus(to)}.`
          : `Payment status changed from ${from ? formatStatus(from) : 'unknown'} → ${formatStatus(to)}.`
      } else if (target || amountText) {
        result.title = 'Payment Updated'
        result.description = [
          target ? `Payment for ${target}` : 'Payment',
          amountText || null,
          method,
          'was updated. No field details were recorded for this entry.',
        ]
          .filter(Boolean)
          .join(' ')
      } else {
        result.title = 'Payment Updated'
        result.description =
          'Payment details updated. This record predates enriched audit data, so no payment or order information is available.'
      }
      break
    }
  }

  if (orderNumber) result.entity = { label: 'Order', value: orderNumber, mono: true }
  if (projectNumber) {
    result.relatedEntity = {
      label: 'Custom Project',
      value: projectTitle ? `${projectNumber} · ${projectTitle}` : projectNumber,
      mono: true,
    }
  } else if (appointmentNumber) {
    result.relatedEntity = { label: 'Appointment', value: appointmentNumber, mono: true }
  }

  const metadata = []
  if (amountText) metadata.push({ label: 'Amount', value: amountText })
  if (method) metadata.push({ label: 'Payment Method', value: method })
  if (reference) metadata.push({ label: 'Reference', value: reference, mono: true })
  if (orderType) metadata.push({ label: 'Order Type', value: humanizeField(orderType) })
  if (installment) metadata.push({ label: 'Installment', value: `#${installment}` })
  if (customerName) metadata.push({ label: 'Customer', value: customerName })
  if (customerEmail) metadata.push({ label: 'Customer Email', value: customerEmail, mono: true })
  if (paymentId) metadata.push({ label: 'Payment ID', value: shortId(paymentId), mono: true })
  if (reason) metadata.push({ label: 'Reason', value: text(reason) })
  result.metadata = metadata

  result.secondary = joinFacts([
    amountText,
    method,
    target,
    customerName,
    reference ? `Ref ${reference}` : null,
  ])

  return result
}

/** Inventory: product, SKU, before → after with delta, movement and source. */
export function formatInventoryAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('inventory')

  const productName = pick(context, details, ['product_name', 'name'])
  const sku = pick(context, details, ['sku'])
  const previous = pick(context, details, ['previous_quantity', 'stock_from'])
  const next = pick(context, details, ['new_quantity', 'stock_to'])
  const delta = pick(context, details, ['quantity_change', 'delta'])
  const movement = text(pick(context, details, ['movement']))
  const source = pick(context, details, ['source', 'reference_type'])
  const reason = pick(context, details, ['reason', 'notes'])
  const orderNumber = pick(context, details, ['order_number'])
  const projectNumber = pick(context, details, ['project_number', 'custom_build_id'])
  const saleNumber = pick(context, details, ['sale_number', 'source_number'])
  const isManual = movement === 'adjustment' || source === 'manual_adjustment'

  const title = movementTitle(movement)
    || (log.action === 'STOCK_MOVEMENT' ? 'Stock Movement' : null)
    || formatActionLabel(log.action)
  result.title = title
  result.tone = delta !== null && Number(delta) < 0 ? 'danger' : 'success'
  if (isManual) result.tone = 'gold'

  const qtyText =
    previous !== null && next !== null
      ? `${previous} → ${next}${delta !== null && Number(delta) !== 0 ? ` (${numberDelta(previous, next) || delta})` : ''}`
      : delta !== null
        ? `${Number(delta) > 0 ? '+' : ''}${delta}`
        : null

  const productLabel = productName || sku || 'a product'
  const sourceLabel = referenceTitle(source) || (source ? humanizeField(source) : null)

  if (qtyText) {
    const reasonClause = reason
      ? ` Reason: ${text(reason)}.`
      : ''
    result.description = `${productLabel} stock ${qtyText}.${reasonClause}`
  } else if (reason) {
    result.description = `${productLabel} stock was updated. Reason: ${text(reason)}.`
  } else {
    result.description = `${productLabel} stock was updated. Quantity information is not available for this record.`
  }

  if (productName || sku) {
    result.entity = { label: productName ? 'Product' : 'SKU', value: productName || sku }
  }
  if (orderNumber) result.relatedEntity = { label: 'Order', value: orderNumber, mono: true }
  else if (projectNumber) result.relatedEntity = { label: 'Custom Project', value: projectNumber, mono: true }
  else if (saleNumber) result.relatedEntity = { label: 'Sale', value: saleNumber, mono: true }

  const metadata = []
  if (sku) metadata.push({ label: 'SKU', value: sku, mono: true })
  if (previous !== null) metadata.push({ label: 'Previous Stock', value: String(previous) })
  if (next !== null) metadata.push({ label: 'New Stock', value: String(next) })
  if (delta !== null && Number(delta) !== 0) {
    metadata.push({ label: 'Quantity Change', value: `${Number(delta) > 0 ? '+' : ''}${delta}` })
  }
  if (movement) metadata.push({ label: 'Adjustment Type', value: movementTitle(movement) || humanizeField(movement) })
  if (sourceLabel) metadata.push({ label: 'Source', value: sourceLabel })
  if (orderNumber) metadata.push({ label: 'Order', value: orderNumber, mono: true })
  if (projectNumber) metadata.push({ label: 'Custom Project', value: projectNumber, mono: true })
  if (saleNumber) metadata.push({ label: 'POS Sale', value: saleNumber, mono: true })
  if (reason) metadata.push({ label: 'Reason', value: text(reason) })
  result.metadata = metadata

  result.secondary = joinFacts([
    productName,
    sku ? `SKU ${sku}` : null,
    qtyText,
    sourceLabel,
  ])

  result.change = qtyText ? { label: 'Stock', from: null, to: qtyText, delta: null } : null

  return result
}

/** Order lifecycle: status change, shipment, delivery, cancellation. */
export function formatOrderAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('order')

  const orderNumber = pick(context, details, ['order_number'])
  const orderType = pick(context, details, ['order_type'])
  const total = money(pick(context, details, ['order_total', 'total_amount']))
  const paymentStatus = pick(context, details, ['payment_status'])
  const customerName = pick(context, details, ['customer_name'])
  const customerEmail = pick(context, details, ['customer_email'])
  const reason = pick(context, details, ['reason', 'cancel_reason', 'notes'])
  const tracking = pick(context, details, ['tracking_number'])
  const courier = pick(context, details, ['courier_name', 'courier'])

  const from = text(log.previous_status)
  const to = text(log.new_status)
  const changeList = getChangeList(log)
  const orderLabel = orderNumber ? `Order ${orderNumber}` : 'the order'

  if (log.action === 'ORDER_SHIPPED') {
    result.title = 'Order Shipped'
    result.tone = 'gold'
    result.description = `${orderLabel} was shipped${courier ? ` via ${courier}` : ''}${tracking ? ` (${tracking})` : ''}.`
  } else if (log.action === 'ORDER_OUT_FOR_DELIVERY') {
    result.title = 'Out for Delivery'
    result.tone = 'gold'
    result.description = `${orderLabel} is out for delivery.`
  } else if (log.action === 'ORDER_MARKED_DELIVERED') {
    result.title = 'Order Delivered'
    result.tone = 'success'
    result.description = `${orderLabel} was marked as delivered.`
  } else if (log.action === 'ORDER_MARKED_RECEIVED') {
    result.title = 'Order Received'
    result.tone = 'success'
    result.description = `${orderLabel} was confirmed as received by the customer.`
  } else if (log.action === 'ORDER_CANCELLED' || log.action === 'CANCEL') {
    result.title = 'Order Cancelled'
    result.tone = 'danger'
    result.description = `${orderLabel} was cancelled.`
  } else if (from && to && from !== to) {
    result.title = 'Order Status Updated'
    result.tone = ['cancelled', 'rejected'].includes(to) ? 'danger' : 'success'
    result.description = `${orderLabel} status changed from ${formatStatus(from)} → ${formatStatus(to)}.`
  } else if (changeList.length) {
    result.title = 'Order Updated'
    result.description = `${orderLabel}: ${changeList.map(describeChange).join('; ')}.`
  } else if (orderNumber) {
    result.title = 'Order Updated'
    result.description = `${orderLabel} was updated. No field details were recorded for this entry.`
  } else {
    result.title = 'Order Updated'
    result.description =
      'An order record was updated. This record predates enriched audit data, so the order could not be identified.'
  }

  if (orderNumber) result.entity = { label: 'Order', value: orderNumber, mono: true }

  const metadata = []
  if (orderType) metadata.push({ label: 'Order Type', value: humanizeField(orderType) })
  if (total) metadata.push({ label: 'Order Total', value: total })
  if (paymentStatus) metadata.push({ label: 'Payment Status', value: formatStatus(paymentStatus) })
  if (customerName) metadata.push({ label: 'Customer', value: customerName })
  if (customerEmail) metadata.push({ label: 'Customer Email', value: customerEmail, mono: true })
  if (courier) metadata.push({ label: 'Courier', value: courier })
  if (tracking) metadata.push({ label: 'Tracking Number', value: tracking, mono: true })
  if (reason) metadata.push({ label: 'Reason', value: text(reason) })
  result.metadata = metadata

  result.secondary = joinFacts([
    orderNumber,
    from && to ? `${formatStatus(from)} → ${formatStatus(to)}` : null,
    total,
    customerName,
  ])

  if (from && to && from !== to) {
    result.change = { label: 'Order Status', from: formatStatus(from), to: formatStatus(to), delta: null }
  }

  return result
}

/** Custom guitar builds (projects): the work performed and its progress. */
export function formatProjectAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('project')

  const projectNumber = pick(context, details, ['project_number', 'custom_build_id'])
  const projectTitle = pick(context, details, ['project_title', 'title', 'build_name'])
  const orderNumber = pick(context, details, ['order_number'])
  const customerName = pick(context, details, ['customer_name'])
  const progress = pick(context, details, ['progress_percent', 'progress'])
  const bodyModel = pick(context, details, ['body_model'])
  const reason = pick(context, details, ['reason', 'hold_reason', 'cancel_reason', 'notes'])
  const action = text(log.action)
  const from = text(log.previous_status)
  const to = text(log.new_status)
  const changeList = getChangeList(log)

  const buildLabel = projectNumber
    ? `Custom Project ${projectNumber}`
    : projectTitle
      ? `Custom Project “${projectTitle}”`
      : orderNumber
        ? `the custom build for Order ${orderNumber}`
        : 'the custom build'

  const PROJECT_ACTIONS = {
    project_claimed: ['Project Claimed', 'success', `${buildLabel} was claimed by a builder.`],
    project_unclaimed: ['Project Unclaimed', 'neutral', `${buildLabel} was released back to the queue.`],
    project_cancelled: ['Project Cancelled', 'danger', `${buildLabel} was cancelled.`],
    project_resumed: ['Project Resumed', 'success', `${buildLabel} was resumed.`],
    project_part_received: ['Part Received', 'success', `A required part for ${buildLabel} was marked as received.`],
    project_part_unreceived: ['Part Marked Missing', 'danger', `A required part for ${buildLabel} was marked as not received.`],
    build_claim_created: ['Build Claim Created', 'gold', `A claim was created for ${buildLabel}.`],
    build_claim_received: ['Build Claim Received', 'success', `The claim for ${buildLabel} was marked as received.`],
    build_claim_status_updated: ['Build Claim Updated', 'gold', `The claim for ${buildLabel} was updated.`],
    build_claim_courier_arranged: ['Delivery Arranged', 'gold', `Delivery was arranged for ${buildLabel}.`],
    build_released: ['Build Released', 'success', `${buildLabel} was released.`],
    hold_requested: ['Hold Requested', 'gold', `A hold was requested for ${buildLabel}.`],
    hold_approved: ['Hold Approved', 'gold', `The hold for ${buildLabel} was approved.`],
    hold_rejected: ['Hold Rejected', 'danger', `The hold for ${buildLabel} was rejected.`],
    cancel_requested: ['Cancellation Requested', 'gold', `A cancellation was requested for ${buildLabel}.`],
    cancel_request_withdrawn: ['Cancellation Withdrawn', 'neutral', `The cancellation request for ${buildLabel} was withdrawn.`],
    cancel_approved: ['Cancellation Approved', 'danger', `The cancellation for ${buildLabel} was approved.`],
    cancel_rejected: ['Cancellation Rejected', 'neutral', `The cancellation for ${buildLabel} was rejected.`],
    milestone_updated: ['Milestone Updated', 'gold', `A build milestone for ${buildLabel} was updated.`],
    subtask_status_changed: ['Task Status Changed', 'gold', `A build task for ${buildLabel} changed status.`],
    workflow_initialized: ['Build Workflow Started', 'gold', `The build workflow for ${buildLabel} was initialized.`],
  }

  const mapped = PROJECT_ACTIONS[action]
  if (mapped) {
    result.title = mapped[0]
    result.tone = mapped[1]
    result.description = mapped[2]
  } else if (from && to && from !== to) {
    result.title = 'Project Status Updated'
    result.tone = 'gold'
    result.description = `${buildLabel} status changed from ${formatStatus(from)} → ${formatStatus(to)}.`
  } else if (changeList.length) {
    result.title = 'Project Updated'
    result.description = `${buildLabel}: ${changeList.map(describeChange).join('; ')}.`
  } else if (to) {
    result.title = 'Project Updated'
    result.description = `${buildLabel} was updated to ${formatStatus(to)}.`
  } else {
    result.title = 'Project Updated'
    result.description = `${buildLabel} was updated. No further details were recorded for this entry.`
  }

  result.entity = projectNumber
    ? { label: 'Custom Project', value: projectTitle ? `${projectNumber} · ${projectTitle}` : projectNumber, mono: true }
    : projectTitle
      ? { label: 'Custom Project', value: projectTitle }
      : orderNumber
        ? { label: 'Order', value: orderNumber, mono: true }
        : null
  if (orderNumber && projectNumber) {
    result.relatedEntity = { label: 'Order', value: orderNumber, mono: true }
  }

  const metadata = []
  if (projectNumber && projectTitle) metadata.push({ label: 'Build', value: projectTitle })
  if (orderNumber) metadata.push({ label: 'Order', value: orderNumber, mono: true })
  if (progress !== null) metadata.push({ label: 'Progress', value: `${progress}%` })
  if (bodyModel) metadata.push({ label: 'Body Model', value: bodyModel })
  if (customerName) metadata.push({ label: 'Customer', value: customerName })
  if (reason) metadata.push({ label: 'Reason', value: text(reason) })
  result.metadata = metadata

  result.secondary = joinFacts([
    projectNumber || projectTitle || orderNumber,
    from && to ? `${formatStatus(from)} → ${formatStatus(to)}` : null,
    progress !== null ? `${progress}%` : null,
    customerName,
  ])

  if (from && to && from !== to) {
    result.change = { label: 'Project Status', from: formatStatus(from), to: formatStatus(to), delta: null }
  }

  return result
}

/** Products and guitar parts. */
export function formatProductAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('product')

  const name = pick(context, details, ['product_name', 'part_name', 'name'])
  const sku = pick(context, details, ['sku'])
  const price = money(pick(context, details, ['price']))
  const stock = pick(context, details, ['stock'])
  const category = pick(context, details, ['category'])
  const changeList = getChangeList(log)
  const isPart = String(log.entity_type || '').includes('guitar_builder_parts')
  const label = name || sku || (isPart ? 'the guitar part' : 'the product')

  const action = String(log.action || '').toUpperCase()
  if (action === 'INSERT') {
    result.title = `${isPart ? 'Guitar Part' : 'Product'} Created`
    result.tone = 'success'
    result.description = `${label} was created${price ? ` at ${price}` : ''}.`
  } else if (action === 'DELETE') {
    result.title = `${isPart ? 'Guitar Part' : 'Product'} Deleted`
    result.tone = 'danger'
    result.description = `${label} was deleted.`
  } else if (changeList.length) {
    result.title = `${isPart ? 'Guitar Part' : 'Product'} Updated`
    result.description = changeList.map(describeChange).join('; ') + '.'
    result.entity = name ? { label: isPart ? 'Guitar Part' : 'Product', value: name } : null
    result.change = describeChangeObject(changeList[0])
  } else if (price) {
    result.title = `${isPart ? 'Guitar Part' : 'Product'} Updated`
    result.description = `${label} was updated (${sku ? `SKU ${sku}` : 'no SKU recorded'}).`
  } else {
    result.title = `${isPart ? 'Guitar Part' : 'Product'} Updated`
    result.description = `${label} was updated. No field details were recorded for this entry.`
  }

  if (!result.entity && (name || sku)) {
    result.entity = { label: name ? (isPart ? 'Guitar Part' : 'Product') : 'SKU', value: name || sku }
  }

  const metadata = []
  if (sku) metadata.push({ label: 'SKU', value: sku, mono: true })
  if (price) metadata.push({ label: 'Price', value: price })
  if (stock !== null) metadata.push({ label: 'Stock', value: String(stock) })
  if (category) metadata.push({ label: 'Category', value: humanizeField(category) })
  result.metadata = metadata

  result.secondary = joinFacts([name, sku ? `SKU ${sku}` : null, price, changeList[0] ? describeChange(changeList[0]) : null])

  return result
}

/** Refund requests and their related order. */
export function formatRefundAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('refund')

  const refundNumber = pick(context, details, ['refund_number', 'request_number'])
  const orderNumber = pick(context, details, ['order_number'])
  const amount = money(pick(context, details, ['refund_amount', 'approved_amount', 'amount']))
  const refundType = pick(context, details, ['refund_type'])
  const reason = pick(context, details, ['reason', 'rejection_reason', 'customer_notes'])
  const customerName = pick(context, details, ['customer_name'])
  const from = text(log.previous_status)
  const to = text(log.new_status)
  const action = String(log.action || '').toUpperCase()

  const refundLabel = refundNumber ? `Refund ${refundNumber}` : 'the refund'
  const targetSuffix = orderNumber ? ` for Order ${orderNumber}` : ''

  const REFUND_ACTIONS = {
    REFUND_REQUESTED: ['Refund Requested', 'gold', `${refundLabel} was requested${targetSuffix}.`],
    REFUND_APPROVED: ['Refund Approved', 'success', `${refundLabel} was approved${targetSuffix}.`],
    REFUND_REJECTED: ['Refund ReJECTED', 'danger', `${refundLabel} was rejected${targetSuffix}.`],
    REFUND_PROCESSING: ['Refund Processing', 'gold', `${refundLabel} is being processed${targetSuffix}.`],
    REFUND_REFUNDED: ['Refund Completed', 'success', `${refundLabel} was completed${targetSuffix}.`],
    REFUND_WITHDRAWN: ['Refund Withdrawn', 'neutral', `${refundLabel} was withdrawn by the customer.`],
    REFUND_PENDING_PAYMENT_VERIFIED: ['Refund Payment Verified', 'success', `The payment for ${refundLabel} was verified.`],
    REFUND_PENDING_PAYMENT_REJECTED: ['Refund Payment Rejected', 'danger', `The payment for ${refundLabel} was rejected.`],
  }

  if (action === 'REFUND_RETURN_RETURNED') {
    result.title = 'Returned Item Confirmed'
    result.tone = 'gold'
    result.description = `The returned item for ${refundLabel}${targetSuffix} was confirmed.`
  } else if (action === 'REFUND_RETURN_RETURN_PENDING') {
    result.title = 'Return Requested'
    result.tone = 'gold'
    result.description = `A return was requested for ${refundLabel}${targetSuffix}.`
  } else if (REFUND_ACTIONS[action]) {
    const [title, tone, description] = REFUND_ACTIONS[action]
    result.title = title
    result.tone = tone
    result.description = description
  } else if (from && to && from !== to) {
    result.title = 'Refund Status Updated'
    result.tone = to === 'rejected' ? 'danger' : 'gold'
    result.description = `${refundLabel} status changed from ${formatStatus(from)} → ${formatStatus(to)}.`
  } else {
    result.title = 'Refund Updated'
    result.description = refundNumber
      ? `${refundLabel} was updated. No field details were recorded for this entry.`
      : 'A refund record was updated. This record predates enriched audit data, so the refund request could not be identified.'
  }

  if (refundNumber) result.entity = { label: 'Refund', value: refundNumber, mono: true }
  if (orderNumber) result.relatedEntity = { label: 'Order', value: orderNumber, mono: true }

  const metadata = []
  if (orderNumber) metadata.push({ label: 'Order', value: orderNumber, mono: true })
  if (amount) metadata.push({ label: 'Refund Amount', value: amount })
  if (refundType) metadata.push({ label: 'Refund Type', value: humanizeField(refundType) })
  if (customerName) metadata.push({ label: 'Customer', value: customerName })
  if (reason) metadata.push({ label: 'Reason', value: text(reason) })
  result.metadata = metadata

  result.secondary = joinFacts([
    refundNumber,
    orderNumber ? `Order ${orderNumber}` : null,
    amount,
    from && to ? `${formatStatus(from)} → ${formatStatus(to)}` : null,
  ])

  if (from && to && from !== to) {
    result.change = { label: 'Refund Status', from: formatStatus(from), to: formatStatus(to), delta: null }
  }

  return result
}

/** Appointments: reference code, customer, schedule, payment status. */
export function formatAppointmentAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('appointment')

  const reference = pick(context, details, ['reference_code', 'appointment_number'])
  const appointmentType = pick(context, details, ['appointment_type'])
  const customerName = pick(context, details, ['customer_name'])
  const scheduledAt = pick(context, details, ['scheduled_at'])
  const paymentStatus = pick(context, details, ['payment_status', 'appointment_payment_status'])
  const reason = pick(context, details, ['reason', 'notes'])
  const from = text(log.previous_status)
  const to = text(log.new_status)

  const label = reference ? `Appointment ${reference}` : 'the appointment'
  const who = customerName ? ` for ${customerName}` : ''

  if (log.action === 'PAYMENT') {
    result.title = 'Appointment Payment Recorded'
    result.tone = paymentStatus === 'verified' || paymentStatus === 'approved' ? 'success' : 'gold'
    result.description = `${label}${who}: payment status changed from ${
      from ? formatStatus(from) : 'unrecorded'
    } → ${to ? formatStatus(to) : 'unrecorded'}.`
  } else if (to && to !== from) {
    result.title = `Appointment ${formatStatus(to)}`
    result.tone = ['cancelled', 'no_show'].includes(to) ? 'danger' : 'success'
    result.description = `${label}${who} was marked as ${formatStatus(to).toLowerCase()}.`
  } else {
    result.title = 'Appointment Updated'
    const changes = getChangeList(log)
    result.description = changes.length
      ? `${label}${who}: ${changes.map(describeChange).join('; ')}.`
      : `${label}${who} was updated. No further details were recorded for this entry.`
  }

  if (reference) result.entity = { label: 'Appointment', value: reference, mono: true }

  const metadata = []
  if (appointmentType) metadata.push({ label: 'Appointment Type', value: humanizeField(appointmentType) })
  if (customerName) metadata.push({ label: 'Customer', value: customerName })
  if (scheduledAt) metadata.push({ label: 'Scheduled', value: text(scheduledAt) })
  if (paymentStatus) metadata.push({ label: 'Payment Status', value: formatStatus(paymentStatus) })
  if (reason) metadata.push({ label: 'Reason', value: text(reason) })
  result.metadata = metadata

  result.secondary = joinFacts([reference, appointmentType, customerName, from && to ? `${formatStatus(from)} → ${formatStatus(to)}` : null])

  if (from && to && from !== to) {
    result.change = { label: 'Appointment Status', from: formatStatus(from), to: formatStatus(to), delta: null }
  }

  return result
}

/**
 * Shop booking calendar: a date closed for bookings, a holiday reopened, or a
 * closure lifted. There is no booking reference here — the date is the
 * identifier — so it is rendered as the subject of the entry.
 */
export function formatScheduleAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('appointment_schedule')

  const date = pick(context, details, ['date', 'affected_date'])
  const reason = pick(context, details, ['reason'])
  const previousReason = pick(context, details, ['previous_reason'])
  const closureType = pick(context, details, ['closure_type'])
  const isRecurring = pick(context, details, ['is_recurring'])
  const from = text(log.previous_status)
  const to = text(log.new_status)

  const label = formatScheduleDate(date)
  // Decided by the closure type, not the resulting status: a reopened closure
  // is also "open" but it is still a plain unavailable date, not a holiday.
  const isHolidayOverride = closureType === 'holiday_override'

  if (log.action === 'SCHEDULE_DATE_CLOSED' || log.action === 'SCHEDULE_DATE_RECLOSED') {
    const reclosed = log.action === 'SCHEDULE_DATE_RECLOSED'
    result.title = reclosed ? 'Booking Date Re-closed' : 'Booking Date Closed'
    result.tone = 'danger'
    result.description = reason
      ? `${label} was marked unavailable for bookings — ${reason}.`
      : `${label} was marked unavailable for bookings.`
  } else if (log.action === 'SCHEDULE_DATE_REOPENED') {
    result.title = 'Booking Date Reopened'
    result.tone = 'success'
    result.description = `${label} is bookable again${
      previousReason ? ` — the closure “${previousReason}” was removed` : ''
    }.`
  } else if (log.action === 'SCHEDULE_HOLIDAY_REOPENED') {
    result.title = 'Holiday Reopened for Bookings'
    result.tone = 'success'
    result.description = `${label} is a holiday but is open for bookings.`
  } else if (log.action === 'SCHEDULE_HOLIDAY_RECLOSED') {
    result.title = 'Holiday Closed Again'
    result.tone = 'danger'
    result.description = `${label} is back to closed for bookings.`
  } else {
    result.title = 'Booking Schedule Updated'
    result.tone = 'gold'
    result.description = label
      ? `The booking calendar changed for ${label}.`
      : 'The booking calendar was updated.'
  }

  if (label) {
    result.entity = { label: isHolidayOverride ? 'Holiday' : 'Date', value: label, mono: false }
  }

  if (from && to && from !== to) {
    result.change = { label: 'Bookability', from: formatStatus(from), to: formatStatus(to), delta: null }
  } else if (previousReason && reason && previousReason !== reason) {
    result.change = { label: 'Reason', from: previousReason, to: reason, delta: null }
  }

  if (isRecurring === true || isRecurring === 'true') {
    result.metadata.push({ label: 'Recurring', value: 'Yes — applies to every occurrence' })
  }

  if (reason) result.metadata.push({ label: 'Reason', value: reason })
  // Only worth listing when the Changes section is not already showing it.
  if (previousReason && previousReason !== reason && !result.change) {
    result.metadata.push({ label: 'Previous Reason', value: previousReason })
  }

  result.secondary = joinFacts([label, reason])

  return result
}

/** Accounts and role-based access changes. */
export function formatUserAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('user')

  const fullName = pick(context, details, ['affected_user_name', 'full_name', 'user_name', 'customer_name', 'name'])
  const email = pick(context, details, ['affected_user_email', 'email', 'user_email'])
  const role = pick(context, details, ['role'])
  const previousRole = pick(context, details, ['previous_role'])
  const changeList = getChangeList(log)
  const target = fullName || email || 'a user'
  const action = String(log.action || '').toUpperCase()

  if (action === 'USER_ROLE_CHANGED' || (previousRole && role && previousRole !== role)) {
    result.title = 'User Role Changed'
    result.tone = 'gold'
    result.description = `User ${target}'s role changed from ${formatStatus(previousRole)} → ${formatStatus(role)}.`
    result.change = { label: 'Role', from: formatStatus(previousRole), to: formatStatus(role), delta: null }
  } else if (action === 'USER_ACTIVATED' || action === 'USER_DEACTIVATED') {
    const enabled = action === 'USER_ACTIVATED'
    result.title = enabled ? 'User Activated' : 'User Deactivated'
    result.tone = enabled ? 'success' : 'danger'
    result.description = `User ${target}'s account was ${enabled ? 'enabled' : 'disabled'}.`
  } else if (action === 'LOGIN_ATTEMPT') {
    result.title = 'Login Attempt'
    result.tone = log.new_status === 'failed' ? 'danger' : 'neutral'
    result.description = `A login attempt was recorded${log.new_status ? ` with result ${formatStatus(log.new_status)}` : ''}.`
  } else if (action === 'PASSWORD_RESET') {
    result.title = 'Password Reset'
    result.tone = 'gold'
    result.description = `The password for user ${target} was reset.`
  } else if (changeList.length) {
    result.title = 'User Updated'
    result.description = `User ${target}: ${changeList.map(describeChange).join('; ')}.`
  } else {
    result.title = 'User Record Updated'
    result.description = `The record for ${target} was updated. No field details were recorded for this entry.`
  }

  if (target !== 'a user') result.entity = { label: 'User', value: target }

  const metadata = []
  if (email && email !== target) metadata.push({ label: 'Email', value: email, mono: true })
  if (role) metadata.push({ label: 'Role', value: formatStatus(role) })
  if (previousRole && previousRole !== role) metadata.push({ label: 'Previous Role', value: formatStatus(previousRole) })
  result.metadata = metadata

  result.secondary = joinFacts([fullName, role ? formatStatus(role) : null, previousRole && previousRole !== role ? `was ${formatStatus(previousRole)}` : null])

  return result
}

/** Delivery / pickup fulfillment. */
export function formatFulfillmentAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('fulfillment')

  const orderNumber = pick(context, details, ['order_number'])
  const method = pick(context, details, ['fulfillment_method', 'method', 'delivery_method'])
  const courier = pick(context, details, ['courier'])
  const tracking = pick(context, details, ['tracking_number'])
  const confirmation = pick(context, details, ['confirmation_method'])
  const from = text(log.previous_status)
  const to = text(log.new_status)

  const label = orderNumber ? `Order ${orderNumber}` : 'the order'

  if (log.action === 'CONFIRM_DELIVERY') {
    result.title = 'Delivery Confirmed'
    result.tone = 'success'
    result.description = `Delivery for ${label} was confirmed${
      confirmation ? ` via ${humanizeField(confirmation)}` : ''
    }.`
  } else if (from && to && from !== to) {
    result.title = 'Fulfillment Updated'
    result.tone = 'gold'
    result.description = `Fulfillment for ${label} changed from ${formatStatus(from)} → ${formatStatus(to)}.`
  } else {
    result.title = 'Fulfillment Updated'
    result.description = `Fulfillment details for ${label} were updated.`
  }

  if (orderNumber) result.entity = { label: 'Order', value: orderNumber, mono: true }

  const metadata = []
  if (method) metadata.push({ label: 'Fulfillment Method', value: humanizeField(method) })
  if (courier) metadata.push({ label: 'Courier', value: courier })
  if (tracking) metadata.push({ label: 'Tracking Number', value: tracking, mono: true })
  if (confirmation) metadata.push({ label: 'Confirmation Method', value: humanizeField(confirmation) })
  result.metadata = metadata

  result.secondary = joinFacts([orderNumber, method, tracking, from && to ? `${formatStatus(from)} → ${formatStatus(to)}` : null])

  if (from && to && from !== to) {
    result.change = { label: 'Fulfillment Status', from: formatStatus(from), to: formatStatus(to), delta: null }
  }

  return result
}

/** Point-of-sale receipts, voids and returns. */
export function formatPosAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult('pos')

  const saleNumber = pick(context, details, ['sale_number'])
  const amount = money(pick(context, details, ['amount', 'total_amount', 'refund_amount']))
  const method = paymentMethodLabel(pick(context, details, ['payment_method', 'method']))
  const reason = pick(context, details, ['void_reason', 'return_reason', 'reason'])
  const customerName = pick(context, details, ['customer_name'])
  const itemCount = pick(context, details, ['item_count', 'returned_item_count'])
  const from = text(log.previous_status)
  const to = text(log.new_status)
  const label = saleNumber ? `Sale ${saleNumber}` : 'the POS sale'

  if (log.action === 'SALE_RECORDED') {
    result.title = 'POS Sale Recorded'
    result.tone = 'success'
    result.description = `${label}${amount ? ` for ${amount}` : ''} was rung up${
      method ? ` and paid via ${method}` : ''
    }${itemCount ? ` (${itemCount} item${Number(itemCount) === 1 ? '' : 's'})` : ''}.`
  } else if (log.action === 'VOID') {
    result.title = 'POS Sale Voided'
    result.tone = 'danger'
    result.description = `${label}${amount ? ` (${amount})` : ''} was voided.`
  } else if (log.action === 'RETURN') {
    result.title = 'POS Return Processed'
    result.tone = 'gold'
    result.description = `A return was processed for ${label}${amount ? ` (${amount})` : ''}.`
  } else if (from && to && from !== to) {
    result.title = 'POS Sale Updated'
    result.tone = 'gold'
    result.description = `${label} changed from ${formatStatus(from)} → ${formatStatus(to)}.`
  } else {
    result.title = 'POS Sale Updated'
    result.description = `${label} was updated.`
  }

  if (saleNumber) result.entity = { label: 'Sale', value: saleNumber, mono: true }

  const metadata = []
  if (amount) metadata.push({ label: 'Amount', value: amount })
  if (method) metadata.push({ label: 'Payment Method', value: method })
  if (customerName) metadata.push({ label: 'Customer', value: customerName })
  if (itemCount) metadata.push({ label: 'Items', value: String(itemCount) })
  if (reason) metadata.push({ label: 'Reason', value: text(reason) })
  result.metadata = metadata

  result.secondary = joinFacts([saleNumber, amount, method, customerName])

  return result
}

/** Generic fallback for modules without a dedicated formatter. */
function formatGenericAudit(log = {}) {
  const context = getContext(log)
  const details = getDetails(log)
  const result = emptyResult(String(log.entity_type || 'record'))

  const noun = formatEntityNoun(log.entity_type)
  const changeList = getChangeList(log)
  const from = text(log.previous_status)
  const to = text(log.new_status)
  const action = String(log.action || '').toUpperCase()

  if (action === 'INSERT') {
    result.title = 'Created'
    result.tone = 'success'
    result.description = `${noun} was created.`
  } else if (action === 'DELETE') {
    result.title = 'Deleted'
    result.tone = 'danger'
    result.description = `${noun} was deleted.`
  } else if (from && to && from !== to) {
    result.title = 'Status Updated'
    result.tone = 'gold'
    result.description = `${noun} status changed from ${formatStatus(from)} → ${formatStatus(to)}.`
    result.change = { label: `${formatEntityType(log.entity_type)} Status`, from: formatStatus(from), to: formatStatus(to), delta: null }
  } else if (changeList.length) {
    result.title = 'Updated'
    result.description = `${noun}: ${changeList.map(describeChange).join('; ')}.`
  } else {
    result.title = formatActionLabel(log.action)
    result.description = `${noun} was updated. No field details were recorded for this entry.`
  }

  const metadata = []
  const label = pick(context, details, ['name', 'title', 'reason', 'notes'])
  if (label) metadata.push({ label: 'Details', value: text(label) })
  result.metadata = metadata
  result.secondary = changeList.length ? changeList.map(describeChange).join(' · ') : ''

  return result
}

/* ─── Dispatch ──────────────────────────────────────────────────────────── */

const FORMATTERS = {
  payment: formatPaymentAudit,
  payments: formatPaymentAudit,
  inventory: formatInventoryAudit,
  order: formatOrderAudit,
  orders: formatOrderAudit,
  project: formatProjectAudit,
  projects: formatProjectAudit,
  products: formatProductAudit,
  product: formatProductAudit,
  guitar_builder_parts: formatProductAudit,
  refund: formatRefundAudit,
  refunds: formatRefundAudit,
  appointment: formatAppointmentAudit,
  appointments: formatAppointmentAudit,
  appointment_schedule: formatScheduleAudit,
  users: formatUserAudit,
  user: formatUserAudit,
  rbac: formatUserAudit,
  fulfillment: formatFulfillmentAudit,
  pos: formatPosAudit,
}

/**
 * Single entry point used by both the table and the details modal.
 * Adding a new module means adding a formatter here — no JSX changes.
 */
export function formatAuditEntry(log = {}) {
  const module = String(log.entity_type || '').toLowerCase()
  const formatter = FORMATTERS[module] || formatGenericAudit
  const result = formatter(log)

  return {
    ...result,
    // Fallbacks so the modal always has a headline and a sentence.
    title: result.title || formatActionLabel(log.action),
    description: result.description || `${formatEntityNoun(log.entity_type)} activity was recorded.`,
    moduleLabel: formatEntityType(log.entity_type),
  }
}

/* ─── Small shared utilities used by formatters ─────────────────────────── */

function describeChange(entry) {
  if (!entry) return ''
  if (entry.from && entry.to) return `${entry.label} changed from ${entry.from} → ${entry.to}${entry.delta ? ` (${entry.delta})` : ''}`
  if (entry.to) return `${entry.label} set to ${entry.to}`
  return `${entry.label} updated`
}

function describeChangeObject(entry) {
  if (!entry) return null
  return { label: entry.label, from: entry.from, to: entry.to, delta: entry.delta }
}

const shortId = (value) => {
  const raw = text(value)
  if (!raw) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(raw) ? raw.slice(0, 8).toUpperCase() : raw
}

/**
 * `2026-11-11` → `November 11, 2026`.
 *
 * Built from the year/month/day parts rather than `new Date(raw)`, because that
 * parses as UTC midnight and would show the previous day west of Greenwich.
 */
function formatScheduleDate(value) {
  const raw = text(value)
  if (!raw) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (!match) return raw
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}