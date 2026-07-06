export const PAYMENT_STATUS_LIFECYCLE = [
  { value: 'pending', label: 'Pending', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
  { value: 'proof_submitted', label: 'Proof Submitted', color: '#60a5fa', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
  { value: 'under_review', label: 'Under Review', color: '#8b5cf6', bgColor: 'bg-violet-500/20', textColor: 'text-violet-400', borderColor: 'border-violet-500/30' },
  { value: 'approved', label: 'Approved', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  { value: 'rejected', label: 'Rejected', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  { value: 'failed', label: 'Failed', color: '#ef4444', bgColor: 'bg-red-600/20', textColor: 'text-red-500', borderColor: 'border-red-600/30' },
]

export const PAYMENT_STATUS_MAP = Object.fromEntries(PAYMENT_STATUS_LIFECYCLE.map((status) => [status.value, status]))

export const PAYMENT_STATUS_TRANSITIONS = {
  pending: ['proof_submitted', 'pending'],
  proof_submitted: ['under_review', 'approved', 'rejected', 'pending', 'proof_submitted'],
  under_review: ['approved', 'rejected', 'under_review'],
  approved: ['approved', 'rejected', 'failed'],
  rejected: ['pending', 'proof_submitted', 'rejected'],
  failed: ['pending', 'proof_submitted', 'failed'],
}

const LEGACY_PAYMENT_STATUS_MAP = {
  awaiting_approval: 'proof_submitted',
  cancelled: 'failed',
  for_verification: 'proof_submitted',
  paid: 'approved',
  refunded: 'failed',
  verified: 'approved',
}

export function normalizePaymentStatus(status, fallback = 'pending') {
  const normalizedStatus = String(status || '').trim().toLowerCase()

  if (!normalizedStatus) {
    return fallback
  }

  if (PAYMENT_STATUS_MAP[normalizedStatus]) {
    return normalizedStatus
  }

  return LEGACY_PAYMENT_STATUS_MAP[normalizedStatus] || fallback
}

export function getPaymentStatusConfig(status) {
  return PAYMENT_STATUS_MAP[normalizePaymentStatus(status)] || PAYMENT_STATUS_MAP.pending
}

export function getAllowedPaymentStatuses(currentStatus, options = {}) {
  const { includeCurrent = true } = options
  const normalizedCurrentStatus = normalizePaymentStatus(currentStatus)
  const allowedStatuses = PAYMENT_STATUS_TRANSITIONS[normalizedCurrentStatus] || []
  const values = includeCurrent
    ? Array.from(new Set([normalizedCurrentStatus, ...allowedStatuses]))
    : allowedStatuses

  return values
    .map((value) => PAYMENT_STATUS_MAP[value])
    .filter(Boolean)
}
