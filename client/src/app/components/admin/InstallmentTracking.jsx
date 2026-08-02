import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import {
  CreditCard, DollarSign, Calendar, CheckCircle, AlertCircle,
  Clock, ChevronDown, ChevronUp, History, Loader2
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

export default function InstallmentTracking({ projectId, order, orderId }) {
  const [trackingData, setTrackingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [resolvedProjectId, setResolvedProjectId] = useState(projectId)
  const [imageToView, setImageToView] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

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
    pending_advance_payments = [],
  } = trackingData

  const {
    remaining_balance = total_contract_amount,
    paid_count = 0,
    total_months = tenure_months,
    remaining_months = tenure_months,
    next_due_date = null,
    last_updated = null,
  } = summary

  // Compute payment status
  const getPaymentStatus = () => {
    if (!total_months) return null;
    if (paid_count === 0) return { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    if (paid_count >= total_months) return { label: 'Fully Paid', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    return { label: 'Ongoing', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
  };

  const paymentStatus = getPaymentStatus();

  const confirmAdvancePayment = async (paymentId, scheduleId) => {
    setConfirmingId(paymentId);
    try {
      await adminApi.markInstallmentPaid(scheduleId, paymentId);
      fetchTrackingData();
    } catch (err) {
      console.error('Failed to confirm advance payment:', err);
    } finally {
      setConfirmingId(null);
    }
  };

  const cancelAdvancePayment = async (paymentId) => {
    if (!confirm(`Reject and un-link advance payment ${paymentId.slice(0, 8)}?`)) return;
    setCancellingId(paymentId);
    try {
      await adminApi.cancelAdvancePayment(paymentId);
      fetchTrackingData();
    } catch (err) {
      console.error('Failed to cancel advance payment:', err);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
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
                  </tr>
                </thead>
                <tbody>
                  {installments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-[var(--text-muted)]">No installment records found.</td>
                    </tr>
                  ) : (
                    installments.map((inst) => {
                      const instConfig = INSTALLMENT_STATUS_CONFIG[inst.status] || INSTALLMENT_STATUS_CONFIG.pending
                      const isPastDue = inst.status === 'pending' && new Date(inst.due_date) < new Date()
                      const effectiveStatus = isPastDue ? INSTALLMENT_STATUS_CONFIG.overdue : instConfig
                      const displayStatus = isPastDue ? 'overdue' : inst.status
                      return (
                        <tr key={inst.schedule_id} className={`border-t border-[var(--border)]/30 ${inst.status === 'overdue' || isPastDue ? 'bg-red-500/5' : ''}`}>
                          <td className="p-3 text-white font-mono">{inst.installment_number}</td>
                          <td className="p-3 text-white">
                            {new Date(inst.due_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="p-3 text-right text-white font-medium">{formatCurrency(Number(inst.amount))}</td>
                          <td className="p-3 text-center">
                            <InstallmentStatusBadge status={displayStatus} />
                            {inst.paid_in_advance && (
                              <span className="ml-1.5 inline-flex items-center rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">
                                In Advance
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[var(--text-muted)] text-xs">
                            {inst.paid_at
                              ? new Date(inst.paid_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'
                            }
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

      {/* Pending Advance Payments (Awaiting Confirmation) */}
      {pending_advance_payments.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Advance Payments — Awaiting Confirmation
            <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
              {pending_advance_payments.length} pending
            </span>
          </h4>
          <div className="space-y-4">
            {pending_advance_payments.map((payment) => {
              const isConfirming = confirmingId === payment.payment_id;
              const isCancelling = cancellingId === payment.payment_id;
              return (
                <div
                  key={payment.payment_id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <p className="text-white font-medium">
                        {formatCurrency(Number(payment.amount))} — {payment.method === 'bank_transfer' ? 'Bank Transfer' : payment.method === 'gcash' ? 'GCash' : payment.method}
                      </p>
                      {payment.reference_number && (
                        <p className="text-[var(--text-muted)] text-xs">Ref: {payment.reference_number}</p>
                      )}
                      <p className="text-[var(--text-muted)] text-xs">
                        Submitted: {payment.created_at ? new Date(payment.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </p>
                      <p className="text-xs">
                        Installments: {payment.installments.map((i) => `#${i.installment_number}`).join(', ')}
                      </p>
                    </div>

                    {/* Proof thumbnail */}
                    {payment.proof_url ? (
                      <div
                        className="relative flex-shrink-0 h-20 w-20 cursor-zoom-in rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] overflow-hidden"
                        onClick={() => setImageToView(payment.proof_url)}
                      >
                        <img
                          src={payment.proof_url}
                          alt="Payment proof"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center text-[10px] text-white">
                          Click to zoom
                        </div>
                      </div>
                    ) : (
                      <div className="flex-shrink-0 h-20 w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] flex items-center justify-center text-[var(--text-muted)] text-xs">
                        No proof
                      </div>
                    )}
                  </div>

                  {/* Actions: confirm each installment */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {payment.installments.map((inst) => {
                      const isPaid = inst.schedule_id && installments.find((i) => i.schedule_id === inst.schedule_id)?.status === 'paid';
                      return (
                        <button
                          key={inst.schedule_id}
                          type="button"
                          disabled={isConfirming || isCancelling || isPaid}
                          onClick={() => confirmAdvancePayment(payment.payment_id, inst.schedule_id)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                            isPaid
                              ? 'cursor-default border-green-500/30 bg-green-500/10 text-green-400'
                              : 'border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/20 disabled:opacity-60'
                          }`}
                          title={isPaid ? 'Installment already confirmed' : `Confirm #${inst.installment_number}`}
                        >
                          {isConfirming ? 'Confirming…' : isPaid ? 'Confirmed' : `Confirm #${inst.installment_number}`}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={isConfirming || isCancelling}
                      onClick={() => cancelAdvancePayment(payment.payment_id)}
                      className="ml-auto rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-60"
                      title="Reject this advance payment and un-link the installments"
                    >
                      {isCancelling ? 'Rejecting…' : 'Reject Payment'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Payment proof zoom modal */}
      {imageToView && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImageToView(null)}
        >
          <img
            src={imageToView}
            alt="Payment proof"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </motion.div>
  )
}