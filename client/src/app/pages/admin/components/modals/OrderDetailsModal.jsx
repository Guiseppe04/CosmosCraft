import { motion } from 'motion/react'
import { X, RefreshCw, Save, Loader2, Package, Check } from 'lucide-react'

export function OrderDetailsModal({
  modal,
  form,
  setForm,
  closeModal,
  formatCurrency,
  updateOrderAndPaymentStatus,
  normalizePaymentStatus,
  getAllowedPaymentStatuses,
  getOrderStatusConfig,
  getPaymentStatusConfig,
  isCashOnDeliveryOrder,
  TIMELINE_STEPS,
  ORDER_STATUS_LIFECYCLE,
  ORDER_STATUS_TRANSITIONS,
  paymentStatusUpdate,
}) {
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
        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xl font-bold text-white">Order #{modal.data.order_number || modal.data.order_id?.slice(0, 8)}</h2>
            <div className="flex items-center gap-2 mt-2">
              {(() => {
                const statusConfig = getOrderStatusConfig(modal.data.status || 'pending')
                return (
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                    {statusConfig.label}
                  </span>
                )
              })()}
              {(() => {
                const paymentConfig = getPaymentStatusConfig(modal.data.payment_status || 'pending')
                return (
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${paymentConfig.bgColor} ${paymentConfig.textColor} ${paymentConfig.borderColor}`}>
                    {paymentConfig.label}
                  </span>
                )
              })()}
            </div>
          </div>
          <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Customer</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[var(--text-muted)] text-xs">Name</p>
                <p className="text-white font-medium">
                  {modal.data.first_name && modal.data.last_name ? `${modal.data.first_name} ${modal.data.last_name}` : modal.data.customer_name || modal.data.user_name || modal.data.name || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-xs">Email</p>
                <p className="text-white">{modal.data.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-xs">Phone</p>
                <p className="text-white">{modal.data.contact_phone || modal.data.customer_phone || modal.data.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-xs">Address</p>
                <p className="text-white text-sm">
                  {modal.data.shipping_line1
                    ? `${modal.data.shipping_line1}${modal.data.shipping_line2 ? ', ' + modal.data.shipping_line2 : ''}, ${modal.data.shipping_city}${modal.data.shipping_province ? ', ' + modal.data.shipping_province : ''} ${modal.data.shipping_postal_code || ''}`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          {modal.data.items?.length > 0 && (
            <div>
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Items</p>
              <div className="space-y-2">
                {modal.data.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-[var(--bg-primary)]/50 rounded-lg">
                    <div className="w-12 h-12 rounded-lg bg-[var(--surface-dark)] overflow-hidden flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name || item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-[var(--text-muted)]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{item.product_name || item.name || 'Product'}</p>
                      <p className="text-[var(--text-muted)] text-xs">Qty: {item.quantity || item.qty || 1}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[var(--gold-primary)] font-semibold">{formatCurrency((item.unit_price || item.price || 0) * (item.quantity || item.qty || 1))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Created</p>
              <p className="text-white text-sm">{modal.data.created_at ? new Date(modal.data.created_at).toLocaleString() : '—'}</p>
            </div>
            <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Payment Method</p>
              <p className="text-white text-sm">
                {(() => {
                  const method = modal.data.payment_method || modal.data.payment?.method || 'Unknown'
                  const methodLower = method.toString().toLowerCase()
                  if (methodLower.includes('gcash') || methodLower.includes('g-cash')) return 'GCash'
                  if (methodLower.includes('bank') || methodLower.includes('transfer') || methodLower.includes('bdo') || methodLower.includes('bpi') || methodLower.includes('unionbank')) return 'Bank Transfer'
                  if (methodLower.includes('cod') || methodLower.includes('cash')) return 'Cash on Delivery'
                  return method.charAt(0).toUpperCase() + method.slice(1)
                })()}
              </p>
            </div>
            {modal.data.tracking_number && (
              <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Tracking Number</p>
                <p className="text-white text-sm">{modal.data.tracking_number}</p>
              </div>
            )}
            {modal.data.rider_details && (
              <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Rider Details</p>
                <p className="text-white text-sm">{modal.data.rider_details}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">Timeline</p>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--border)]" />
              <div className="space-y-4">
                {TIMELINE_STEPS.map((step, idx) => {
                  const currentStatus = modal.data.status || 'pending'
                  const stepConfig = getOrderStatusConfig(step.status)
                  const stepIndex = ORDER_STATUS_LIFECYCLE.findIndex((s) => s.value === step.status)
                  const currentIndex = ORDER_STATUS_LIFECYCLE.findIndex((s) => s.value === currentStatus)
                  const isCompleted = currentStatus === 'cancelled' ? step.status === 'cancelled' : stepIndex < currentIndex || (stepIndex === 0 && currentStatus !== 'cancelled')
                  const isCurrent = step.status === currentStatus && currentStatus !== 'cancelled'
                  const isCancelled = currentStatus === 'cancelled' && step.status !== 'cancelled'

                  return (
                    <div key={step.status} className="flex items-start gap-4 relative">
                      <div
                        className={`z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          isCompleted ? 'bg-green-500 text-white' : isCurrent ? `${stepConfig.bgColor} ${stepConfig.textColor} border ${stepConfig.borderColor}` : isCancelled ? 'bg-red-500/50 text-red-300' : 'bg-[var(--surface-dark)] text-[var(--text-muted)] border border-[var(--border)]'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold ${isCompleted ? 'text-green-400' : isCurrent ? stepConfig.textColor : isCancelled ? 'text-red-400' : 'text-[var(--text-muted)]'}`}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{step.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Subtotal</span>
              <span className="text-white">{formatCurrency(modal.data.subtotal || (modal.data.total || modal.data.total_amount || 0) - (modal.data.shipping_fee || 0))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Shipping</span>
              <span className="text-white">{formatCurrency(modal.data.shipping_fee || 0)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-[var(--border)]">
              <span className="text-white font-semibold">Total</span>
              <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(modal.data.total || modal.data.total_amount || 0)}</span>
            </div>
          </div>

          {/* Unified Status Update Section */}
          <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4 border border-[var(--border)]">
            {(() => {
              const isCODOrder = isCashOnDeliveryOrder(modal.data)
              return (
                <>
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[var(--gold-primary)]" />
                    Update Status
                  </h3>

                  {/* Order Status Selector */}
                  <div className="mb-4">
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Order Status</p>
                    <div className="grid grid-cols-3 gap-2">
                      {ORDER_STATUS_LIFECYCLE.filter((s) => s.value !== 'out_for_delivery').map((status) => {
                        const currentOrderStatus = modal.data.status || 'pending'
                        const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentOrderStatus] || []
                        const isActive = (form.order_status || modal.data.status || 'pending') === status.value
                        const isAllowed = allowedTransitions.includes(status.value)
                        return (
                          <button
                            key={status.value}
                            type="button"
                            onClick={() => {
                              if (!isAllowed) return
                              setForm((f) => ({ ...f, order_status: status.value }))
                            }}
                            disabled={!isAllowed}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                              isActive ? `${status.bgColor} ${status.textColor} ${status.borderColor}` : isAllowed ? 'bg-[var(--surface-dark)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50' : 'bg-[var(--surface-dark)] border-[var(--border)] text-[var(--text-muted)]/70 font-semibold opacity-60 cursor-not-allowed'
                            }`}
                          >
                            {status.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {!isCODOrder && (
                    <div className="mb-4">
                      <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Payment Status</p>
                      <div className="grid grid-cols-2 gap-2">
                        {getAllowedPaymentStatuses(modal.data.payment_status || modal.data?.payment?.status).map((status) => {
                          const isActive = normalizePaymentStatus(form.payment_status || modal.data.payment_status || modal.data?.payment?.status) === status.value
                          return (
                            <button
                              key={status.value}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, payment_status: status.value }))}
                              className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                                isActive ? `${status.bgColor} ${status.textColor} ${status.borderColor}` : 'bg-[var(--surface-dark)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                              }`}
                            >
                              {status.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={updateOrderAndPaymentStatus}
                    disabled={paymentStatusUpdate.loading}
                    className={`w-full px-4 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-lg text-black font-semibold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 ${paymentStatusUpdate.loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {paymentStatusUpdate.loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Status Updates
                      </>
                    )}
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
