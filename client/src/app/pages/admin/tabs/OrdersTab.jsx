import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { RefreshCw, ShoppingBag, RotateCcw } from 'lucide-react'
import { OrderManagement } from '../../../components/admin/OrderManagement'
import { RefundRequestsTab } from './RefundRequestsTab'
import { adminApi } from '../../../utils/adminApi'

export function OrdersTab({ orders, fetchOrders, user, pagination, showToast, onManageProject, ordersLoading = false }) {
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
    const interval = setInterval(fetchNewRefundCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        fetchOrders ? fetchOrders() : Promise.resolve(),
        fetchNewRefundCount()
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
  ]

  return (
    <motion.div key="orders" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header with Title & Refresh */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[var(--gold-primary)]" />
            Orders & Fulfillment
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Track customer purchases, process fulfillment stages, verify payments, and handle refund requests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)]/50 hover:bg-white/5 transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Orders & Counts"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--gold-primary)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub-tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]/70 backdrop-blur-sm w-fit">
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
              className={`relative inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'text-black shadow-lg shadow-[var(--gold-primary)]/20'
                  : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="orders-subtab-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
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

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {view === 'orders' ? (
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
            />
          </motion.div>
        ) : (
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
      </AnimatePresence>
    </motion.div>
  )
}
