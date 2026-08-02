import { motion } from 'motion/react'
import { X, Save, Loader2 } from 'lucide-react'

export function OrderStatusModal({
  modal,
  form,
  setForm,
  closeModal,
  isSaving,
  setIsSaving,
  formatCurrency,
  showToast,
  fetchOrders,
  adminApi,
  ORDER_STATUS_LIFECYCLE,
  ORDER_STATUS_TRANSITIONS,
}) {
  const handleUpdateStatus = async () => {
    if (!form.order_status) return
    const currentOrderStatus = modal.data.status || 'pending'
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentOrderStatus] || []
    if (!allowedTransitions.includes(form.order_status)) {
      showToast(`Invalid status transition from ${currentOrderStatus} to ${form.order_status}.`, 'error')
      return
    }

    setIsSaving(true)
    try {
      const updateData = { status: form.order_status }
      if (form.tracking_info) {
        if (form.order_status === 'shipped') updateData.tracking_number = form.tracking_info
        if (form.order_status === 'out_for_delivery') updateData.rider_name = form.tracking_info
      }
      await adminApi.updateOrder(modal.data.order_id, updateData)
      showToast(`Order status updated to ${form.order_status}!`)
      fetchOrders()
      closeModal()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

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
        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-lg shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Update Order Status</h2>
          <button onClick={closeModal} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-[var(--bg-primary)]/50 rounded-lg p-4">
            <p className="text-[var(--text-muted)] text-sm mb-1">Order #</p>
            <p className="text-white font-mono text-lg font-bold">{modal.data.order_number || modal.data.order_id?.slice(0, 8)}</p>
            <p className="text-[var(--text-muted)] text-sm mt-2">Total: {formatCurrency(modal.data.total || modal.data.total_amount || 0)}</p>
          </div>

          <div>
            <p className="text-[var(--text-muted)] text-sm mb-3">Select New Order Status</p>
            <div className="grid grid-cols-2 gap-2">
              {ORDER_STATUS_LIFECYCLE.map((status) => {
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
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? `${status.bgColor} ${status.textColor} ${status.borderColor}`
                        : isAllowed
                          ? 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                          : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)]/70 font-semibold opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-sm font-semibold">{status.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {form.order_status && (form.order_status === 'shipped' || form.order_status === 'out_for_delivery') && (
            <div>
              <p className="text-[var(--text-muted)] text-sm mb-2">
                {form.order_status === 'shipped' ? 'Tracking Number' : 'Rider Details'}
              </p>
              <input
                type="text"
                placeholder={form.order_status === 'shipped' ? 'Enter tracking number' : 'Enter rider name & contact'}
                value={form.tracking_info || ''}
                onChange={(e) => setForm((f) => ({ ...f, tracking_info: e.target.value }))}
                className="w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={closeModal}
              className="flex-1 px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white font-semibold hover:border-[var(--gold-primary)]/50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateStatus}
              disabled={
                isSaving || !form.order_status || !(ORDER_STATUS_TRANSITIONS[modal.data.status || 'pending'] || []).includes(form.order_status)
              }
              className={`flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white font-semibold hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center gap-2 ${
                isSaving ||
                !form.order_status ||
                !(ORDER_STATUS_TRANSITIONS[modal.data.status || 'pending'] || []).includes(form.order_status)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
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
