import { useState } from 'react'
import { motion } from 'motion/react'
import { RefreshCw, Package, ArrowLeftRight } from 'lucide-react'
import { OrderManagement } from '../../../components/admin/OrderManagement'
import { RefundRequestsTab } from './RefundRequestsTab'

export function OrdersTab({ orders, fetchOrders, user, pagination, showToast }) {
  const [view, setView] = useState('orders')

  return (
    <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => setView(view === 'orders' ? 'refunds' : 'orders')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4 text-[var(--gold-primary)]" />
          {view === 'orders' ? 'View Refund Requests' : 'Back to Orders'}
        </button>
        {view === 'refunds' && (
          <span className="text-xs text-[var(--text-muted)]">Manage customer refund requests from the orders section</span>
        )}
      </div>

      {view === 'orders' ? (
        <OrderManagement orders={orders} onRefresh={fetchOrders} user={user} pagination={pagination} />
      ) : (
        <RefundRequestsTab showToast={showToast} />
      )}
    </motion.div>
  )
}
