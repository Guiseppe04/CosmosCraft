import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { RefreshCw, ShoppingBag, RotateCcw, Star } from 'lucide-react'
import { OrderManagement } from '../../../components/admin/OrderManagement'
import { RefundRequestsTab } from './RefundRequestsTab'
import ReviewModerationTab from './ReviewModerationTab'
import { adminApi } from '../../../utils/adminApi'
import { useSocketEvent } from '../../../context/SocketContext'

export function OrdersTab({ orders, fetchOrders, user, pagination, showToast, onManageProject, ordersLoading = false, initialPaymentStatusFilter = 'all', initialStatusFilter = 'all', initialOrder = null, onPaymentStatusUpdated = null }) {
  const [view, setView] = useState('orders')
  const [newRefundCount, setNewRefundCount] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

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
  }, [])

  useSocketEvent('refund:created', () => {
    fetchNewRefundCount()
    showToast?.('New refund request submitted!', 'info')
  })

  useSocketEvent('refund:updated', () => {
    fetchNewRefundCount()
  })

  // OrderManagement reloads itself on these events while the orders view is open.
  // Only refresh when another sub-tab is active so the order count stays correct
  // without issuing a second request for the same event.
  const refreshOrdersWhenHidden = () => {
    if (view !== 'orders') fetchOrders?.()
  }

  useSocketEvent('order:created', refreshOrdersWhenHidden)
  useSocketEvent('order:updated', refreshOrdersWhenHidden)
  useSocketEvent('payment:created', refreshOrdersWhenHidden)
  useSocketEvent('payment:updated', refreshOrdersWhenHidden)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        fetchOrders ? fetchOrders() : Promise.resolve(),
        fetchNewRefundCount(),
      ])
    } catch {
      // The individual request helpers already retain data and report failures.
    } finally {
      setIsRefreshing(false)
    }
  }

  const subTabs = [
    {
      id: 'orders',
      label: 'All Orders',
      icon: ShoppingBag,
      count: pagination?.total ?? orders?.length ?? null,
    },
    {
      id: 'refunds',
      label: 'Refund & Returns',
      icon: RotateCcw,
      badge: newRefundCount > 0 ? newRefundCount : null,
      badgeColor: 'bg-red-500 text-white',
    },
    {
      id: 'ratings',
      label: 'Ratings & Feedback',
      icon: Star,
    },
  ]


  return (
    <motion.div key="orders" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
      {/* Sub-tab Switcher and Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {subTabs.map((tab) => {
            const isActive = view === tab.id
            const TabIcon = tab.icon

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setView(tab.id)
                  if (tab.id === 'refunds') fetchNewRefundCount()
                }}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <TabIcon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-[var(--gold-primary)]'}`} />
                  {tab.label}
                  {tab.count != null && !isActive && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white/10 text-[var(--text-muted)]">
                      {tab.count}
                    </span>
                  )}
                  {tab.count != null && isActive && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-black/20 text-black">
                      {tab.count}
                    </span>
                  )}
                  {tab.badge != null && (
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold leading-none ${tab.badgeColor} animate-pulse`}>
                      {tab.badge}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)]/50 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh Orders & Counts"
            aria-label="Refresh orders and counts"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--gold-primary)]' : ''}`} />
          </button>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {view === 'orders' && (
          <motion.div
            key="orders-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <OrderManagement
              orders={orders}
              onRefresh={fetchOrders}
              user={user}
              pagination={pagination}
              onManageProject={onManageProject}
              loading={ordersLoading}
              initialPaymentStatusFilter={initialPaymentStatusFilter}
              initialStatusFilter={initialStatusFilter}
              initialOrder={initialOrder}
              onPaymentStatusUpdated={onPaymentStatusUpdated}
            />
          </motion.div>
        )}

        {view === 'refunds' && (
          <motion.div
            key="refunds-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <RefundRequestsTab showToast={showToast} user={user} />
          </motion.div>
        )}

        {view === 'ratings' && (
          <motion.div
            key="ratings-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <ReviewModerationTab showToast={showToast} user={user} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
