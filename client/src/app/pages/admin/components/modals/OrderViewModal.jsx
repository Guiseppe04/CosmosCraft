import { ModalHeader } from '../shared/ModalHeader'

export function OrderViewModal({ modal, closeModal, getStatusBadge, formatCurrency }) {
  if (!modal.data) return null

  return (
    <>
      <ModalHeader title={`Order #${modal.data.order_number || modal.data.order_id?.slice(0, 8)}`} onClose={closeModal} />
      <div className="mt-6 space-y-3 text-sm">
        {[
          ['Status', <span key="status" className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(modal.data.status)}`}>{modal.data.status || 'Pending'}</span>],
          ['Customer', modal.data.customer_name || modal.data.user_name || '—'],
          ['Date', modal.data.created_at ? new Date(modal.data.created_at).toLocaleDateString() : '—'],
          ['Total', <span key="total" className="text-[var(--gold-primary)] font-bold">{formatCurrency(modal.data.total || modal.data.total_amount)}</span>],
        ].map(([key, val]) => (
          <div key={key} className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-muted)]">{key}</span>
            <span className="text-white font-medium">{val}</span>
          </div>
        ))}
        {modal.data.items && modal.data.items.length > 0 && (
          <div className="mt-4">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Items</p>
            <div className="space-y-2">
              {modal.data.items.map((item, idx) => (
                <div key={idx} className="flex justify-between bg-[var(--bg-primary)] p-3 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-white text-sm">{item.product_name || item.name || 'Item'}</span>
                    <span className="text-[var(--text-muted)] text-xs">Qty: {item.quantity || 1}</span>
                  </div>
                  <span className="text-[var(--gold-primary)] text-sm">{formatCurrency((item.unit_price || item.price || 0) * (item.quantity || 1))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <button onClick={closeModal} className="w-full mt-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all">Close</button>
    </>
  )
}
