import { motion } from 'motion/react'
import { X, ChevronDown, Save, Loader2 } from 'lucide-react'
import { CreditCard, DollarSign } from 'lucide-react'
import { ImageZoomModal } from '../shared/ImageZoomModal'

export function PaymentApprovalModal({
  modal,
  form,
  setForm,
  closeModal,
  formatCurrency,
  paymentStatusDropdownOpen,
  setPaymentStatusDropdownOpen,
  updatePaymentStatus,
  normalizePaymentStatus,
  getAllowedPaymentStatuses,
  paymentStatusUpdate,
}) {
  const originalStatus = normalizePaymentStatus(modal.data?.payment_status || modal.data?.payment?.status)
  const statuses = getAllowedPaymentStatuses(originalStatus)
  const currentValue = normalizePaymentStatus(form.payment_status || originalStatus)
  const selectedStatus = statuses.find((status) => status.value === currentValue)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Update Payment Status</h2>
          <button onClick={closeModal} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Order # - Highlighted */}
          <div className="bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 rounded-lg p-4">
            <p className="text-[var(--gold-primary)] text-sm mb-1">Order #</p>
            <p className="text-white font-mono text-xl font-bold">{form.order_number || modal.data?.order_number || modal.data?.order_id?.slice(0, 8)}</p>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
              <p className="text-[var(--text-muted)] text-sm mb-2">Payment Method</p>
              <div className="flex items-center gap-3">
                {(() => {
                  const method = form.payment_method || 'card'
                  const methodLower = method.toLowerCase()

                  if (methodLower.includes('gcash') || methodLower.includes('g-cash')) {
                    return (
                      <>
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">G</span>
                        </div>
                        <span className="text-white font-semibold">GCash</span>
                      </>
                    )
                  } else if (methodLower.includes('bank') || methodLower.includes('transfer') || methodLower.includes('bdo') || methodLower.includes('bpi') || methodLower.includes('unionbank')) {
                    return (
                      <>
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <CreditCard className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-white font-semibold">Bank Transfer</span>
                      </>
                    )
                  } else if (methodLower.includes('cod') || methodLower.includes('cash')) {
                    return (
                      <>
                        <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                          <DollarSign className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-white font-semibold">Cash on Delivery</span>
                      </>
                    )
                  } else {
                    return (
                      <>
                        <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                          <CreditCard className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-white font-semibold capitalize">{method}</span>
                      </>
                    )
                  }
                })()}
              </div>
            </div>
            <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
              <p className="text-[var(--text-muted)] text-sm mb-1">Amount</p>
              <p className="text-[var(--gold-primary)] font-bold text-xl">{formatCurrency(form.amount || 0)}</p>
            </div>
          </div>

          {/* Status Cards */}
          <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
            <p className="text-[var(--text-muted)] text-sm mb-3">Status</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPaymentStatusDropdownOpen((open) => !open)}
                className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-left flex items-center justify-between gap-3 transition-all hover:border-[var(--gold-primary)]/30"
              >
                <span className="text-sm font-semibold" style={{ color: selectedStatus?.color || '#ffffff' }}>
                  {selectedStatus?.label || 'Pending'}
                </span>
                <ChevronDown className="w-4 h-4 text-white" />
              </button>

              {paymentStatusDropdownOpen && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-2xl">
                  {statuses.map((status) => (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, payment_status: status.value }))
                        setPaymentStatusDropdownOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                        currentValue === status.value ? 'bg-[var(--border)]/20' : 'hover:bg-[var(--gold-primary)]/10'
                      }`}
                    >
                      <span className="text-white">{status.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-3 text-[var(--text-muted)] text-sm leading-relaxed">
              Choose the next valid payment status for this order. Save your selection with Update Status.
            </p>
          </div>

          {/* Payment Proof Image - Zoomable */}
          {form.proof_url && (
            <div className="space-y-3">
              <p className="text-white font-semibold flex items-center gap-2">
                Payment Proof
                <span className="text-xs text-[var(--text-muted)] font-normal">(Click to zoom)</span>
              </p>
              <ImageZoomModal src={form.proof_url} alt="Payment Proof" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={closeModal}
              className="flex-1 px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white font-semibold hover:border-[var(--gold-primary)]/50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={updatePaymentStatus}
              disabled={
                paymentStatusUpdate.loading ||
                normalizePaymentStatus(form.payment_status || modal.data?.payment_status || modal.data?.payment?.status) ===
                  normalizePaymentStatus(modal.data?.payment_status || modal.data?.payment?.status)
              }
              className={`flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white font-semibold hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all flex items-center justify-center gap-2 ${
                paymentStatusUpdate.loading ||
                normalizePaymentStatus(form.payment_status || modal.data?.payment_status || modal.data?.payment?.status) ===
                  normalizePaymentStatus(modal.data?.payment_status || modal.data?.payment?.status)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              {paymentStatusUpdate.loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Status
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
