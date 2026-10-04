/**
 * Human-readable presentation helpers for the admin Audit Logs screen.
 *
 * The audit log stores technical values (snake_case module names, database
 * actions, status constants, JSON payloads). These helpers turn those values
 * into plain language for the UI without changing anything that is stored or
 * returned by the API.
 */
import { formatPaymentMethod } from './paymentMethodUtils'

/* ─── Lookups ──────────────────────────────────────────────────────────── */

const ENTITY_TYPE_LABELS = {
  project: 'Project',
  projects: 'Project',
  order: 'Order',
  orders: 'Order',
  payment: 'Payment',
  payments: 'Payment',
  refund: 'Refund',
  refunds: 'Refund',
  refund_request: 'Refund Request',
  fulfillment: 'Fulfillment',
  pos: 'POS',
  pos_sale: 'POS Sale',
  products: 'Product',
  product: 'Product',
  guitar_builder_parts: 'Guitar Part',
  guitar_parts: 'Guitar Part',
  services: 'Service',
  service: 'Service',
  users: 'User',
  user: 'User',
  appointments: 'Appointment',
  appointment: 'Appointment',
  appointment_schedule: 'Booking Schedule',
  cart: 'Cart',
  customizations: 'Customization',
  customization: 'Customization',
  inventory: 'Inventory',
  rbac: 'Role & Permission',
  settings: 'Setting',
  notifications: 'Notification',
}

const STATUS_LABELS = {
  in_progress: 'In Progress',
  pending_payment_verification: 'Payment Verification Pending',
  refund_processing: 'Refund Processing',
  refund_requested: 'Refund Requested',
  refund_approved: 'Refund Approved',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  completed: 'Completed',
  on_hold: 'On Hold',
  not_started: 'Not Started',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  processing: 'Processing',
  delivered: 'Delivered',
  shipped: 'Shipped',
  received: 'Received',
  out_for_delivery: 'Out for Delivery',
  ready_for_pickup: 'Ready for Pickup',
  paid: 'Paid',
  failed: 'Failed',
  voided: 'Voided',
  returned: 'Returned',
  confirmed: 'Confirmed',
  verified: 'Verified',
  proof_submitted: 'Proof Submitted',
  under_review: 'Under Review',
  active: 'Active',
  inactive: 'Inactive',
  claimed: 'Claimed',
  unclaimed: 'Unclaimed',
  assigned: 'Assigned',
}

const ACTION_LABELS = {
  BUILD_SENT_TO_CUSTOMER: 'Build Sent to Customer',
  INSERT: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  LOGIN_ATTEMPT: 'Login Attempt',
  LOGOUT: 'Logout',
  VERIFY: 'Verified',
  REJECT: 'Rejected',
  REFUND: 'Refunded',
  CANCEL: 'Cancelled',
  EXPORT: 'Exported',
  PASSWORD_RESET: 'Password Reset',
  STOCK_ALERT: 'Stock Alert',
  STOCK_MOVEMENT: 'Stock Movement',
  VOID: 'Voided',
  RETURN: 'Return Processed',
  PAYMENT: 'Payment',
  CONFIRM_DELIVERY: 'Delivery Confirmed',
  BACKFILL_STATUS: 'Status Backfilled',
  milestone_updated: 'Milestone Updated',
  subtask_status_changed: 'Task Status Changed',
  project_claimed: 'Project Claimed',
  project_cancelled: 'Project Cancelled',
  project_resumed: 'Project Resumed',
  project_part_received: 'Part Received',
  project_part_unreceived: 'Part Marked Missing',
  hold_requested: 'Hold Requested',
  hold_approved: 'Hold Approved',
  hold_rejected: 'Hold Rejected',
  cancel_requested: 'Cancellation Requested',
  cancel_request_withdrawn: 'Cancellation Withdrawn',
  cancel_approved: 'Cancellation Approved',
  cancel_rejected: 'Cancellation Rejected',
  refund_requested: 'Refund Requested',
  refund_approved: 'Refund Approved',
  refund_processing: 'Refund Processing',
  refund_refunded: 'Refund Completed',
  refund_rejected: 'Refund Rejected',
  refund_withdrawn: 'Refund Withdrawn',
  refund_pending_payment_verified: 'Refund Payment Verified',
  refund_pending_payment_rejected: 'Refund Payment Rejected',
  build_claim_created: 'Build Claim Created',
  build_claim_received: 'Build Claim Received',
  build_claim_status_updated: 'Build Claim Updated',
  build_claim_courier_arranged: 'Delivery Arranged',
  build_released: 'Build Released',
  fulfillment_updated: 'Fulfillment Updated',
  workflow_initialized: 'Workflow Initialized',
}

/**
 * Appointment actions are generated from the target status
 * (`APPOINTMENT_CONFIRMED`, `APPOINTMENT_CANCELLED`, …), so they are matched by
 * prefix instead of being listed one by one.
 */
const APPOINTMENT_ACTION_LABELS = {
  PENDING: 'Appointment Booked',
  CONFIRMED: 'Appointment Confirmed',
  IN_PROGRESS: 'Appointment Started',
  READY_FOR_PICKUP: 'Ready for Pickup',
  COMPLETED: 'Appointment Completed',
  CANCELLED: 'Appointment Cancelled',
  CANCELED: 'Appointment Cancelled',
  NO_SHOW: 'Marked No-Show',
  RESCHEDULED: 'Appointment Rescheduled',
}

/**
 * Booking-calendar actions. These close or reopen a date rather than touching a
 * booking, so they are listed explicitly instead of sharing the appointment
 * status labels above.
 */
const SCHEDULE_ACTION_LABELS = {
  SCHEDULE_DATE_CLOSED: 'Booking Date Closed',
  SCHEDULE_DATE_RECLOSED: 'Booking Date Re-closed',
  SCHEDULE_DATE_REOPENED: 'Booking Date Reopened',
  SCHEDULE_HOLIDAY_REOPENED: 'Holiday Reopened for Bookings',
  SCHEDULE_HOLIDAY_RECLOSED: 'Holiday Closed Again',
}

/**
 * How each action reads inside a sentence.
 * `subject` overrides the entity noun; `standalone` omits it entirely.
 */
const ACTION_PHRASES = {
  INSERT: { verb: 'created', useEntity: true },
  UPDATE: { verb: 'updated', useEntity: true },
  DELETE: { verb: 'deleted', useEntity: true },
  VERIFY: { verb: 'verified', useEntity: true },
  REJECT: { verb: 'rejected', useEntity: true },
  CANCEL: { verb: 'cancelled', useEntity: true },
  REFUND: { verb: 'refunded', useEntity: true },
  VOID: { verb: 'voided', useEntity: true },
  RETURN: { verb: 'processed a return for', useEntity: true },
  STOCK_ALERT: { verb: 'logged a stock alert for', useEntity: true },
  EXPORT: { verb: 'exported', subject: 'a report' },
  PASSWORD_RESET: { verb: 'reset the password for', subject: 'a user' },
  LOGIN_ATTEMPT: { verb: 'attempted to sign in', standalone: true },
  LOGOUT: { verb: 'signed out', standalone: true },
  STOCK_MOVEMENT: { verb: 'adjusted stock for', subject: 'a product' },
  PAYMENT: { verb: 'recorded a payment for', useEntity: true },
  CONFIRM_DELIVERY: { verb: 'confirmed delivery of', subject: 'a fulfillment' },
  milestone_updated: { verb: 'updated', subject: 'a milestone' },
  subtask_status_changed: { verb: 'changed the status of', subject: 'a task' },
  project_claimed: { verb: 'claimed', useEntity: true },
  project_cancelled: { verb: 'cancelled', useEntity: true },
  project_resumed: { verb: 'resumed', useEntity: true },
  project_part_received: { verb: 'received a part for', useEntity: true },
  project_part_unreceived: { verb: 'marked a part missing on', useEntity: true },
  hold_requested: { verb: 'requested', subject: 'a hold' },
  hold_approved: { verb: 'approved', subject: 'a hold' },
  hold_rejected: { verb: 'rejected', subject: 'a hold' },
  cancel_requested: { verb: 'requested', subject: 'a cancellation' },
  cancel_request_withdrawn: { verb: 'withdrew', subject: 'a cancellation request' },
  cancel_approved: { verb: 'approved', subject: 'a cancellation' },
  cancel_rejected: { verb: 'rejected', subject: 'a cancellation' },
  refund_requested: { verb: 'requested', subject: 'a refund' },
  refund_approved: { verb: 'approved', subject: 'a refund' },
  refund_rejected: { verb: 'rejected', subject: 'a refund' },
  refund_withdrawn: { verb: 'withdrew', subject: 'a refund' },
  refund_processing: { verb: 'started processing', subject: 'a refund' },
  refund_refunded: { verb: 'completed', subject: 'a refund' },
  refund_pending_payment_verified: { verb: 'verified the refund payment for', subject: 'a refund' },
  refund_pending_payment_rejected: { verb: 'rejected the refund payment for', subject: 'a refund' },
  build_claim_created: { verb: 'created', subject: 'a build claim' },
  build_claim_received: { verb: 'marked received', subject: 'a build claim' },
  build_claim_status_updated: { verb: 'updated', subject: 'a build claim' },
  build_claim_courier_arranged: { verb: 'arranged', subject: 'delivery' },
  build_released: { verb: 'released', useEntity: true },
  fulfillment_updated: { verb: 'updated', subject: 'fulfillment' },
  workflow_initialized: { verb: 'initialized the workflow for', useEntity: true },
}

/** Verb per generated appointment action, e.g. APPOINTMENT_CONFIRMED. */
const APPOINTMENT_ACTION_PHRASES = {
  PENDING: 'booked',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'started',
  READY_FOR_PICKUP: 'marked ready for pickup',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CANCELED: 'cancelled',
  NO_SHOW: 'marked as a no-show',
  RESCHEDULED: 'rescheduled',
}

/** Trailing-token fallbacks for actions that are not listed above. */
const VERB_SUFFIXES = {
  created: 'created',
  inserted: 'created',
  updated: 'updated',
  changed: 'changed',
  edited: 'updated',
  deleted: 'deleted',
  removed: 'deleted',
  approved: 'approved',
  rejected: 'rejected',
  verified: 'verified',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  resumed: 'resumed',
  claimed: 'claimed',
  requested: 'requested',
  processed: 'processed',
  assigned: 'assigned',
  paid: 'recorded payment for',
  voided: 'voided',
  returned: 'processed a return for',
  refunded: 'refunded',
  exported: 'exported',
}

/**
 * Business identifiers captured in `log.context` by the server.
 *
 * These are preferred over raw UUIDs because they are what staff actually
 * recognise: an order number, a refund number, an appointment reference code, a
 * sale number or a part SKU. The order here is the preference order.
 */
const CONTEXT_IDENTIFIERS = [
  { key: 'order_number', label: 'Order' },
  { key: 'refund_number', label: 'Refund' },
  { key: 'reference_code', label: 'Appointment' },
  { key: 'appointment_number', label: 'Appointment' },
  { key: 'sale_number', label: 'Sale' },
  { key: 'project_number', label: 'Project' },
  { key: 'tracking_number', label: 'Tracking' },
  { key: 'reference_number', label: 'Reference' },
  { key: 'sku', label: 'SKU' },
]

/** Readable rows for the normalised `context` column. */
const CONTEXT_FIELDS = [
  { keys: ['order_number'], label: 'Order', kind: 'text', previewLabel: 'Order' },
  { keys: ['order_status', 'payment_status', 'order_total'], label: 'Order Status', kind: 'status' },
  { keys: ['order_type'], label: 'Order Type', kind: 'text' },
  { keys: ['project_number'], label: 'Project', kind: 'text', previewLabel: 'Project' },
  { keys: ['project_title', 'body_model'], label: 'Build', kind: 'text' },
  { keys: ['project_status'], label: 'Project Status', kind: 'status' },
  { keys: ['refund_number'], label: 'Refund', kind: 'text', previewLabel: 'Refund' },
  { keys: ['refund_amount', 'approved_amount', 'amount', 'order_total'], label: 'Amount', kind: 'currency' },
  { keys: ['refund_status', 'payment_status'], label: 'Status', kind: 'status' },
  { keys: ['refund_type', 'appointment_type', 'payment_type'], label: 'Type', kind: 'text' },
  { keys: ['reference_code', 'appointment_number'], label: 'Reference', kind: 'text', previewLabel: 'Ref' },
  { keys: ['sale_number'], label: 'Sale', kind: 'text', previewLabel: 'Sale' },
  { keys: ['scheduled_at'], label: 'Scheduled', kind: 'datetime' },
  { keys: ['payment_method', 'fulfillment_method', 'confirmation_method'], label: 'Method', kind: 'method' },
  { keys: ['product_name'], label: 'Product', kind: 'text', previewLabel: 'Product' },
  { keys: ['sku'], label: 'SKU', kind: 'text', previewLabel: 'SKU' },
  { keys: ['stock', 'previous_quantity', 'new_quantity', 'quantity_change'], label: 'Stock', kind: 'text' },
  { keys: ['movement', 'source'], label: 'Reason', kind: 'text' },
  { keys: ['reason', 'void_reason', 'return_reason', 'rejection_reason', 'adjustment_reason'], label: 'Note', kind: 'text' },
  { keys: ['customer_name'], label: 'Customer', kind: 'text', previewLabel: 'Customer' },
  { keys: ['customer_email'], label: 'Customer Email', kind: 'text' },
  { keys: ['customer_phone', 'contact_number'], label: 'Contact', kind: 'text' },
  { keys: ['role', 'previous_role'], label: 'Role', kind: 'status' },
  { keys: ['price', 'category'], label: 'Product', kind: 'text' },
]

/** Human names carried in the payload. Record identifiers are never taken from
 * the payload — the audit row's own entity ID is used instead (see
 * `formatEntityId`), because it is unique for every module.
 */
const SUBJECT_FIELDS = [
  { keys: ['project_name', 'project_title', 'project'], label: 'Project' },
  { keys: ['product_name', 'product_title'], label: 'Product' },
  { keys: ['part_name', 'guitar_name'], label: 'Guitar Part' },
  { keys: ['service_name'], label: 'Service' },
  { keys: ['customer_name', 'customer_full_name', 'customer'], label: 'Customer' },
  { keys: ['name', 'title'], label: null },
]

/** Readable rows for the detail modal / table preview.
 * `previewLabel` prefixes the value in the compact table preview; without it the
 * value is shown on its own (e.g. "GCash", "₱1,500").
 */
const DETAIL_FIELDS = [
  { keys: ['project_name', 'project_title', 'project'], label: 'Project', previewLabel: 'Project' },
  { keys: ['product_name', 'product_title'], label: 'Product', previewLabel: 'Product' },
  { keys: ['part_name', 'guitar_name'], label: 'Guitar Part', previewLabel: 'Guitar Part' },
  { keys: ['service_name'], label: 'Service', previewLabel: 'Service' },
  { keys: ['customer_name', 'customer_full_name', 'customer'], label: 'Customer', previewLabel: 'Customer' },
  { keys: ['payment_method', 'payment_mode'], label: 'Payment Method', kind: 'method' },
  { keys: ['refund_amount', 'refunded_amount', 'approved_amount', 'refundable_amount'], label: 'Refund Amount', kind: 'currency' },
  { keys: ['amount', 'total_amount', 'grand_total', 'subtotal', 'price'], label: 'Amount', kind: 'currency' },
  { keys: ['fulfillment_method', 'delivery_method', 'method'], label: 'Fulfillment Method', kind: 'text' },
  { keys: ['courier', 'courier_name'], label: 'Courier', kind: 'text' },
  { keys: ['tracking_number', 'tracking_no'], label: 'Tracking Number', kind: 'text', previewLabel: 'Tracking' },
  { keys: ['quantity', 'qty'], label: 'Quantity', kind: 'text', previewLabel: 'Qty' },
  { keys: ['sku', 'product_sku'], label: 'SKU', kind: 'text', previewLabel: 'SKU' },
  { keys: ['email'], label: 'Email', kind: 'text' },
  { keys: ['role'], label: 'Role', kind: 'status' },
  { keys: ['reason', 'remarks', 'notes', 'note', 'cancellation_reason', 'refund_reason'], label: 'Note', kind: 'text' },
]

/** Nouns that start with a vowel letter but are read with a consonant sound. */
const CONSONANT_SOUND_NOUNS = ['pos', 'user', 'update', 'unique', 'unit', 'one', 'eu']

/* ─── Generic helpers ───────────────────────────────────────────────────── */

const titleCase = (value) =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const singularize = (word) => {
  const lower = word.toLowerCase()
  if (/(ss|us|is)$/.test(lower)) return word
  if (/ies$/.test(lower) && lower.length > 4) return word.slice(0, -3) + 'y'
  if (/(ses|xes|zes|ches|shes)$/.test(lower)) return word.slice(0, -2)
  if (/s$/.test(lower)) return word.slice(0, -1)
  return word
}

const isBlank = (value) =>
  value === null || value === undefined || (typeof value === 'string' && !value.trim()) || typeof value === 'object'

const cleanText = (value) =>
  isBlank(value) || typeof value === 'object' ? '' : String(value).replace(/\s+/g, ' ').trim()

const indefiniteArticle = (noun) => {
  const lower = noun.toLowerCase()
  if (!lower) return 'a'
  const startsWithVowel = 'aeiou'.includes(lower[0])
  const soundsConsonant = CONSONANT_SOUND_NOUNS.some((entry) => lower.startsWith(entry))
  return startsWithVowel && !soundsConsonant ? 'an' : 'a'
}

export function formatAmount(value) {
  const amount = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(amount)) return ''
  const hasDecimals = !Number.isInteger(amount)
  return `₱${new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount)}`
}

/* ─── Label formatters ─────────────────────────────────────────────────── */

export function formatEntityType(entityType) {
  const raw = cleanText(entityType)
  if (!raw) return 'Record'
  const key = raw.toLowerCase()
  if (ENTITY_TYPE_LABELS[key]) return ENTITY_TYPE_LABELS[key]
  const words = key.split(' ').map(singularize)
  return titleCase(words.join(' '))
}

export function formatStatus(status) {
  const raw = cleanText(status)
  if (!raw) return '—'
  const key = raw.toLowerCase()
  if (STATUS_LABELS[key]) return STATUS_LABELS[key]
  return titleCase(key)
}

export function formatAction(action) {
  const raw = cleanText(action)
  if (!raw) return 'Activity'
  if (SCHEDULE_ACTION_LABELS[raw]) return SCHEDULE_ACTION_LABELS[raw]
  if (ACTION_LABELS[raw]) return ACTION_LABELS[raw]
  if (ACTION_LABELS[raw.toUpperCase()]) return ACTION_LABELS[raw.toUpperCase()]

  const appointmentMatch = /^APPOINTMENT_(.+)$/i.exec(raw)
  if (appointmentMatch) {
    const statusLabel = APPOINTMENT_ACTION_LABELS[appointmentMatch[1].toUpperCase()]
    if (statusLabel) return statusLabel
  }

  return titleCase(raw)
}

/** Human-readable module noun used inside activity sentences. */
export function formatEntityNoun(entityType) {
  const label = formatEntityType(entityType)
  // Keep acronyms readable ("POS") but lowercase everything else ("Guitar Part" → "guitar part")
  const noun = /^[A-Z]{2,}/.test(label) ? label : label.toLowerCase()
  return `${indefiniteArticle(noun)} ${noun}`
}

/** Canonical UUID, e.g. 8a92f3c1-4d5e-4f60-9a11-223344556677 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Formats the audit row's own entity identifier so it can be shown next to the
 * module label. Business identifiers ("PO-1024", "JV-2026-0007") are already
 * readable and kept verbatim; opaque UUIDs are shortened to their readable head.
 */
export function formatEntityId(entityId) {
  const raw = cleanText(entityId)
  if (!raw) return ''
  if (UUID_PATTERN.test(raw)) return raw.slice(0, 8).toUpperCase()
  return raw
}

/* ─── Actor ─────────────────────────────────────────────────────────────── */

export function getAuditActor(log = {}) {
  const name = cleanText(log.user_name)
  const email = cleanText(log.user_email)

  if (!name && !email) {
    return { name: 'System', subtitle: 'Automated System', initials: 'SY', isSystem: true }
  }

  const displayName = name || email
  let subtitle = 'No email on record'
  if (name && email) subtitle = email
  else if (!name) subtitle = 'Signed-in account'

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0].toUpperCase())
      .slice(0, 2)
      .join('') || 'SY'

  return { name: displayName, subtitle, initials, isSystem: false }
}

/* ─── Activity sentence ─────────────────────────────────────────────────── */

const resolvePhrase = (action) => {
  const raw = cleanText(action)
  if (!raw) return null
  if (ACTION_PHRASES[raw]) return ACTION_PHRASES[raw]
  if (ACTION_PHRASES[raw.toUpperCase()]) return ACTION_PHRASES[raw.toUpperCase()]

  const appointmentMatch = /^APPOINTMENT_(.+)$/i.exec(raw)
  if (appointmentMatch) {
    const verb = APPOINTMENT_ACTION_PHRASES[appointmentMatch[1].toUpperCase()]
    if (verb) return { verb, useEntity: true }
  }

  const lastToken = raw.toLowerCase().split(/[_\s-]+/).pop()
  const verb = VERB_SUFFIXES[lastToken]
  if (verb) return { verb, useEntity: true }

  return null
}

export function buildActivitySentence(log = {}) {
  const actor = getAuditActor(log).name
  const phrase = resolvePhrase(log.action)
  const entitySubject = formatEntityNoun(log.entity_type)

  if (!phrase) {
    const label = formatAction(log.action)
    const entity = log.entity_type ? entitySubject : ''
    return entity ? `${actor} performed ${label} on ${entity}` : `${actor} performed ${label}`
  }

  let subject = ''
  if (!phrase.standalone) {
    subject = phrase.subject || (log.entity_type ? entitySubject : 'a record')
  }

  return subject ? `${actor} ${phrase.verb} ${subject}` : `${actor} ${phrase.verb}`
}

/* ─── Details ───────────────────────────────────────────────────────────── */

/**
 * Audit payloads come in a few shapes: a flat object, or `{ old, new }` for
 * updates. Flatten them so field lookups work the same way everywhere.
 */
export function flattenAuditDetails(details) {
  if (!details || typeof details !== 'object') return {}

  const { old, new: next, ...rest } = details
  const flat = {}

  if (old && typeof old === 'object') Object.assign(flat, old)
  Object.assign(flat, rest)
  if (next && typeof next === 'object') Object.assign(flat, next)

  return flat
}

const firstValue = (flat, keys) => {
  for (const key of keys) {
    const value = flat[key]
    if (isBlank(value)) continue
    return { key, value }
  }
  return null
}

const formatDetailValue = (raw, kind) => {
  if (kind === 'currency') return formatAmount(raw)
  if (kind === 'method') return formatPaymentMethod(cleanText(raw).toLowerCase())
  if (kind === 'status') return formatStatus(raw)
  if (kind === 'datetime') return formatAuditTimestamp(raw).full
  return cleanText(raw)
}

/** The normalised context stored by the server, if the row has any. */
export function getAuditContext(log = {}) {
  return log.context && typeof log.context === 'object' && !Array.isArray(log.context) ? log.context : {}
}

/**
 * Human subject for a row: a business identifier from the captured context
 * first, then a name from the payload, then the formatted record id.
 */
export function getEntitySubject(log = {}) {
  const context = getAuditContext(log)

  for (const identifier of CONTEXT_IDENTIFIERS) {
    const value = cleanText(context[identifier.key])
    if (value) return { label: identifier.label, value, source: 'context' }
  }

  const flat = flattenAuditDetails(log.details)
  for (const field of SUBJECT_FIELDS) {
    const found = firstValue(flat, field.keys)
    if (!found) continue
    const value = cleanText(found.value)
    if (!value) continue
    return { label: field.label || formatEntityType(log.entity_type), value, source: 'details' }
  }

  // Nothing recognisable — fall back to the formatted record identifier.
  const entityId = formatEntityId(log.entity_id)
  if (entityId) return { label: formatEntityType(log.entity_type), value: entityId, source: 'entity_id' }

  return null
}

/**
 * Field level changes recorded with the event, e.g.
 * `{ status: { from: 'pending', to: 'verified' } }`.
 */
export function getChangeEntries(log = {}) {
  const changes = log.changes && typeof log.changes === 'object' && !Array.isArray(log.changes) ? log.changes : {}
  const entries = []

  for (const [field, value] of Object.entries(changes)) {
    if (!value || typeof value !== 'object') {
      const text = cleanText(value)
      if (text) entries.push({ label: titleCase(field), from: null, to: text })
      continue
    }

    const from = value.from
    const to = value.to
    const isStatusField = /status|state/i.test(field)
    const fromText = isStatusField ? formatStatus(from) : cleanText(from)
    const toText = isStatusField ? formatStatus(to) : cleanText(to)

    if (fromText === toText) continue
    entries.push({ label: titleCase(field), from: fromText, to: toText })
  }

  return entries
}

export function getDetailEntries(log = {}) {
  const context = getAuditContext(log)
  const flat = flattenAuditDetails(log.details)
  const subject = getEntitySubject(log)
  const entries = []
  const seen = new Set()

  // The subject identifier comes first; it is either a business identifier from
  // the context or the formatted record id.
  if (subject) {
    seen.add(subject.value.toLowerCase())
    entries.push({ label: subject.label, value: subject.value, previewLabel: subject.label, isIdentifier: true })
  } else {
    const entityId = formatEntityId(log.entity_id)
    if (entityId) {
      const entityLabel = formatEntityType(log.entity_type)
      seen.add(entityId.toLowerCase())
      entries.push({ label: entityLabel, value: entityId, previewLabel: entityLabel, isIdentifier: true })
    }
  }

  for (const field of CONTEXT_FIELDS) {
    const found = firstValue(context, field.keys)
    if (!found) continue

    const value = formatDetailValue(found.value, field.kind)
    if (!value || seen.has(value.toLowerCase())) continue
    if (subject && value.toLowerCase() === subject.value.toLowerCase()) continue

    seen.add(value.toLowerCase())
    entries.push({ label: field.label, value, previewLabel: field.previewLabel })
  }

  for (const field of DETAIL_FIELDS) {
    const found = firstValue(flat, field.keys)
    if (!found) continue

    const value = formatDetailValue(found.value, field.kind)
    // Skip blanks, repeats, and the name already shown as the subject line.
    if (!value || seen.has(value.toLowerCase())) continue
    if (subject && value.toLowerCase() === subject.value.toLowerCase()) continue

    seen.add(value.toLowerCase())
    entries.push({ label: field.label, value, previewLabel: field.previewLabel })
  }

  return entries
}

export function getDetailPreview(log = {}, limit = 4) {
  const entries = getDetailEntries(log)
  if (!entries.length) return 'No additional details'
  return entries
    .slice(0, limit)
    .map((entry) => (entry.previewLabel ? `${entry.previewLabel} ${entry.value}` : entry.value))
    .join(' · ')
}

/* ─── Dates ─────────────────────────────────────────────────────────────── */

export function formatRelativeTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'

  const plural = (value, unit) => `${value} ${unit}${value === 1 ? '' : 's'} ago`

  if (seconds < 3600) return plural(Math.floor(seconds / 60), 'minute')
  if (seconds < 86400) return plural(Math.floor(seconds / 3600), 'hour')
  if (seconds < 2592000) return plural(Math.floor(seconds / 86400), 'day')

  const months = Math.floor(seconds / (2592000))
  return plural(months, 'month')
}

export function formatAuditTimestamp(value) {
  const fallback = { date: '—', time: '', relative: '', full: 'Unknown date and time' }
  if (!value) return fallback

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { ...fallback, date: String(value) }

  return {
    date: date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
    relative: formatRelativeTime(date),
    full: date.toLocaleString('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  }
}

export { ACTION_LABELS }
