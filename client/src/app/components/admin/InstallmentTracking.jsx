import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  DollarSign, Calendar, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, History, Loader2, Check, X,
  ShieldCheck, Eye, Clock, CreditCard, AlertTriangle
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency'
import { adminApi } from '../../utils/adminApi'
import { resolveImageUrl } from '../../utils/apiConfig'

const formatLabel = (value) => {
  if (!value) return ''
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const INSTALLMENT_STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
  due: { label: 'Due', color: '#3b82f6', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
  for_verification: { label: 'Verification Pending', color: '#fbbf24', bgColor: 'bg-amber-500/20', textColor: 'text-amber-300', borderColor: 'border-amber-500/40' },
  paid: { label: 'Paid ✓', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  overdue: { label: 'Overdue', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  upcoming: { label: 'Upcoming', color: '#94a3b8', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400', borderColor: 'border-slate-500/30' },
  rejected: { label: 'Rejected', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bgColor: 'bg-gray-500/20', textColor: 'text-gray-400', borderColor: 'border-gray-500/30' },
}

function InstallmentStatusBadge({ status }) {
  const config = INSTALLMENT_STATUS_CONFIG[status] || INSTALLMENT_STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
      {config.label}
    </span>
  )
}

function InstallmentProgressBar({ paidCount, totalCount, remainingBalance, totalAmount }) {
  const percentage = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-muted)]">Payment Progress</span>
        <span className="text-white font-semibold">{paidCount} of {totalCount} installments paid ({percentage}%)</span>
      </div>
      <div className="w-full h-2.5 bg-[var(--surface-dark)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>Paid: {formatCurrency(totalAmount - remainingBalance)}</span>
        <span>Remaining: {formatCurrency(remainingBalance)}</span>
      </div>
    </div>
  )
}

function VerifyPaymentModal({ installment, onClose, onConfirm, isSubmitting }) {
  const [notes, setNotes] = useState('')

  const [zoomProof, setZoomProof] = useState(false)
  const proofUrl = installment?.payment_proof_url || installment?.proof_url || installment?.payment?.proof_url

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[var(--surface-dark)] border border-green-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Verify Installment Payment
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-[var(--bg-primary)]/70 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Installment:</span>
              <span className="text-white font-bold">Installment #{installment.installment_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Amount:</span>
              <span className="text-[var(--gold-primary)] font-bold text-sm">{formatCurrency(Number(installment.amount))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Method:</span>
              <span className="text-white capitalize">{installment.payment_method || 'GCash'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Reference Number:</span>
              <span className="text-white font-mono font-bold">{installment.payment_reference || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Submitted Date:</span>
              <span className="text-white">{installment.submitted_at ? new Date(installment.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</span>
            </div>
          </div>

          {proofUrl ? (
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5 flex items-center justify-between">
                <span>Payment Proof</span>
                <span className="text-[10px] text-[var(--gold-primary)] lowercase">click image to zoom</span>
              </p>
              <div
                onClick={() => setZoomProof(true)}
                className="rounded-xl overflow-hidden border border-[var(--border)] max-h-48 bg-black/40 cursor-zoom-in group relative"
              >
                <img src={resolveImageUrl(proofUrl)} alt="Payment Proof" className="w-full h-auto object-contain" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-black/70 px-3 py-1 rounded-full text-white text-xs font-semibold">Zoom</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--bg-primary)]/40 border border-dashed border-[var(--border)] rounded-xl p-3 text-center">
              <p className="text-[var(--text-muted)] text-xs">No receipt screenshot uploaded with this payment.</p>
            </div>
          )}

          {zoomProof && proofUrl && (
            <ProofImageModal url={proofUrl} onClose={() => setZoomProof(false)} />
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">
              Verification Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Verified against GCash transaction record."
              rows={2}
              className="w-full px-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm hover:bg-white/5 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm({ notes: notes.trim() })}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-green-500 rounded-lg text-white text-sm font-semibold hover:bg-green-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Approve & Verify</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RejectPaymentModal({ installment, onClose, onConfirm, isSubmitting }) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for rejection.')
      return
    }
    onConfirm({
      reason: reason.trim(),
      notes: notes.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[var(--surface-dark)] border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            Reject Installment Payment
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-300">
            <p className="font-semibold">Rejecting this payment will:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 opacity-90">
              <li>Notify the customer with your rejection reason</li>
              <li>Re-open the installment so the customer can submit a new payment</li>
              <li>Not credit this amount toward the project balance</li>
            </ul>
          </div>

          <div className="bg-[var(--bg-primary)]/70 rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Installment:</span>
              <span className="text-white font-bold">Installment #{installment.installment_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Amount:</span>
              <span className="text-[var(--gold-primary)] font-semibold">{formatCurrency(Number(installment.amount))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Reference Number:</span>
              <span className="text-white font-mono">{installment.payment_reference || 'N/A'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">
              Rejection Reason <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError('') }}
              placeholder="e.g., Receipt unreadable / Invalid reference code"
              className="w-full px-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">
              Internal Admin Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about why this was rejected"
              rows={2}
              className="w-full px-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm hover:bg-white/5 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-white text-sm font-semibold hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  <span>Reject Payment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MarkPaidModal({ installment, onClose, onConfirm, isSubmitting }) {
  const [referenceNumber, setReferenceNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('gcash')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = () => {
    if (!referenceNumber.trim()) {
      setError('Please enter a payment reference number.')
      return
    }
    onConfirm({
      reference_number: referenceNumber.trim(),
      payment_method: paymentMethod,
      notes: notes.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[var(--surface-dark)] border border-[var(--gold-primary)]/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Mark Installment as Paid
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[var(--text-muted)]">Installment #</span>
              <span className="text-white font-mono font-semibold">{installment.installment_number}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[var(--text-muted)]">Due Date</span>
              <span className="text-white">{new Date(installment.due_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">Amount</span>
              <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(Number(installment.amount))}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">
              Payment Reference Number <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => { setReferenceNumber(e.target.value); setError('') }}
              placeholder="e.g., GCash ref #123456789"
              className="w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {['gcash', 'bank_transfer'].map((method) => {
                const isActive = paymentMethod === method
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/40'
                        : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                    }`}
                  >
                    {method === 'gcash' ? 'GCash' : 'Bank Transfer'}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Admin Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this payment"
              rows={2}
              className="w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm hover:border-[var(--gold-primary)]/50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2.5 bg-green-500 rounded-lg text-white text-sm font-medium hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Mark as Paid
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProofImageModal({ url, onClose }) {
  if (!url) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative max-w-3xl max-h-[85vh] bg-[var(--surface-dark)] rounded-2xl overflow-hidden p-2 border border-[var(--border)] shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors z-10">
          <X className="w-5 h-5" />
        </button>
        <img src={resolveImageUrl(url)} alt="Proof of payment" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
      </div>
    </div>
  )
}

export default function InstallmentTracking({ projectId, order, orderId }) {
  const [trackingData, setTrackingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDetails, setShowDetails] = useState(true)
  const [markPaidInstallment, setMarkPaidInstallment] = useState(null)
  const [verifyInstallment, setVerifyInstallment] = useState(null)
  const [rejectInstallment, setRejectInstallment] = useState(null)
  const [previewProofUrl, setPreviewProofUrl] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState(null)

  const fetchTrackingData = useCallback(async () => {
    const targetOrderId = orderId || order?.order_id
    let targetProjectId = projectId

    if (!targetProjectId && !targetOrderId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      let response
      if (targetProjectId) {
        response = await adminApi.getProjectInstallmentTracking(targetProjectId)
      } else if (targetOrderId) {
        response = await adminApi.getOrderInstallmentTracking(targetOrderId)
      }
      setTrackingData(response.data)
    } catch (err) {
      console.error('Failed to load installment tracking:', err)
      setError(err.message || 'Failed to load installment data')
    } finally {
      setLoading(false)
    }
  }, [projectId, orderId, order?.order_id])

  useEffect(() => {
    fetchTrackingData()
  }, [fetchTrackingData])

  const handleMarkPaid = async ({ reference_number, payment_method, notes }) => {
    if (!markPaidInstallment?.schedule_id) return
    setIsSubmitting(true)
    setActionMessage(null)
    try {
      await adminApi.markInstallmentPaid(markPaidInstallment.schedule_id, {
        reference_number,
        method: payment_method,
        notes,
        amount: Number(markPaidInstallment.amount),
      })
      setMarkPaidInstallment(null)
      setActionMessage({ type: 'success', text: `Installment #${markPaidInstallment.installment_number} marked as paid.` })
      await fetchTrackingData()
    } catch (err) {
      console.error('Failed to mark installment as paid:', err)
      setActionMessage({ type: 'error', text: err.message || 'Failed to mark installment as paid. Please try again.' })
      setMarkPaidInstallment(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerify = async ({ notes }) => {
    if (!verifyInstallment?.schedule_id) return
    setIsSubmitting(true)
    setActionMessage(null)
    try {
      await adminApi.verifyInstallmentPayment(verifyInstallment.schedule_id, { notes })
      setVerifyInstallment(null)
      setActionMessage({ type: 'success', text: `Installment #${verifyInstallment.installment_number} payment verified successfully!` })
      await fetchTrackingData()
    } catch (err) {
      console.error('Failed to verify installment payment:', err)
      setActionMessage({ type: 'error', text: err.message || 'Failed to verify payment.' })
      setVerifyInstallment(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async ({ reason, notes }) => {
    if (!rejectInstallment?.schedule_id) return
    setIsSubmitting(true)
    setActionMessage(null)
    try {
      await adminApi.rejectInstallmentPayment(rejectInstallment.schedule_id, { reason, notes })
      setRejectInstallment(null)
      setActionMessage({ type: 'success', text: `Installment #${rejectInstallment.installment_number} payment rejected.` })
      await fetchTrackingData()
    } catch (err) {
      console.error('Failed to reject installment payment:', err)
      setActionMessage({ type: 'error', text: err.message || 'Failed to reject payment.' })
      setRejectInstallment(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--gold-primary)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (!trackingData || trackingData.payment_plan !== 'installment') {
    return (
      <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-6 text-center">
        <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-white font-semibold">Payment Complete</p>
        <p className="text-[var(--text-muted)] text-sm mt-1">You paid it in Full Payment.</p>
      </div>
    )
  }

  const {
    total_contract_amount,
    initial_payment_amount,
    initial_payment_percentage,
    monthly_installment_amount,
    tenure_months,
    installments = [],
    summary = {},
    payment_history = [],
  } = trackingData

  const {
    remaining_balance = total_contract_amount,
    paid_count = 0,
    total_months = tenure_months,
    next_due_date = null,
  } = summary || {}

  const safeRemainingBalance = Number.isFinite(Number(remaining_balance)) ? Number(remaining_balance) : (Number.isFinite(Number(total_contract_amount)) ? Number(total_contract_amount) : 0)
  const safePaidCount = Number.isFinite(Number(paid_count)) ? Number(paid_count) : 0
  const safeTotalMonths = Number.isFinite(Number(total_months)) ? Number(total_months) : (Number.isFinite(Number(tenure_months)) ? Number(tenure_months) : 0)

  const getPaymentStatus = () => {
    if (!safeTotalMonths) return null
    if (safePaidCount === 0) return { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' }
    if (safePaidCount >= safeTotalMonths) return { label: 'Fully Paid', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' }
    return { label: 'Ongoing', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' }
  }

  const paymentStatus = getPaymentStatus()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Success/Error Message */}
      {actionMessage && (
        <div className={`rounded-xl p-4 text-sm flex items-center justify-between border ${
          actionMessage.type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="ml-3 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Card */}
      <div className="rounded-2xl border border-[var(--gold-primary)]/30 bg-gradient-to-br from-[var(--gold-primary)]/10 via-[var(--bg-primary)]/70 to-[var(--surface-dark)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[var(--gold-primary)]" />
            <h3 className="text-white font-bold">Installment Plan</h3>
            {paymentStatus && (
              <span className={`ml-2 text-xs font-semibold px-2.5 py-1 rounded-full border ${paymentStatus.bg} ${paymentStatus.border} ${paymentStatus.color}`}>
                {paymentStatus.label}
              </span>
            )}
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {safeTotalMonths} months • {Math.round(initial_payment_percentage * 100)}% down
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-[var(--surface-dark)]/70 rounded-xl p-3 border border-[var(--border)]">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Total Contract</p>
            <p className="text-lg font-bold text-[var(--gold-primary)] mt-1">{formatCurrency(total_contract_amount)}</p>
          </div>
          <div className="bg-[var(--surface-dark)]/70 rounded-xl p-3 border border-[var(--border)]">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Initial Payment</p>
            <p className="text-lg font-bold text-white mt-1">{formatCurrency(initial_payment_amount)}</p>
          </div>
          <div className="bg-[var(--surface-dark)]/70 rounded-xl p-3 border border-[var(--border)]">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Monthly</p>
            <p className="text-lg font-bold text-white mt-1">{formatCurrency(monthly_installment_amount)}</p>
          </div>
          <div className="bg-[var(--surface-dark)]/70 rounded-xl p-3 border border-[var(--border)]">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Remaining</p>
            <p className="text-lg font-bold text-white mt-1">{formatCurrency(safeRemainingBalance)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <InstallmentProgressBar
          paidCount={safePaidCount}
          totalCount={safeTotalMonths}
          remainingBalance={safeRemainingBalance}
          totalAmount={total_contract_amount}
        />

        {/* Next Due Date Alert */}
        {next_due_date && safeRemainingBalance > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-[var(--surface-dark)]/70 rounded-xl p-3 border border-[var(--border)]">
            <Calendar className="w-4 h-4 text-[var(--gold-primary)] flex-shrink-0" />
            <span className="text-sm text-[var(--text-muted)]">Next due date:</span>
            <span className="text-sm font-semibold text-white">
              {new Date(next_due_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        )}

        {/* Overdue Warning */}
        {installments.some(i => (i.display_status === 'overdue' || i.status === 'overdue')) && (
          <div className="mt-3 flex items-center gap-2 bg-red-500/10 rounded-xl p-3 border border-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">
              This project has {installments.filter(i => i.display_status === 'overdue' || i.status === 'overdue').length} overdue installment(s).
              {safeRemainingBalance > 0 && ' The project has been auto-paused.'}
            </span>
          </div>
        )}
      </div>

      {/* Installment Schedule */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/50 overflow-hidden">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--gold-primary)]" />
            <h4 className="text-white font-semibold text-sm">Payment Schedule & Verification</h4>
            <span className="text-xs text-[var(--text-muted)]">
              ({safePaidCount}/{safeTotalMonths} paid)
            </span>
          </div>
          {showDetails ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </button>

        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="border-t border-[var(--border)]"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-primary)]/30">
                  <tr>
                    <th className="p-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">#</th>
                    <th className="p-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Due Date</th>
                    <th className="p-3 text-right text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Amount</th>
                    <th className="p-3 text-center text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Status</th>
                    <th className="p-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Payment Details</th>
                    <th className="p-3 text-center text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Proof</th>
                    <th className="p-3 text-center text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[var(--text-muted)]">
                        No installment records found. The installment schedule will be created once the initial payment is verified.
                      </td>
                    </tr>
                  ) : (
                    installments.map((inst) => {
                      const displayStatus = inst.display_status || inst.status
                      const isPendingVerification = displayStatus === 'for_verification'
                      const isPaid = displayStatus === 'paid'
                      const canMarkPaid = ['pending', 'due', 'overdue', 'rejected'].includes(displayStatus)

                      return (
                        <tr key={inst.schedule_id} className={`border-t border-[var(--border)]/30 ${displayStatus === 'overdue' ? 'bg-red-500/5' : isPendingVerification ? 'bg-amber-500/5' : ''}`}>
                          <td className="p-3 text-white font-mono">{inst.installment_number}</td>
                          <td className="p-3 text-white">
                            {new Date(inst.due_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="p-3 text-right text-white font-medium">{formatCurrency(Number(inst.amount))}</td>
                          <td className="p-3 text-center">
                            <InstallmentStatusBadge status={displayStatus} />
                          </td>
                          <td className="p-3 text-xs text-[var(--text-muted)]">
                            {inst.payment_method && (
                              <p className="text-white capitalize font-medium">{inst.payment_method.replace(/_/g, ' ')}</p>
                            )}
                            {inst.payment_reference && (
                              <p className="font-mono text-[10px] text-[var(--gold-primary)]">Ref: {inst.payment_reference}</p>
                            )}
                            {isPaid && inst.payment_date && (
                              <p className="text-[10px]">Paid: {new Date(inst.payment_date).toLocaleDateString()}</p>
                            )}
                            {isPendingVerification && inst.submitted_at && (
                              <p className="text-[10px] text-amber-300">Submitted: {new Date(inst.submitted_at).toLocaleDateString()}</p>
                            )}
                            {!inst.payment_method && !inst.payment_reference && !isPaid && (
                              <span>—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {inst.payment_proof_url ? (
                              <button
                                type="button"
                                onClick={() => setPreviewProofUrl(inst.payment_proof_url)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--gold-primary)]/50 text-xs text-white transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                                <span>View</span>
                              </button>
                            ) : (
                              <span className="text-[var(--text-muted)] text-xs">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isPendingVerification ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setVerifyInstallment(inst)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/20 text-green-400 border border-green-500/40 text-xs font-semibold hover:bg-green-500/30 transition-all"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectInstallment(inst)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-semibold hover:bg-red-500/30 transition-all"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                              </div>
                            ) : canMarkPaid ? (
                              <button
                                type="button"
                                onClick={() => setMarkPaidInstallment(inst)}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-green-500/20 text-green-400 border border-green-500/40 text-xs font-medium transition-all hover:bg-green-500/30 hover:shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Mark Paid
                              </button>
                            ) : isPaid ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Verified
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)] text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Payment History */}
      {payment_history.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/50 p-4">
          <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--gold-primary)]" />
            Payment History
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {payment_history.map((payment, idx) => (
              <div key={payment.payment_id || idx} className="flex items-start gap-3 p-3 bg-[var(--bg-primary)]/30 rounded-xl">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  payment.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                  payment.status === 'for_verification' ? 'bg-amber-500/20 text-amber-400' :
                  payment.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {payment.status === 'verified' ? <CheckCircle className="w-4 h-4" /> :
                   payment.status === 'for_verification' ? <Clock className="w-4 h-4" /> :
                   <AlertCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">Payment of {formatCurrency(Number(payment.amount))}</p>
                  <p className="text-[var(--text-muted)] text-xs">
                    {payment.reference_number && <>Ref: {payment.reference_number} • </>}
                    {payment.verified_first ? `Verified by: ${payment.verified_first} ${payment.verified_last || ''}` : 'Status: ' + formatLabel(payment.status)}
                    {payment.method && <> • {String(payment.method).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</>}
                  </p>
                  {payment.rejection_reason && (
                    <p className="text-xs text-red-400 mt-0.5">Rejection reason: {payment.rejection_reason}</p>
                  )}
                </div>
                <p className="text-[var(--text-muted)] text-xs flex-shrink-0">
                  {payment.verified_at
                    ? new Date(payment.verified_at).toLocaleDateString()
                    : payment.created_at
                      ? new Date(payment.created_at).toLocaleDateString()
                      : '—'
                  }
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {verifyInstallment && (
        <VerifyPaymentModal
          installment={verifyInstallment}
          onClose={() => setVerifyInstallment(null)}
          onConfirm={handleVerify}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Reject Modal */}
      {rejectInstallment && (
        <RejectPaymentModal
          installment={rejectInstallment}
          onClose={() => setRejectInstallment(null)}
          onConfirm={handleReject}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Mark Paid Modal */}
      {markPaidInstallment && (
        <MarkPaidModal
          installment={markPaidInstallment}
          onClose={() => setMarkPaidInstallment(null)}
          onConfirm={handleMarkPaid}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Zoomable Proof Modal */}
      {previewProofUrl && (
        <ProofImageModal
          url={previewProofUrl}
          onClose={() => setPreviewProofUrl(null)}
        />
      )}
    </motion.div>
  )
}