import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import {
  DollarSign, Calendar, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, History, Loader2, Check, X
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency'
import { adminApi } from '../../utils/adminApi'

const INSTALLMENT_STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
  paid: { label: 'Paid', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  overdue: { label: 'Overdue', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bgColor: 'bg-gray-500/20', textColor: 'text-gray-400', borderColor: 'border-gray-500/30' },
}

function InstallmentStatusBadge({ status }) {
  const config = INSTALLMENT_STATUS_CONFIG[status] || INSTALLMENT_STATUS_CONFIG.pending
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
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

export default function InstallmentTracking({ projectId, order, orderId }) {
  const [trackingData, setTrackingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [markPaidInstallment, setMarkPaidInstallment] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState(null)

  const fetchTrackingData = useCallback(async () => {
    const targetOrderId = orderId || order?.order_id;
    let targetProjectId = projectId;

    // If we have an order ID but no project ID, pass orderId as query param
    // The backend will resolve the project from the order
    if (!targetProjectId && !targetOrderId) {
      setLoading(false);
      return;
    }

    setLoading(true)
    setError(null)
    try {
      let response;
      if (targetProjectId) {
        response = await adminApi.getProjectInstallmentTracking(targetProjectId);
      } else if (targetOrderId) {
        // Pass orderId as query parameter - backend will resolve
        response = await adminApi.getOrderInstallmentTracking(targetOrderId);
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
  } = summary

  // Compute payment status
  const getPaymentStatus = () => {
    if (!total_months) return null;
    if (paid_count === 0) return { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    if (paid_count >= total_months) return { label: 'Fully Paid', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    return { label: 'Ongoing', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
  };

  const paymentStatus = getPaymentStatus();

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
            {tenure_months} months • {Math.round(initial_payment_percentage * 100)}% down
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
            <p className="text-lg font-bold text-white mt-1">{formatCurrency(remaining_balance)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <InstallmentProgressBar
          paidCount={paid_count}
          totalCount={total_months}
          remainingBalance={remaining_balance}
          totalAmount={total_contract_amount}
        />

        {/* Next Due Date Alert */}
        {next_due_date && remaining_balance > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-[var(--surface-dark)]/70 rounded-xl p-3 border border-[var(--border)]">
            <Calendar className="w-4 h-4 text-[var(--gold-primary)] flex-shrink-0" />
            <span className="text-sm text-[var(--text-muted)]">Next due date:</span>
            <span className="text-sm font-semibold text-white">
              {new Date(next_due_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        )}

        {/* Overdue Warning */}
        {installments.some(i => i.status === 'overdue') && (
          <div className="mt-3 flex items-center gap-2 bg-red-500/10 rounded-xl p-3 border border-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">
              This project has {installments.filter(i => i.status === 'overdue').length} overdue installment(s).
              {remaining_balance > 0 && ' The project has been auto-paused.'}
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
            <h4 className="text-white font-semibold text-sm">Payment Schedule</h4>
            <span className="text-xs text-[var(--text-muted)]">
              ({paid_count}/{total_months} paid)
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
                    <th className="p-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Paid At</th>
                    <th className="p-3 text-center text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[var(--text-muted)]">
                        No installment records found. The installment schedule will be created once the initial payment is verified.
                      </td>
                    </tr>
                  ) : (
                    installments.map((inst) => {
                      const isPastDue = inst.status === 'pending' && new Date(inst.due_date) < new Date()
                      const displayStatus = isPastDue ? 'overdue' : inst.status
                      const canMarkPaid = inst.status === 'pending' || inst.status === 'overdue'
                      return (
                        <tr key={inst.schedule_id} className={`border-t border-[var(--border)]/30 ${inst.status === 'overdue' || isPastDue ? 'bg-red-500/5' : ''}`}>
                          <td className="p-3 text-white font-mono">{inst.installment_number}</td>
                          <td className="p-3 text-white">
                            {new Date(inst.due_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="p-3 text-right text-white font-medium">{formatCurrency(Number(inst.amount))}</td>
                          <td className="p-3 text-center">
                            <InstallmentStatusBadge status={displayStatus} />
                          </td>
                          <td className="p-3 text-[var(--text-muted)] text-xs">
                            {inst.paid_at
                              ? new Date(inst.paid_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'
                            }
                          </td>
                          <td className="p-3 text-center">
                            {canMarkPaid ? (
                              <button
                                type="button"
                                onClick={() => setMarkPaidInstallment(inst)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/40 text-xs font-medium transition-all hover:bg-green-500/30 hover:shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Mark Paid
                              </button>
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
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">Payment of {formatCurrency(Number(payment.amount))}</p>
                  <p className="text-[var(--text-muted)] text-xs">
                    {payment.reference_number && <>Ref: {payment.reference_number} • </>}
                    {payment.verified_first ? `Verified by: ${payment.verified_first} ${payment.verified_last || ''}` : 'System verified'}
                    {payment.method && <> • {String(payment.method).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</>}
                  </p>
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

      {/* Mark Paid Modal */}
      {markPaidInstallment && (
        <MarkPaidModal
          installment={markPaidInstallment}
          onClose={() => setMarkPaidInstallment(null)}
          onConfirm={handleMarkPaid}
          isSubmitting={isSubmitting}
        />
      )}
    </motion.div>
  )
}