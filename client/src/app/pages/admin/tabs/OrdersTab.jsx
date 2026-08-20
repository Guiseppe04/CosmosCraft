import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { RefreshCw, Package, ArrowLeftRight } from 'lucide-react'
import { OrderManagement } from '../../../components/admin/OrderManagement'
import { RefundRequestsTab } from './RefundRequestsTab'
import { adminApi } from '../../../utils/adminApi'

export function OrdersTab({ orders, fetchOrders, user, pagination, showToast }) {
  const [view, setView] = useState('orders')
  const [newRefundCount, setNewRefundCount] = useState(0)

  const fetchNewRefundCount = async () => {
    try {
      const res = await adminApi.getRefundRequests({ status: 'pending', page: 1, page_size: 1 })
      setNewRefundCount(Number(res.data?.total) || 0)
    } catch {
      // keep the previous count on transient errors
    }
  }

  useEffect(() => {
    fetchNewRefundCount()
    const interval = setInterval(fetchNewRefundCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleToggleView = () => {
    setView(view === 'orders' ? 'refunds' : 'orders')
    if (view === 'refunds') fetchNewRefundCount()
  }

  return (
    <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleToggleView}
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4 text-[var(--gold-primary)]" />
          {view === 'orders' ? 'View Refund Requests' : 'Back to Orders'}
          {newRefundCount > 0 && view === 'orders' && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold leading-none">
              {newRefundCount}
            </span>
          )}
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
