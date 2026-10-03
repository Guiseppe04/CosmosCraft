/**
 * auditContext.js
 *
 * Pure helpers that turn whatever a service knows at the moment an event happens
 * into the normalised context CosmosCraft stores alongside every audit row:
 *
 *   context  - "which order / project / customer / product is this about?"
 *   changes  - field level before/after pairs
 *
 * Nothing here touches the database, so the rules are unit-testable and can be
 * reused by any service. auditService.js is the only writer.
 */

/**
 * Keys that must never reach the audit trail. Matched case-insensitively and
 * as substrings so `new_password`, `refreshToken`, `x-api-key` etc. are all
 * caught. Audit logs are readable by every staff account, so this is enforced
 * centrally rather than at each call site.
 */
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passwd',
  'secret',
  'token',
  'jwt',
  'authorization',
  'auth_header',
  'api_key',
  'apikey',
  'access_key',
  'private_key',
  'credential',
  'session_id',
  'cookie',
  'cvv',
  'cvc',
  'card_number',
  'credit_card',
  'gcash_number',
  'otp',
  'pin',
  'salt',
  'hashed_password',
  'password_hash',
  'ssn',
];

/** Fields that change on every write and would only add noise to the trail. */
const NOISE_FIELDS = new Set([
  'updated_at',
  'created_at',
  'deleted_at',
  'modified_at',
  'last_login',
  'last_login_at',
  'version',
  'row_version',
]);

const REDACTED = '[redacted]';

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

const isEmptyValue = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '');

const isSensitiveKey = (key) => {
  const normalized = String(key).toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
};

/**
 * Recursively strips sensitive keys from an arbitrary payload.
 * Cycles are tolerated; oversized payloads are truncated rather than dropped.
 */
function redactDetails(value, depth = 0) {
  if (depth > 6) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactDetails(item, depth + 1));
  }

  if (isPlainObject(value)) {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        output[key] = REDACTED;
        continue;
      }
      output[key] = redactDetails(item, depth + 1);
    }
    return output;
  }

  if (typeof value === 'string') {
    return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  }

  return value;
}

/**
 * Removes empty values so the UI can simply hide whatever is missing instead of
 * rendering "—" for fields that were never captured.
 */
function compactContext(context = {}) {
  const output = {};
  for (const [key, value] of Object.entries(context)) {
    if (isEmptyValue(value)) continue;
    if (isPlainObject(value)) {
      const nested = compactContext(value);
      if (Object.keys(nested).length > 0) output[key] = nested;
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) output[key] = value;
      continue;
    }
    output[key] = value;
  }
  return output;
}

/**
 * Field level before/after diff.
 * Only fields whose value actually changed are kept, so a UI can render
 * "Order status: Processing → Completed" without guessing.
 */
function buildChanges(before, after, { fields } = {}) {
  const beforeObj = isPlainObject(before) ? before : {};
  const afterObj = isPlainObject(after) ? after : {};
  const candidates = new Set([
    ...Object.keys(beforeObj),
    ...Object.keys(afterObj),
    ...(fields || []),
  ]);

  const changes = {};

  for (const field of candidates) {
    if (NOISE_FIELDS.has(field)) continue;

    const from = beforeObj[field];
    const to = afterObj[field];

    if (isEmptyValue(from) && isEmptyValue(to)) continue;
    if (from === undefined && isEmptyValue(to)) continue;
    if (to === undefined && from === undefined) continue;
    if (String(from ?? '') === String(to ?? '')) continue;

    changes[field] = { from: isEmptyValue(from) ? null : from, to: isEmptyValue(to) ? null : to };
  }

  return changes;
}

/**
 * Flattened text used by server-side search. Business identifiers, names and
 * reason text are all searchable, so "PO-20261002-0003" or "Juan" finds the row.
 */
function buildSearchText({ action, entity_type, entity_id, previous_status, new_status, context, changes, details }) {
  const parts = [action, entity_type, entity_id, previous_status, new_status];

  const walk = (value, depth = 0) => {
    if (depth > 4 || value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (isPlainObject(value)) {
      Object.values(value).forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof value === 'string') parts.push(value);
    else if (typeof value === 'number') parts.push(String(value));
  };

  walk(context);
  walk(changes);
  walk(details);

  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .slice(0, 8000);
}

/* ─── Domain context builders ───────────────────────────────────────────────
 * Each builder accepts a loose object so call sites can pass whatever they
 * already have; unknown/absent fields are simply dropped by compactContext().
 * ------------------------------------------------------------------------- */

/** Order + customer context shared by payments, refunds, fulfilment, projects. */
function orderContext({
  orderId,
  orderNumber,
  orderType,
  orderStatus,
  previousStatus,
  paymentStatus,
  totalAmount,
  customerId,
  customerName,
  customerEmail,
  customerPhone,
} = {}) {
  return compactContext({
    order_id: orderId,
    order_number: orderNumber,
    order_type: orderType,
    order_status: orderStatus,
    previous_status: previousStatus,
    payment_status: paymentStatus,
    order_total: totalAmount,
    customer_id: customerId,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
  });
}

/** Custom guitar build / project context. */
function projectContext({
  projectId,
  projectNumber,
  customBuildId,
  projectTitle,
  projectStatus,
  progressPercent,
  orderId,
  orderNumber,
  customerName,
  bodyModel,
  pickupAppointmentId,
} = {}) {
  return compactContext({
    project_id: projectId,
    project_number: projectNumber || customBuildId,
    project_title: projectTitle,
    project_status: projectStatus,
    progress_percent: progressPercent,
    order_id: orderId,
    order_number: orderNumber,
    customer_name: customerName,
    body_model: bodyModel,
    pickup_appointment_id: pickupAppointmentId,
  });
}

/**
 * Payment context. `paymentId` is the real payment row; `orderNumber` is what
 * lets an administrator tie the payment back to a transaction.
 */
function paymentContext({
  paymentId,
  amount,
  currency,
  method,
  referenceNumber,
  rejectionReason,
  paymentStatus,
  paymentType,
  installmentNumber,
  proofProvided,
  orderId,
  orderNumber,
  orderType,
  customerName,
  customerEmail,
  projectId,
  projectNumber,
  appointmentId,
  appointmentNumber,
} = {}) {
  return compactContext({
    payment_id: paymentId,
    amount,
    currency,
    payment_method: method,
    reference_number: referenceNumber,
    rejection_reason: rejectionReason,
    payment_status: paymentStatus,
    payment_type: paymentType,
    installment_number: installmentNumber,
    proof_uploaded: proofProvided,
    order_id: orderId,
    order_number: orderNumber,
    order_type: orderType,
    customer_name: customerName,
    customer_email: customerEmail,
    project_id: projectId,
    project_number: projectNumber,
    appointment_id: appointmentId,
    appointment_number: appointmentNumber,
  });
}

/** Product / guitar part context. */
function productContext({ productId, name, sku, price, stock, category } = {}) {
  return compactContext({
    product_id: productId,
    product_name: name,
    sku,
    price,
    stock,
    category,
  });
}

/**
 * Stock movement context. `movement` is the human-meaningful direction
 * (added / deducted / restored / reserved / released / adjusted) and `source`
 * explains what caused it (order, pos_sale, return, refund, manual...).
 */
function inventoryContext({
  productId,
  productName,
  sku,
  previousQuantity,
  newQuantity,
  delta,
  movement,
  source,
  sourceId,
  sourceNumber,
  saleNumber,
  reason,
  orderNumber,
  projectId,
  projectNumber,
} = {}) {
  return compactContext({
    product_id: productId,
    product_name: productName,
    sku,
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    quantity_change: delta,
    movement,
    source,
    source_id: sourceId,
    source_number: sourceNumber || saleNumber,
    reason,
    order_number: orderNumber,
    project_id: projectId,
    project_number: projectNumber,
  });
}

/** Refund request context. */
function refundContext({
  refundId,
  refundNumber,
  orderId,
  orderNumber,
  projectId,
  amount,
  approvedAmount,
  refundType,
  refundStatus,
  reason,
  rejectionReason,
  customerNotes,
  customerName,
} = {}) {
  return compactContext({
    refund_id: refundId,
    refund_number: refundNumber,
    order_id: orderId,
    order_number: orderNumber,
    project_id: projectId,
    refund_amount: amount,
    approved_amount: approvedAmount,
    refund_type: refundType,
    refund_status: refundStatus,
    reason,
    rejection_reason: rejectionReason,
    customer_notes: customerNotes,
    customer_name: customerName,
  });
}

/**
 * Appointment context.
 *
 * `appointmentNumber` and `referenceCode` are both accepted because the shop
 * quotes the human-facing reference code to customers while the internal booking
 * number appears on older records; whichever is known is kept.
 */
function appointmentContext({
  appointmentId,
  appointmentNumber,
  referenceCode,
  appointmentType,
  customerName,
  customerEmail,
  appointmentStatus,
  previousStatus,
  scheduledAt,
  serviceName,
  amount,
  paymentMethod,
  paymentStatus,
  contactNumber,
  reason,
} = {}) {
  return compactContext({
    appointment_id: appointmentId,
    appointment_number: appointmentNumber,
    reference_code: referenceCode,
    appointment_type: appointmentType,
    customer_name: customerName,
    customer_email: customerEmail,
    appointment_status: appointmentStatus,
    previous_status: previousStatus,
    scheduled_at: scheduledAt,
    service_name: serviceName,
    amount,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    contact_number: contactNumber,
    reason,
  });
}

/**
 * Booking-schedule context: a date the shop will not accept bookings on, or a
 * holiday that was reopened. The date itself is the human-readable identifier
 * (there is no booking number), so it travels with the audit row and is what an
 * admin searches for later.
 */
function scheduleContext({
  date,
  reason,
  previousReason,
  closureType,
  isOpenOverride,
  isRecurring,
  affectedDate,
} = {}) {
  return compactContext({
    date,
    reason,
    previous_reason: previousReason,
    closure_type: closureType,
    is_open_override: isOpenOverride,
    is_recurring: isRecurring,
    affected_date: affectedDate,
  });
}

/** Point-of-sale receipt / void / return context. */
function posContext({
  saleId,
  saleNumber,
  amount,
  refundAmount,
  totalAmount,
  subtotal,
  discountAmount,
  taxAmount,
  paymentMethod,
  paymentStatus,
  referenceNumber,
  voidReason,
  returnReason,
  returnedItemCount,
  itemCount,
  customerName,
  cashierName,
} = {}) {
  return compactContext({
    pos_sale_id: saleId,
    sale_number: saleNumber,
    amount: amount ?? totalAmount,
    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    refund_amount: refundAmount,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    reference_number: referenceNumber,
    void_reason: voidReason,
    return_reason: returnReason,
    returned_item_count: returnedItemCount,
    item_count: itemCount,
    customer_name: customerName,
    cashier_name: cashierName,
  });
}

/** Affected user for RBAC / profile changes. */
function userContext({ userId, fullName, email, role, previousRole, phone } = {}) {
  return compactContext({
    affected_user_id: userId,
    affected_user_name: fullName,
    affected_user_email: email,
    role,
    previous_role: previousRole,
    phone,
  });
}

/** Delivery / pickup context. */
function fulfillmentContext({
  requestId,
  method,
  status,
  previousStatus,
  courier,
  trackingNumber,
  address,
  scheduledAt,
  confirmationMethod,
  orderNumber,
  orderId,
  customerName,
} = {}) {
  return compactContext({
    fulfillment_request_id: requestId,
    fulfillment_method: method,
    fulfillment_status: status,
    previous_status: previousStatus,
    courier,
    tracking_number: trackingNumber,
    delivery_address: address,
    scheduled_at: scheduledAt,
    confirmation_method: confirmationMethod,
    order_number: orderNumber,
    order_id: orderId,
    customer_name: customerName,
  });
}

module.exports = {
  REDACTED,
  redactDetails,
  compactContext,
  buildChanges,
  buildSearchText,
  orderContext,
  projectContext,
  paymentContext,
  productContext,
  inventoryContext,
  refundContext,
  appointmentContext,
  scheduleContext,
  posContext,
  userContext,
  fulfillmentContext,
};