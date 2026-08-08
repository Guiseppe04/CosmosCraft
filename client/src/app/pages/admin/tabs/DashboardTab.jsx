import { useMemo } from 'react'
import { motion } from 'motion/react'
import { RefreshCw, Activity, ShoppingBag, Briefcase, Calendar, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency } from '../../../utils/formatCurrency'

const QUICK_ACTIONS = [
  { label: 'View Appointments', tab: 'appointments', color: 'from-[var(--gold-primary)] to-[var(--gold-secondary)]', textColor: 'text-black' },
  { label: 'View Orders', tab: 'orders', color: 'from-blue-500 to-blue-600', textColor: 'text-white' },
  { label: 'View Products', tab: 'products', color: 'from-emerald-500 to-emerald-600', textColor: 'text-white' },
  { label: 'View Projects', tab: 'projects', color: 'from-purple-500 to-purple-600', textColor: 'text-white' },
]

const PULSE_ITEMS = [
  { key: 'inventory', label: 'Inventory health', tab: 'inventory', icon: Activity },
  { key: 'orders', label: 'Orders', tab: 'orders', icon: ShoppingBag },
  { key: 'projects', label: 'Projects', tab: 'projects', icon: Briefcase },
  { key: 'appointments', label: 'Appointments', tab: 'appointments', icon: Calendar },
]

const ORDER_STATUS_COLORS = {
  pending: '#d4af37',
  processing: '#60a5fa',
  shipped: '#a78bfa',
  out_for_delivery: '#818cf8',
  delivered: '#34d399',
  cancelled: '#f87171',
}

function statusVariant(status) {
  const value = String(status || '').toLowerCase()
  if (['completed', 'paid', 'delivered'].includes(value)) return 'success'
  if (['pending', 'approved', 'confirmed', 'ready_for_pickup'].includes(value)) return 'gold'
  if (['processing', 'in_progress', 'shipped', 'out_for_delivery'].includes(value)) return 'info'
  if (['cancelled', 'failed', 'rejected'].includes(value)) return 'danger'
  return 'default'
}

function StatusBadge({ label, variant = 'default' }) {
  const cls = {
    default: 'border-gray-500/30 bg-gray-500/20 text-gray-300',
    success: 'border-green-500/30 bg-green-500/20 text-green-300',
    warning: 'border-amber-500/30 bg-amber-500/20 text-amber-300',
    danger: 'border-red-500/30 bg-red-500/20 text-red-300',
    info: 'border-blue-500/30 bg-blue-500/20 text-blue-300',
    gold: 'border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]',
  }
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${cls[variant] || cls.default}`}>{label}</span>
}

export function DashboardTab({
  user,
  salesReport,
  visibleOrders,
  visibleProjects,
  visibleAppointments,
  inventoryHealthData,
  enhancedOrderStats,
  handleRefresh,
  isLoading,
  setActiveTab,
  lastRefreshed,
}) {
  const orderStatusData = useMemo(() => {
    const counts = {}
    visibleOrders.forEach(o => {
      const status = o.status || 'pending'
      counts[status] = (counts[status] || 0) + 1
    })
    return Object.entries(counts).map(([status, count]) => ({
      status: status.replace(/_/g, ' '),
      count,
      color: ORDER_STATUS_COLORS[status] || '#94a3b8',
    }))
  }, [visibleOrders])

  const todayAppointments = useMemo(
    () => visibleAppointments.filter(a => a.scheduled_at && new Date(a.scheduled_at).toDateString() === new Date().toDateString()),
    [visibleAppointments]
  )

  const pendingAppointments = useMemo(
    () => visibleAppointments.filter(a => ['pending', 'approved', 'confirmed', 'ready_for_pickup'].includes(a.status)),
    [visibleAppointments]
  )

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="space-y-6">
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div>
              <p className="text-[var(--gold-primary)] text-sm font-semibold uppercase tracking-[0.3em] mb-3">Admin Dashboard</p>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Welcome back, {user?.firstName || 'Admin'}</h1>
              <p className="text-[var(--text-muted)] mt-3 max-w-2xl">Monitor sales performance, inventory health, and customer activity in real-time.</p>
              {lastRefreshed && (
                <p className="text-[var(--text-muted)] text-xs mt-2">
                  Last updated: {new Date(lastRefreshed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button onClick={handleRefresh} disabled={isLoading} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--gold-secondary)] transition-all disabled:opacity-60">
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh data
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mt-8">
            {[
              { label: 'Revenue this month', value: formatCurrency(salesReport?.monthlySales || 0), badge: salesReport?.monthlySales > 0 ? '+live' : 'Live', badgeCls: 'bg-green-500/10 text-green-400' },
              { label: 'Total orders', value: visibleOrders.length, badge: 'Order volume', badgeCls: 'bg-blue-500/10 text-blue-400' },
              { label: 'Active projects', value: visibleProjects.filter(p => p.status === 'in_progress').length, badge: 'In progress', badgeCls: 'bg-purple-500/10 text-purple-400' },
              { label: 'Projects on hold', value: visibleProjects.filter(p => p.status === 'on_hold').length, badge: 'Paused', badgeCls: 'bg-amber-500/10 text-amber-400' },
              { label: 'Open appointments', value: pendingAppointments.length, badge: 'Action required', badgeCls: 'bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
                <p className="text-[var(--text-muted)] text-sm">{stat.label}</p>
                <p className="mt-3 text-3xl font-bold text-white">{stat.value}</p>
                <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${stat.badgeCls}`}>{stat.badge}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => setActiveTab(action.tab)}
              className={`flex items-center justify-center rounded-2xl bg-gradient-to-r ${action.color} ${action.textColor} px-4 py-3 text-sm font-semibold transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]`}
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.8fr_1.2fr]">
          <div className="min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-white text-2xl font-semibold">Order Status Distribution</h2>
                <p className="text-[var(--text-muted)] mt-1">Current orders by status.</p>
              </div>
              <button onClick={() => setActiveTab('orders')} className="text-[var(--gold-primary)] text-sm font-semibold hover:underline flex items-center gap-1">
                View all orders <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {orderStatusData.length === 0 ? (
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-8 text-center text-[var(--text-muted)]">No orders yet. Orders will appear here once created.</div>
            ) : (
              <div className="h-72 min-h-[200px] w-full overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderStatusData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="status" stroke="#b0b4bc" fontSize={12} />
                    <YAxis stroke="#b0b4bc" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#131313', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' }}
                      labelStyle={{ color: '#f8fafc' }}
                      itemStyle={{ color: '#d4af37' }}
                      formatter={(value) => [`${value} order${value !== 1 ? 's' : ''}`, 'Count']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {orderStatusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-white text-lg font-semibold">Operational Pulse</h3>
                  <p className="text-[var(--text-muted)] text-sm">Click a metric to navigate.</p>
                </div>
                <span className="text-[var(--gold-primary)] text-sm font-semibold">Real-time</span>
              </div>
              <div className="space-y-3">
                {PULSE_ITEMS.map((item) => {
                  const metrics = {
                    inventory: { value: inventoryHealthData.value, status: inventoryHealthData.status, statusClass: inventoryHealthData.statusClass, iconBg: inventoryHealthData.iconBg },
                    orders: { value: enhancedOrderStats.pending, status: 'Awaiting Payment', statusClass: 'text-amber-400', iconBg: 'bg-amber-500/15' },
                    projects: { value: visibleProjects.filter(p => p.status === 'in_progress').length, status: 'In progress', statusClass: 'text-blue-400', iconBg: 'bg-blue-500/15' },
                    appointments: { value: pendingAppointments.length, status: 'Action required', statusClass: 'text-[var(--gold-primary)]', iconBg: 'bg-[var(--gold-primary)]/15' },
                  }
                  const metric = metrics[item.key]
                  const Icon = item.icon
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.tab)}
                      className="flex items-center justify-between w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 text-left transition-all hover:border-[var(--gold-primary)]/50 hover:bg-[var(--bg-primary)]/80 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`grid h-11 w-11 place-items-center rounded-2xl ${metric.iconBg} transition-transform group-hover:scale-110`}>
                          <Icon className="w-5 h-5 text-[var(--gold-primary)]" />
                        </div>
                        <div>
                          <p className="text-white font-semibold group-hover:text-[var(--gold-primary)] transition-colors">{item.label}</p>
                          <p className={`text-sm ${metric.statusClass}`}>{metric.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-white text-lg font-semibold">{metric.value}</p>
                        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-white text-lg font-semibold">Upcoming appointments</h3>
                  <p className="text-[var(--text-muted)] text-sm">Next customer meetings.</p>
                </div>
                <button onClick={() => setActiveTab('appointments')} className="text-[var(--gold-primary)] text-sm font-semibold hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {pendingAppointments.length === 0 && todayAppointments.length === 0 ? (
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-8 text-center text-[var(--text-muted)]">No upcoming appointments.</div>
              ) : (
                <div className="space-y-3">
                  {(todayAppointments.length > 0 ? todayAppointments : pendingAppointments).slice(0, 4).map((apt) => (
                    <button
                      key={apt.appointment_id}
                      onClick={() => setActiveTab('appointments')}
                      className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 text-left transition-all hover:border-[var(--gold-primary)]/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-semibold truncate">{apt.title || apt.service_name || 'Appointment'}</p>
                        <p className="text-[var(--text-muted)] text-sm truncate">{apt.customer_name || apt.user_name || 'Customer'}</p>
                      </div>
                      <div className="text-right ml-4">
                        <StatusBadge label={apt.status || 'pending'} variant={statusVariant(apt.status)} />
                        <p className="text-[var(--text-muted)] text-xs mt-1">
                          {apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : apt.time || 'TBA'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
