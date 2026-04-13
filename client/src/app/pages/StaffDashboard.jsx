import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  BarChart3, Calendar, CheckCircle, XCircle, AlertCircle,
  Clock, Package, Briefcase, Users, X,
  Eye, TrendingUp, ChevronLeft, ChevronRight, User,
  Activity, ShoppingBag, RefreshCw, ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { staffApi } from '../utils/staffApi'
import { formatCurrency } from '../utils/formatCurrency'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useSmartPolling } from '../hooks/useSmartPolling'
import { useDebounce } from '../hooks/useDebounce'
import ProjectTaskTracker from '../components/projects/ProjectTaskTracker'
import { Topbar } from '../components/admin/Topbar'

// ── Skeleton Loader ──────────────────────────────────────────────────────────
function SkeletonRow({ cols = 5 }) {
  return (
    <tr className="border-b border-[var(--border)]/30">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-4 px-6">
          <div className="h-4 bg-white/10 animate-pulse rounded" />
        </td>
      ))}
    </tr>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
      <div className="h-3 bg-white/10 rounded w-1/2 mb-4" />
      <div className="h-2 bg-white/10 rounded mb-1" />
      <div className="h-2 bg-white/10 rounded w-4/5" />
    </div>
  )
}

function EmptyState({ icon: Icon, label, description }) {
  return (
    <div className="text-center py-16 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl">
      <div className="w-16 h-16 rounded-2xl bg-[var(--gold-primary)]/10 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-[var(--gold-primary)]" />
      </div>
      <p className="text-white font-semibold">{label}</p>
      {description && <p className="text-[var(--text-muted)] text-sm mt-1">{description}</p>}
    </div>
  )
}

function StatusBadge({ label, variant = 'default' }) {
  const map = {
    default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    gold: 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/30',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[variant] || map.default}`}>
      {label}
    </span>
  )
}

function statusVariant(status) {
  const map = {
    completed: 'success', complete: 'success', approved: 'success', active: 'success',
    in_progress: 'info', processing: 'info', ongoing: 'info',
    pending: 'gold', scheduled: 'gold', not_started: 'default',
    cancelled: 'danger', failed: 'danger', rejected: 'danger', no_show: 'warning',
  }
  return map[status?.toLowerCase()] || 'default'
}

// ── StaffDashboard ───────────────────────────────────────────────────────────
export function StaffDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [toast, setToast] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Data
  const [projects, setProjects] = useState([])
  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [appointments, setAppointments] = useState([])
  const [inventoryStats, setInventoryStats] = useState(null)

  // Loading states
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [loadingAppointments, setLoadingAppointments] = useState(false)

  // Modal state
  const [modal, setModal] = useState({ open: false, type: null, data: null })
  const [confirm, setConfirm] = useState({ open: false, title: '', description: '', onConfirm: null, isBusy: false, variant: 'warning' })
  const [form, setForm] = useState({})

  // ── Toast ──────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Confirm helpers ────────────────────────────────────────────────────
  const openConfirm = ({ title, description, onConfirm, variant = 'warning' }) =>
    setConfirm({ open: true, title, description, onConfirm, isBusy: false, variant })
  const closeConfirm = () => setConfirm(c => ({ ...c, open: false }))
  const handleConfirmAction = async () => {
    setConfirm(c => ({ ...c, isBusy: true }))
    try { await confirm.onConfirm() }
    finally { setConfirm(c => ({ ...c, open: false, isBusy: false })) }
  }

  // ── Modal helpers ──────────────────────────────────────────────────────
  const openModal = (type, data = null) => { setForm(data ? { ...data } : {}); setModal({ open: true, type, data }) }
  const closeModal = () => setModal({ open: false, type: null, data: null })

  // ── Data fetchers ──────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const res = await staffApi.getAllProjects()
      setProjects(Array.isArray(res.data) ? res.data : res.data?.projects || [])
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingProjects(false) }
  }, [showToast])

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const res = await staffApi.getOrders()
      setOrders(Array.isArray(res.data) ? res.data : res.data?.orders || [])
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingOrders(false) }
  }, [showToast])

  const fetchInventory = useCallback(async () => {
    try {
      const statsRes = await staffApi.getInventorySummary()
      setInventoryStats(statsRes.data || {})
      const prodsRes = await staffApi.getInventoryProducts({ search: debouncedSearch })
      setInventory(Array.isArray(prodsRes.data) ? prodsRes.data : prodsRes.data?.products || [])
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingInventory(false) }
  }, [debouncedSearch, showToast])

  const fetchAppointments = useCallback(async () => {
    setLoadingAppointments(true)
    try {
      const res = await staffApi.getAppointments()
      setAppointments(Array.isArray(res.data) ? res.data : res.data?.appointments || [])
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingAppointments(false) }
  }, [showToast])

  // ── Polling: fetch all on load, poll active tab ────────────────────────
  const pollingFn = useCallback(async () => {
    const map = {
      overview: async () => { await fetchProjects(); await fetchAppointments() },
      projects: fetchProjects,
      orders: fetchOrders,
      inventory: fetchInventory,
      appointments: fetchAppointments,
      schedule: fetchAppointments,
    }
    return map[activeTab]?.()
  }, [activeTab, fetchProjects, fetchOrders, fetchInventory, fetchAppointments])

  useSmartPolling(pollingFn, { interval: 5000, maxInterval: 60000, backoffFactor: 1.5, enabled: true })

  const handleRefresh = () => {
    setIsLoading(true)
    pollingFn()?.finally(() => setIsLoading(false))
  }

  // ── Aggregated counts for overview tab ────────────────────────────────
  const totalProjects = projects.length
  const inProgressProjects = projects.filter(p => p.status === 'in_progress').length
  const completedProjects = projects.filter(p => p.status === 'completed').length
  const todayAppts = appointments.filter(a => {
    const d = a.scheduled_at || a.date
    return d && new Date(d).toDateString() === new Date().toDateString()
  }).length

  // ── Tabs ───────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: 'My Tasks', icon: BarChart3 },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },

    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'schedule', label: 'Schedule', icon: Clock },
  ]

  // ── Input styles ───────────────────────────────────────────────────────
  const inputCls = 'w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm'
  const labelCls = 'block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2'

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            className={`fixed top-24 right-6 z-[200] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold border ${toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-green-500/10 border-green-500/30 text-green-400'
              }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        description={confirm.description}
        variant={confirm.variant}
        isBusy={confirm.isBusy}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirm}
      />

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen bg-[var(--surface-dark)] border-r border-[var(--border)] transition-all duration-300 z-40 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-[var(--text-light)]" /> : <ChevronLeft className="w-4 h-4 text-[var(--text-light)]" />}
        </button>

        <div className="h-24 px-4 py-4 border-b border-[var(--border)] flex items-center justify-between relative">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <img src="/favicon.png" alt="CosmosCraft" className="w-10 h-10 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[var(--text-light)] font-black text-lg tracking-tight">CosmosCraft</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <img src="/favicon.png" alt="CosmosCraft" className="w-10 h-10 flex-shrink-0 mx-auto" />
          )}
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] border-2 border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)] border-2 border-transparent'
                  }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-[var(--text-dark)]' : 'text-[var(--text-muted)]'}`} />
                {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}
              </button>
            )
          })}
        </nav>

      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 bg-[var(--bg-primary)] ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <Topbar title={tabs.find(t => t.id === activeTab)?.label || 'Dashboard'} userRole="staff" />
        <main className="p-6 pt-6 space-y-6">

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6">
                <p className="text-[var(--gold-primary)] text-sm font-semibold uppercase tracking-widest mb-2">Staff Portal</p>
                <h2 className="text-3xl font-bold text-white">Welcome back, {user?.firstName || user?.first_name || 'Staff'}</h2>
                <p className="text-[var(--text-muted)] mt-1">Here's a summary of your assigned work.</p>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {[
                    { label: 'Total Projects', value: totalProjects, color: 'text-white', icon: Briefcase },
                    { label: 'In Progress', value: inProgressProjects, color: 'text-blue-400', icon: Activity },
                    { label: 'Completed', value: completedProjects, color: 'text-green-400', icon: CheckCircle },
                    { label: "Today's Appointments", value: todayAppts, color: 'text-[var(--gold-primary)]', icon: Calendar },
                  ].map(stat => {
                    const Icon = stat.icon
                    return (
                      <div key={stat.label} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]">
                        <Icon className="w-5 h-5 text-[var(--text-muted)] mb-3" />
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[var(--text-muted)] text-sm mt-1">{stat.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold text-lg">Recent Projects</h3>
                    <button onClick={() => setActiveTab('projects')} className="text-[var(--gold-primary)] text-sm hover:underline">View all</button>
                  </div>
                  {loadingProjects ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
                  ) : projects.length === 0 ? (
                    <EmptyState icon={Briefcase} label="No projects assigned" />
                  ) : (
                    <div className="space-y-3">
                      {projects.slice(0, 4).map(p => (
                        <div key={p.project_id} className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-white font-medium">{p.name || p.title}</p>
                            <StatusBadge label={(p.status || 'N/A').replace('_', ' ')} variant={statusVariant(p.status)} />
                          </div>
                          {p.progress !== undefined && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-[var(--text-muted)]">Progress</span>
                                <span className="text-[var(--gold-primary)]">{p.progress}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full">
                                <div className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-full" style={{ width: `${p.progress}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold text-lg">Today's Appointments</h3>
                    <button onClick={() => setActiveTab('appointments')} className="text-[var(--gold-primary)] text-sm hover:underline">View all</button>
                  </div>
                  {loadingAppointments ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
                  ) : appointments.length === 0 ? (
                    <EmptyState icon={Calendar} label="No appointments today" />
                  ) : (
                    <div className="space-y-3">
                      {appointments.slice(0, 4).map(a => {
                        const d = a.scheduled_at || a.date
                        return (
                          <div key={a.appointment_id} className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-white font-medium">{a.title || a.service_name || 'Appointment'}</p>
                                <p className="text-[var(--text-muted)] text-sm">{a.customer_name || a.user_name || 'Customer'}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[var(--gold-primary)] font-semibold text-sm">{d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                                <StatusBadge label={a.status || 'pending'} variant={statusVariant(a.status)} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── PROJECTS ──────────────────────────────────────────────── */}
          {activeTab === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {loadingProjects ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : projects.length === 0 ? (
                <EmptyState icon={Briefcase} label="No projects available" description="Check back later or contact your admin." />
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map(p => (
                    <motion.div key={p.project_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold">{p.name || p.title || 'Untitled'}</h3>
                          <p className="text-[var(--text-muted)] text-xs">{p.customer_name || p.user_name || '—'}</p>
                        </div>
                        <StatusBadge label={(p.status || 'N/A').replace('_', ' ')} variant={statusVariant(p.status)} />
                      </div>

                      {p.progress !== undefined && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-muted)]">Progress</span>
                            <span className="text-[var(--gold-primary)]">{p.progress}%</span>
                          </div>
                          <div className="h-2 bg-[var(--bg-primary)] rounded-full">
                            <div className="h-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-full" style={{ width: `${p.progress}%` }} />
                          </div>
                        </div>
                      )}

                      {p.estimated_completion_date && (
                        <p className="text-[var(--text-muted)] text-xs mb-4">
                          Due: {new Date(p.estimated_completion_date).toLocaleDateString()}
                        </p>
                      )}

                      {/* Stage update controls - Read Only */}
                      <div className="space-y-2 pt-4 border-t border-[var(--border)]">
                        <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider">Current Stage</label>
                        <div className="flex gap-2">
                          <div className="flex-1 py-2 text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg text-center">
                            {p.status === 'in_progress' ? 'In Progress' : p.status === 'completed' ? 'Completed' : 'Not Started'}
                          </div>
                        </div>
                        <div className="w-full py-2 text-xs font-semibold bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 rounded-lg text-center">
                          <Activity className="w-3 h-3 inline mr-1" /> View Tasks
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── ORDERS ────────────────────────────────────────────────── */}
          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {loadingOrders ? (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <table className="w-full"><tbody>{[...Array(5)].map((_, i) => <SkeletonRow cols={5} key={i} />)}</tbody></table>
                </div>
              ) : orders.length === 0 ? (
                <EmptyState icon={ShoppingBag} label="No orders found" />
              ) : (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                        <tr>
                          {['Order #', 'Customer', 'Date', 'Total', 'Status', 'Actions'].map(col => (
                            <th key={col} className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(order => (
                          <tr key={order.order_id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-primary)]/50 transition-colors">
                            <td className="py-4 px-6 text-white font-mono text-sm">#{order.order_number || order.order_id?.slice(0, 8)}</td>
                            <td className="py-4 px-6">
                              <p className="text-white">{order.customer_name || order.user_name || '—'}</p>
                              <p className="text-[var(--text-muted)] text-xs">{order.customer_email || '—'}</p>
                            </td>
                            <td className="py-4 px-6 text-[var(--text-muted)] text-sm">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</td>
                            <td className="py-4 px-6 text-[var(--gold-primary)] font-bold">{formatCurrency(order.total || order.total_amount, true)}</td>
                            <td className="py-4 px-6">
                              <StatusBadge label={order.status || 'pending'} variant={statusVariant(order.status)} />
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-[var(--text-muted)] text-xs">View Only</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── INVENTORY ─────────────────────────────────────────────── */}
          {activeTab === 'inventory' && (
            <motion.div key="inventory" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {loadingInventory ? (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <table className="w-full"><tbody>{[...Array(5)].map((_, i) => <SkeletonRow cols={5} key={i} />)}</tbody></table>
                </div>
              ) : inventory.length === 0 ? (
                <EmptyState icon={Package} label="No inventory data" description="Inventory is managed by admin." />
              ) : (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-lg">Stock Overview</h3>
                      <p className="text-[var(--text-muted)] text-sm">View current inventory levels.</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-[var(--border)]/50">
                          <tr>
                            {['Item Description', 'SKU / Type', 'Capacity', 'Metric', 'Status', 'Manage'].map(c => (
                              <th key={c} className="py-4 pr-6 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-[0.2em]">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {inventory.map((item, i) => {
                            const itemName = item.name
                            const sku = item.sku || '—'
                            const stock = Number(item.stock ?? item.qty ?? 0)
                            const threshold = Number(item.low_stock_threshold ?? 10)
                            const isCritical = stock <= 5
                            const isWarning = !isCritical && stock <= 15
                            const statusLabel = stock === 0 ? 'Out of Stock' : isCritical ? 'Critical' : isWarning ? 'Warning' : 'Healthy'
                            const statusCls = stock === 0 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                              : isCritical
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 drop-shadow'
                                : isWarning
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'

                            // Capacity Bar calc
                            const maxCapacity = Math.max(stock * 2, threshold * 4, 20)
                            const pct = Math.min((stock / maxCapacity) * 100, 100)

                            return (
                              <tr key={item.product_id || i} className="border-b border-[var(--border)]/30 hover:bg-white/5 transition-colors group">
                                <td className="py-5 pr-6 text-white font-medium">{itemName}</td>
                                <td className="py-5 pr-6 text-[var(--text-muted)] font-mono text-xs">{sku}</td>
                                
                                {/* Capacity Bar */}
                                <td className="py-5 pr-6 w-48">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${stock === 0 ? 'bg-red-500' : isCritical ? 'bg-orange-400' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={`text-xs font-mono font-bold ${stock === 0 ? 'text-red-500' : 'text-white'}`}>{stock}</span>
                                  </div>
                                </td>

                                <td className="py-5 pr-6 text-[var(--text-muted)] text-sm font-mono">{threshold}</td>
                                
                                <td className="py-5 pr-6">
                                  <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider ${statusCls}`}>{statusLabel}</span>
                                </td>
                                
                                <td className="py-5 pr-6">
                                  <span className="text-[var(--text-muted)] text-xs">View Only</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── APPOINTMENTS ──────────────────────────────────────────── */}
          {activeTab === 'appointments' && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {loadingAppointments ? (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <table className="w-full"><tbody>{[...Array(5)].map((_, i) => <SkeletonRow cols={5} key={i} />)}</tbody></table>
                </div>
              ) : appointments.length === 0 ? (
                <EmptyState icon={Calendar} label="No appointments" description="All appointments will appear here." />
              ) : (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                        <tr>
                          {['Title', 'Customer', 'Date & Time', 'Service', 'Status', 'Actions'].map(col => (
                            <th key={col} className="text-left py-4 px-6 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map(apt => {
                          const d = apt.scheduled_at || apt.date
                          return (
                            <tr key={apt.appointment_id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-primary)]/50 transition-colors">
                              <td className="py-4 px-6">
                                <p className="text-white font-medium">{apt.title || apt.service_name || 'Appointment'}</p>
                                {apt.notes && <p className="text-[var(--text-muted)] text-xs truncate max-w-xs">{apt.notes}</p>}
                              </td>
                              <td className="py-4 px-6">
                                <p className="text-white">{apt.customer_name || apt.user_name || '—'}</p>
                                <p className="text-[var(--text-muted)] text-xs">{apt.customer_email || '—'}</p>
                              </td>
                              <td className="py-4 px-6">
                                <p className="text-white">{d ? new Date(d).toLocaleDateString() : '—'}</p>
                                <p className="text-[var(--text-muted)] text-sm">{d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                              </td>
                              <td className="py-4 px-6 text-[var(--text-muted)]">{apt.service_name || 'Consultation'}</td>
                              <td className="py-4 px-6">
                                <StatusBadge label={apt.status || 'pending'} variant={statusVariant(apt.status)} />
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-[var(--text-muted)] text-xs">View Only</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── SCHEDULE ──────────────────────────────────────────────── */}
          {activeTab === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-semibold text-lg">Upcoming Schedule</h3>
                  <p className="text-[var(--text-muted)] text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                {loadingAppointments ? (
                  <div className="space-y-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : appointments.length === 0 ? (
                  <EmptyState icon={Clock} label="No scheduled items" description="Your appointments and project deadlines will appear here." />
                ) : (
                  <div className="space-y-4">
                    {appointments.map(apt => {
                      const d = apt.scheduled_at || apt.date
                      const isToday = d && new Date(d).toDateString() === new Date().toDateString()
                      return (
                        <div key={apt.appointment_id} className={`flex items-center gap-5 p-4 rounded-xl border transition-all ${isToday ? 'border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/5' : 'border-[var(--border)] bg-[var(--bg-primary)]'}`}>
                          <div className={`text-center rounded-xl p-3 min-w-[56px] ${isToday ? 'bg-[var(--gold-primary)] text-black' : 'bg-[var(--bg-primary)] border border-[var(--border)] text-white'}`}>
                            <p className="text-xs font-semibold">{d ? new Date(d).toLocaleDateString('en-US', { month: 'short' }) : '—'}</p>
                            <p className="text-xl font-bold leading-none">{d ? new Date(d).getDate() : '—'}</p>
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-semibold">{apt.title || apt.service_name || 'Appointment'}</p>
                            <p className="text-[var(--text-muted)] text-sm">{apt.customer_name || apt.user_name || 'Customer'} • {d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                          </div>
                          <StatusBadge label={apt.status || 'pending'} variant={statusVariant(apt.status)} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Project deadlines */}
              {projects.filter(p => p.estimated_completion_date).length > 0 && (
                <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
                  <h3 className="text-white font-semibold text-lg mb-4">Project Deadlines</h3>
                  <div className="space-y-3">
                    {projects.filter(p => p.estimated_completion_date).slice(0, 5).map(p => {
                      const deadline = new Date(p.estimated_completion_date)
                      const isPast = deadline < new Date()
                      const isSoon = !isPast && (deadline - new Date()) < 7 * 24 * 60 * 60 * 1000
                      return (
                        <div key={p.project_id} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isPast ? 'bg-red-400' : isSoon ? 'bg-amber-400' : 'bg-green-400'}`} />
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">{p.name || p.title}</p>
                            <p className="text-[var(--text-muted)] text-xs">{deadline.toLocaleDateString()}</p>
                          </div>
                          <StatusBadge
                            label={isPast ? 'Overdue' : isSoon ? 'Due Soon' : 'On Track'}
                            variant={isPast ? 'danger' : isSoon ? 'warning' : 'success'}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </main>
      </div>

      {/* ── MODAL ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal.open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) closeModal() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-8 w-full shadow-2xl overflow-y-auto ${modal.type === 'project_tasks' ? 'max-w-6xl h-[90vh]' : 'max-w-lg max-h-[90vh]'}`}
            >

              {/* Project Tasks */}
              {modal.type === 'project_tasks' && modal.data && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Project Tasks</h2>
                    <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
                  </div>
                  <ProjectTaskTracker projectId={modal.data.project_id} isAdmin={false} />
                </>
              )}

              {/* Stock Adjust - Removed for read-only access */}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default StaffDashboard
