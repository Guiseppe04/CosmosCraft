import { motion } from 'motion/react'
import { RefreshCw, Activity, Clock, Package, Truck, Calendar, BarChart3 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../../utils/formatCurrency'

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
}) {
  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="space-y-6">
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div>
              <p className="text-[var(--gold-primary)] text-sm font-semibold uppercase tracking-[0.3em] mb-3">Admin Dashboard</p>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Welcome back, {user?.firstName || 'Admin'}</h1>
              <p className="text-[var(--text-muted)] mt-3 max-w-2xl">Monitor sales performance, inventory health, and customer activity in real-time.</p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button onClick={handleRefresh} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--gold-secondary)] transition-all">
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
              { label: 'Open appointments', value: visibleAppointments.filter(a => ['pending', 'approved', 'confirmed', 'ready_for_pickup'].includes(a.status)).length, badge: 'Action required', badgeCls: 'bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
                <p className="text-[var(--text-muted)] text-sm">{stat.label}</p>
                <p className="mt-3 text-3xl font-bold text-white">{stat.value}</p>
                <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${stat.badgeCls}`}>{stat.badge}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.8fr_1.2fr]">
          <div className="min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-white text-2xl font-semibold">Performance Trends</h2>
                <p className="text-[var(--text-muted)] mt-1">Revenue across the last 6 months.</p>
              </div>
            </div>
            <div className="h-72 min-h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { month: 'Jan', revenue: 42000 }, { month: 'Feb', revenue: 38000 },
                  { month: 'Mar', revenue: 51000 }, { month: 'Apr', revenue: 47000 },
                  { month: 'May', revenue: 56000 }, { month: 'Jun', revenue: 62000 },
                ]}>
                  <defs>
                    <linearGradient id="dashboardTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d4af37" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="month" stroke="#b0b4bc" fontSize={12} />
                  <YAxis stroke="#b0b4bc" fontSize={12} tickFormatter={(v) => `₱${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#131313', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' }}
                    labelStyle={{ color: '#f8fafc' }}
                    itemStyle={{ color: '#d4af37' }}
                    formatter={(v) => [`₱${v.toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#d4af37" strokeWidth={2} fill="url(#dashboardTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-white text-lg font-semibold">Operational Pulse</h3>
                  <p className="text-[var(--text-muted)] text-sm">Live system health indicators.</p>
                </div>
                <span className="text-[var(--gold-primary)] text-sm font-semibold">Real-time</span>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Inventory health', value: inventoryHealthData.value, status: inventoryHealthData.status, icon: Activity, iconBg: inventoryHealthData.iconBg, statusClass: inventoryHealthData.statusClass },
                  { label: 'Pending orders', value: enhancedOrderStats.pending, status: 'Awaiting Payment', icon: Clock, statusClass: 'text-amber-400', iconBg: 'bg-amber-500/15' },
                  { label: 'Processing', value: enhancedOrderStats.processing, status: 'Being Prepared', icon: Package, statusClass: 'text-blue-400', iconBg: 'bg-blue-500/15' },
                  { label: 'Out for Delivery', value: enhancedOrderStats.out_for_delivery, status: 'On the Way', icon: Truck, statusClass: 'text-indigo-400', iconBg: 'bg-indigo-500/15' },
                  { label: 'Open appointments', value: visibleAppointments.filter(a => a.status === 'pending').length, status: 'Upcoming', icon: Calendar, statusClass: 'text-[var(--gold-primary)]', iconBg: 'bg-[var(--gold-primary)]/15' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="flex items-center justify-between rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                      <div className="flex items-center gap-4">
                        <div className={`grid h-11 w-11 place-items-center rounded-2xl ${item.iconBg}`}>
                          <Icon className="w-5 h-5 text-[var(--gold-primary)]" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{item.label}</p>
                          <p className={`text-sm ${item.statusClass}`}>{item.status}</p>
                        </div>
                      </div>
                      <p className="text-white text-lg font-semibold">{item.value}</p>
                    </div>
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
                <button onClick={() => setActiveTab('appointments')} className="text-[var(--gold-primary)] text-sm font-semibold hover:underline">View all</button>
              </div>
              {visibleAppointments.length === 0 ? (
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-8 text-center text-[var(--text-muted)]">No upcoming appointments.</div>
              ) : (
                <div className="space-y-3">
                  {visibleAppointments.slice(0, 4).map((apt) => (
                    <div key={apt.appointment_id} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-white font-semibold">{apt.title || 'Appointment'}</p>
                          <p className="text-[var(--text-muted)] text-sm">{apt.customer_name || apt.user_name || 'Customer'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[var(--gold-primary)] font-semibold">{apt.time || 'TBA'}</p>
                          <p className="text-[var(--text-muted)] text-xs">{apt.date ? new Date(apt.date).toLocaleDateString() : apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleDateString() : '—'}</p>
                        </div>
                      </div>
                    </div>
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
