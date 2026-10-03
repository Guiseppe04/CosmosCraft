import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  ShoppingBag,
  Briefcase,
  Activity,
  DollarSign,
  TrendingUp,
  Package,
  BarChart2,
  Wrench,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatCurrency } from '../../../utils/formatCurrency'

/* ─── Helper Functions ─── */

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

function getCustomerName(order) {
  if (!order) return 'Unknown'
  if (order.first_name && order.last_name) return `${order.first_name} ${order.last_name}`
  return order.customer_name || order.user_name || order.name || order.email || 'Customer'
}

function getOrderTotal(order) {
  if (!order) return 0
  if (Number.isFinite(Number(order.total))) return Number(order.total)
  if (Number.isFinite(Number(order.total_amount))) return Number(order.total_amount)
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.reduce(
      (sum, item) =>
        sum +
        (Number(item.unit_price ?? item.price ?? 0) || 0) *
          (Number(item.quantity ?? item.qty ?? 1) || 1),
      0
    )
  }
  return 0
}

function formatRecordTimeOrDate(dateVal) {
  if (!dateVal) return '—'
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) return '—'
  const isToday = d.toDateString() === new Date().toDateString()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function StatusBadge({ status }) {
  const s = String(status || 'unknown').toLowerCase().trim()

  let cls = 'border-[var(--border)] bg-white/5 text-[var(--text-muted)]'
  let label = s.replace(/_/g, ' ')

  if (['pending', 'under_review', 'proof_submitted', 'awaiting_payment'].includes(s)) {
    cls = 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  } else if (['confirmed', 'approved', 'paid', 'completed', 'delivered', 'received'].includes(s)) {
    cls = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  } else if (['processing', 'in_progress', 'shipped', 'out_for_delivery'].includes(s)) {
    cls = 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  } else if (['cancelled', 'rejected', 'failed', 'no_show', 'voided'].includes(s)) {
    cls = 'border-red-500/30 bg-red-500/10 text-red-400'
  } else if (['on_hold'].includes(s)) {
    cls = 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  )
}

/* ─── Main Component ─── */

export function DashboardTab({
  user,
  salesReport,
  visibleOrders = [],
  visibleProjects = [],
  visibleAppointments = [],
  inventoryHealthData,
  enhancedOrderStats,
  isLoading,
  setActiveTab,
}) {
  const [salesTrendMetric, setSalesTrendMetric] = useState('net')

  // `salesReport` stays null until the first dashboard fetch resolves, so it is
  // a reliable "nothing rendered yet" signal alongside the shared isLoading flag.
  const showSkeleton = Boolean(isLoading) || salesReport == null

  /* ── 1. Consolidated Business Summary ── */
  const summary = useMemo(() => {
    const orders = Array.isArray(visibleOrders) ? visibleOrders : []
    const projects = Array.isArray(visibleProjects) ? visibleProjects : []
    const appointments = Array.isArray(visibleAppointments) ? visibleAppointments : []

    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    // Monthly orders from visibleOrders
    const monthOrders = orders.filter((o) => {
      if (!o.created_at) return false
      const d = new Date(o.created_at)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    const monthRevenueFromOrders = monthOrders.reduce(
      (sum, o) => sum + getOrderTotal(o),
      0
    )

    // Derived Revenue
    const revenue =
      salesReport?.netSales != null
        ? Number(salesReport.netSales)
        : salesReport?.grossSales != null
        ? Number(salesReport.grossSales)
        : monthRevenueFromOrders

    // Orders awaiting payment or verification
    const awaitingPaymentOrders = orders.filter((o) => {
      const ps = String(o.payment_status || '').toLowerCase()
      const os = String(o.status || '').toLowerCase()
      return (
        os === 'pending' ||
        ['pending', 'under_review', 'proof_submitted'].includes(ps)
      )
    }).length

    // Projects breakdown
    const inProgressProjects = projects.filter((p) => p.status === 'in_progress').length
    const onHoldProjects = projects.filter((p) => p.status === 'on_hold').length
    const activeProjects = projects.filter((p) =>
      ['in_progress', 'not_started'].includes(p.status)
    ).length

    // Appointments breakdown
    const todayAppointments = appointments.filter(
      (a) =>
        a.scheduled_at &&
        new Date(a.scheduled_at).toDateString() === now.toDateString() &&
        a.status !== 'cancelled'
    ).length
    const pendingAppointments = appointments.filter(
      (a) => a.status === 'pending'
    ).length
    const activeAppointments = appointments.filter(
      (a) => !['cancelled', 'completed', 'no_show'].includes(a.status)
    ).length

    return {
      revenue,
      totalOrders: orders.length,
      monthOrdersCount: monthOrders.length,
      awaitingPaymentOrders,
      activeProjects,
      inProgressProjects,
      onHoldProjects,
      activeAppointments,
      todayAppointments,
      pendingAppointments,
    }
  }, [visibleOrders, visibleProjects, visibleAppointments, salesReport])

  /* ── 2. Needs Attention Items (Prioritized by Urgency) ── */
  const attentionItems = useMemo(() => {
    const orders = Array.isArray(visibleOrders) ? visibleOrders : []
    const projects = Array.isArray(visibleProjects) ? visibleProjects : []
    const appointments = Array.isArray(visibleAppointments) ? visibleAppointments : []
    const items = []

    // Priority 1: Payment Verification Required (Customer submitted proof, admin action required)
    const verificationOrders = orders.filter((o) => {
      const ps = String(o.payment_status || '').toLowerCase()
      return ps === 'under_review' || ps === 'proof_submitted'
    })
    if (verificationOrders.length > 0) {
      items.push({
        id: 'orders-verification',
        priority: 1,
        severity: 'high',
        label: `${verificationOrders.length} order${
          verificationOrders.length > 1 ? 's' : ''
        } awaiting payment verification`,
        actionLabel: 'View Orders',
        tab: 'orders',
      })
    }

    // Priority 2: Appointments Awaiting Confirmation (Customers waiting for schedule confirmation)
    const pendingApts = appointments.filter((a) => a.status === 'pending')
    if (pendingApts.length > 0) {
      items.push({
        id: 'appointments-pending',
        priority: 2,
        severity: 'high',
        label: `${pendingApts.length} appointment${
          pendingApts.length > 1 ? 's' : ''
        } awaiting confirmation`,
        actionLabel: 'View Appointments',
        tab: 'appointments',
      })
    }

    // Priority 3: Project Cancellation Requests (Customer requested cancellation)
    const cancelReqProjects = projects.filter(
      (p) => p.cancel_requested_at && !p.cancel_approved_at && p.status !== 'cancelled'
    )
    if (cancelReqProjects.length > 0) {
      items.push({
        id: 'projects-cancel-requests',
        priority: 3,
        severity: 'high',
        label: `${cancelReqProjects.length} project cancellation request${
          cancelReqProjects.length > 1 ? 's' : ''
        }`,
        actionLabel: 'View Projects',
        tab: 'projects',
      })
    }

    // Priority 4: Orders Awaiting Payment (Unpaid orders)
    const unpaidOrders = orders.filter((o) => {
      const ps = String(o.payment_status || '').toLowerCase()
      const os = String(o.status || '').toLowerCase()
      return (
        (os === 'pending' || ps === 'pending') &&
        ps !== 'under_review' &&
        ps !== 'proof_submitted'
      )
    })
    if (unpaidOrders.length > 0) {
      items.push({
        id: 'orders-unpaid',
        priority: 4,
        severity: 'medium',
        label: `${unpaidOrders.length} order${
          unpaidOrders.length > 1 ? 's' : ''
        } awaiting payment`,
        actionLabel: 'View Orders',
        tab: 'orders',
      })
    }

    // Priority 5: Projects Past Estimated Completion Date
    const now = new Date()
    const overdueProjects = projects.filter((p) => {
      if (['completed', 'cancelled'].includes(p.status)) return false
      if (!p.estimated_completion_date) return false
      const dueDate = new Date(p.estimated_completion_date)
      return !isNaN(dueDate.getTime()) && dueDate < now
    })
    if (overdueProjects.length > 0) {
      items.push({
        id: 'projects-overdue',
        priority: 5,
        severity: 'medium',
        label: `${overdueProjects.length} project${
          overdueProjects.length > 1 ? 's' : ''
        } past estimated completion`,
        actionLabel: 'View Projects',
        tab: 'projects',
      })
    }

    // Priority 6: Inventory Status Warning or Critical
    if (
      inventoryHealthData?.status &&
      ['Critical', 'Warning'].includes(inventoryHealthData.status)
    ) {
      items.push({
        id: 'inventory-health',
        priority: 6,
        severity: inventoryHealthData.status === 'Critical' ? 'high' : 'medium',
        label: `Inventory health is ${inventoryHealthData.status.toLowerCase()} (${
          inventoryHealthData.value || 'Low'
        } healthy)`,
        actionLabel: 'View Inventory',
        tab: 'inventory',
      })
    }

    // Priority 7: Projects On Hold
    const onHoldProjects = projects.filter((p) => p.status === 'on_hold')
    if (onHoldProjects.length > 0) {
      items.push({
        id: 'projects-on-hold',
        priority: 7,
        severity: 'medium',
        label: `${onHoldProjects.length} project${
          onHoldProjects.length > 1 ? 's' : ''
        } on hold`,
        actionLabel: 'View Projects',
        tab: 'projects',
      })
    }

    // Sort by explicit priority
    return items.sort((a, b) => a.priority - b.priority)
  }, [visibleOrders, visibleProjects, visibleAppointments, inventoryHealthData])

  /* ── 3. Recent Orders ── */
  const recentOrders = useMemo(() => {
    if (!Array.isArray(visibleOrders)) return []
    return [...visibleOrders]
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
        return timeB - timeA
      })
      .slice(0, 5)
  }, [visibleOrders])

  /* ── 4. Upcoming Appointments ── */
  const upcomingAppointments = useMemo(() => {
    if (!Array.isArray(visibleAppointments)) return []
    const now = new Date()
    const todayStr = now.toDateString()

    return [...visibleAppointments]
      .filter((a) => !['cancelled', 'completed', 'no_show'].includes(a.status))
      .sort((a, b) => {
        const dateA = a.scheduled_at ? new Date(a.scheduled_at) : null
        const dateB = b.scheduled_at ? new Date(b.scheduled_at) : null
        const isTodayA = dateA && dateA.toDateString() === todayStr
        const isTodayB = dateB && dateB.toDateString() === todayStr

        // 1. Today's appointments first
        if (isTodayA && !isTodayB) return -1
        if (!isTodayA && isTodayB) return 1

        // 2. Future appointments chronologically
        if (dateA && dateB) return dateA - dateB
        if (dateA && !dateB) return -1
        if (!dateA && dateB) return 1

        // 3. Pending confirmations next
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1

        return 0
      })
      .slice(0, 5)
  }, [visibleAppointments])

  /* ── 5. Real Chronological Recent Activity ── */
  const recentActivity = useMemo(() => {
    const events = []
    const orders = Array.isArray(visibleOrders) ? visibleOrders : []
    const projects = Array.isArray(visibleProjects) ? visibleProjects : []
    const appointments = Array.isArray(visibleAppointments) ? visibleAppointments : []

    orders.forEach((o) => {
      if (o.created_at) {
        events.push({
          id: `order-created-${o.order_id || o.order_number}`,
          timestamp: new Date(o.created_at),
          description: `Order #${o.order_number || o.order_id?.slice(0, 8)} created`,
          detail: getCustomerName(o),
          tab: 'orders',
        })
      }
    })

    appointments.forEach((a) => {
      if (a.created_at) {
        events.push({
          id: `appt-created-${a.appointment_id}`,
          timestamp: new Date(a.created_at),
          description: `Appointment booked (${a.service_name || a.title || 'Service'})`,
          detail: a.customer_name || a.user_name || 'Customer',
          tab: 'appointments',
        })
      }
    })

    projects.forEach((p) => {
      if (p.hold_requested_at && p.status === 'on_hold') {
        events.push({
          id: `project-hold-${p.project_id}`,
          timestamp: new Date(p.hold_requested_at),
          description: `Project #${p.order_number || p.project_id?.slice(0, 8)} moved to On Hold`,
          detail: p.hold_reason || 'Hold requested',
          tab: 'projects',
        })
      } else if (p.created_at) {
        events.push({
          id: `project-created-${p.project_id}`,
          timestamp: new Date(p.created_at),
          description: `Project #${p.order_number || p.name || 'Build'} initiated`,
          detail: p.customer_name || 'Unassigned',
          tab: 'projects',
        })
      }
    })

    return events
      .filter((e) => !isNaN(e.timestamp.getTime()))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
  }, [visibleOrders, visibleProjects, visibleAppointments])

  /* ── 6. Sales Performance Trend Data ── */
  const salesTrendData = useMemo(() => {
    if (!salesReport?.dailyTrend || !Array.isArray(salesReport.dailyTrend) || salesReport.dailyTrend.length === 0) {
      return []
    }
    return salesReport.dailyTrend.map((d) => ({
      date: d.date ? d.date.slice(5) : '', // 'MM-DD'
      fullDate: d.date || '',
      net: Number(d.net ?? d.revenue ?? d.gross ?? 0),
      transactions: Number(d.transactions ?? 0),
    }))
  }, [salesReport])

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <div className="pb-3 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Overview of current business activity.</p>
      </div>

      {/* ── 2. BUSINESS SNAPSHOT ─────────────────────────────────────────── */}
      <section aria-labelledby="business-snapshot-title">
        <h2 id="business-snapshot-title" className="sr-only">Business Snapshot</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Revenue */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Revenue</p>
            {showSkeleton ? (
              <>
                <SkeletonBlock className="mt-1.5 h-7 w-24" />
                <SkeletonBlock className="mt-2.5 h-3 w-28" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(summary.revenue)}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  {salesReport?.totalTransactions != null
                    ? `${salesReport.totalTransactions} transactions`
                    : `${summary.monthOrdersCount} orders this month`}
                </p>
              </>
            )}
          </div>

          {/* Orders */}
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 text-left transition-colors hover:border-[var(--gold-primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Orders</p>
            {showSkeleton ? (
              <>
                <SkeletonBlock className="mt-1.5 h-7 w-14" />
                <SkeletonBlock className="mt-2.5 h-3 w-32" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-white mt-1">{summary.totalOrders}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  {summary.awaitingPaymentOrders > 0 ? (
                    <span className="text-amber-400 font-medium">
                      {summary.awaitingPaymentOrders} awaiting payment
                    </span>
                  ) : (
                    'All payments up to date'
                  )}
                </p>
              </>
            )}
          </button>

          {/* Projects */}
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 text-left transition-colors hover:border-[var(--gold-primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Projects</p>
            {showSkeleton ? (
              <>
                <SkeletonBlock className="mt-1.5 h-7 w-14" />
                <SkeletonBlock className="mt-2.5 h-3 w-28" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-white mt-1">{summary.activeProjects}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5 truncate">
                  {summary.inProgressProjects} in progress &middot; {summary.onHoldProjects} on hold
                </p>
              </>
            )}
          </button>

          {/* Appointments */}
          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 text-left transition-colors hover:border-[var(--gold-primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Appointments</p>
            {showSkeleton ? (
              <>
                <SkeletonBlock className="mt-1.5 h-7 w-14" />
                <SkeletonBlock className="mt-2.5 h-3 w-28" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-white mt-1">{summary.activeAppointments}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5 truncate">
                  {summary.todayAppointments} today &middot; {summary.pendingAppointments} pending
                </p>
              </>
            )}
          </button>

          {/* Inventory Health */}
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className="col-span-2 lg:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 text-left transition-colors hover:border-[var(--gold-primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Inventory</p>
            {showSkeleton ? (
              <>
                <SkeletonBlock className="mt-1.5 h-7 w-16" />
                <SkeletonBlock className="mt-2.5 h-3 w-24" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-white mt-1">
                  {inventoryHealthData?.value || '100%'}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  Health:{' '}
                  <span
                    className={
                      inventoryHealthData?.status === 'Critical'
                        ? 'text-red-400 font-semibold'
                        : inventoryHealthData?.status === 'Warning'
                        ? 'text-amber-400 font-semibold'
                        : 'text-emerald-400 font-semibold'
                    }
                  >
                    {inventoryHealthData?.status || 'Healthy'}
                  </span>
                </p>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ── Jump-to nav ─────────────────────────────────────────────────── */}
      <nav aria-label="Operations Quick Navigation">
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Orders',       icon: ShoppingBag, tab: 'orders'       },
            { label: 'Appointments', icon: Calendar,    tab: 'appointments' },
            { label: 'Projects',     icon: Wrench,      tab: 'projects'     },
            { label: 'Inventory',    icon: Package,     tab: 'inventory'    },
            { label: 'Sales Report', icon: BarChart2,   tab: 'sales-report' },
          ].map(({ label, icon: Icon, tab }) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-all hover:border-[var(--gold-primary)]/50 hover:bg-white/[0.04] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── 3. NEEDS ATTENTION (PRIMARY SECTION) ─────────────────────────── */}
      <section aria-labelledby="needs-attention-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 id="needs-attention-heading" className="text-base font-semibold text-white">
              Needs Attention
            </h2>
            {attentionItems.length > 0 && (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.2 text-[11px] font-semibold text-amber-300">
                {attentionItems.length}
              </span>
            )}
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            Prioritized by operational urgency
          </span>
        </div>

        {showSkeleton ? (
          <div className="divide-y divide-[var(--border)]/60 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] overflow-hidden">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3 p-3.5">
                <SkeletonBlock className="h-2 w-2 rounded-full shrink-0" />
                <SkeletonBlock className="h-3.5 w-2/5" />
                <SkeletonBlock className="h-3.5 w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : attentionItems.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 mb-1.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-white">No outstanding actions</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Everything currently appears up to date.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/60 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] overflow-hidden">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      item.severity === 'high' ? 'bg-amber-400' : 'bg-slate-400'
                    }`}
                  />
                  <span className="text-sm font-medium text-white truncate">
                    {item.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab(item.tab)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold-primary)] hover:underline ml-4 shrink-0 focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] rounded px-1.5 py-0.5"
                >
                  {item.actionLabel}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. SALES / BUSINESS PERFORMANCE ─────────────────────────────── */}
      <section aria-labelledby="sales-performance-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 id="sales-performance-heading" className="text-base font-semibold text-white">
              Sales Performance
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Consolidated revenue and transaction trends.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {salesTrendData.length > 0 && (
              <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--bg-primary)]">
                <button
                  type="button"
                  onClick={() => setSalesTrendMetric('net')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    salesTrendMetric === 'net'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  Net Sales
                </button>
                <button
                  type="button"
                  onClick={() => setSalesTrendMetric('transactions')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    salesTrendMetric === 'transactions'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  Transactions
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('sales-report')}
              className="text-xs font-semibold text-[var(--gold-primary)] hover:underline flex items-center gap-1"
            >
              View detailed report <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
          {/* Key Facts Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-4 border-b border-[var(--border)]/60 text-xs">
            <div>
              <span className="text-[var(--text-muted)]">Net Sales</span>
              {showSkeleton ? (
                <SkeletonBlock className="mt-1.5 h-5 w-24" />
              ) : (
                <p className="text-base font-bold text-white mt-0.5">
                  {formatCurrency(salesReport?.netSales ?? summary.revenue)}
                </p>
              )}
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Total Transactions</span>
              {showSkeleton ? (
                <SkeletonBlock className="mt-1.5 h-5 w-16" />
              ) : (
                <p className="text-base font-bold text-white mt-0.5">
                  {salesReport?.totalTransactions ?? summary.totalOrders}
                </p>
              )}
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Avg Transaction</span>
              {showSkeleton ? (
                <SkeletonBlock className="mt-1.5 h-5 w-20" />
              ) : (
                <p className="text-base font-bold text-white mt-0.5">
                  {formatCurrency(salesReport?.averagePerTransaction ?? (summary.totalOrders > 0 ? summary.revenue / summary.totalOrders : 0))}
                </p>
              )}
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Channel Diversity</span>
              {showSkeleton ? (
                <SkeletonBlock className="mt-1.5 h-5 w-20" />
              ) : (
                <p className="text-base font-bold text-white mt-0.5">
                  {salesReport?.channels ? Object.values(salesReport.channels).filter((c) => (c?.transactions || 0) > 0).length : '—'} active
                </p>
              )}
            </div>
          </div>

          {/* Chart or Factual Breakdown */}
          {showSkeleton ? (
            <SkeletonBlock className="mt-4 h-48 w-full" />
          ) : salesTrendData.length > 0 ? (
            <div className="h-48 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardTrendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--gold-primary)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--gold-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    stroke="#888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) =>
                      salesTrendMetric === 'net' ? `₱${val >= 1000 ? `${Math.round(val / 1000)}k` : val}` : val
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                    formatter={(val) => [
                      salesTrendMetric === 'net' ? formatCurrency(val) : `${val} transactions`,
                      salesTrendMetric === 'net' ? 'Net Sales' : 'Transactions',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey={salesTrendMetric}
                    stroke="var(--gold-primary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#dashboardTrendGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
              <p>Historical daily trend data will populate as transactions occur across channels.</p>
              {salesReport?.channels && (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2 py-1 rounded bg-white/5 border border-[var(--border)]">
                    Online: {formatCurrency(salesReport.channels.online?.net || 0)}
                  </span>
                  <span className="px-2 py-1 rounded bg-white/5 border border-[var(--border)]">
                    POS: {formatCurrency(salesReport.channels.walkIn?.net || 0)}
                  </span>
                  <span className="px-2 py-1 rounded bg-white/5 border border-[var(--border)]">
                    Custom: {formatCurrency(salesReport.channels.customization?.net || 0)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. RECENT ORDERS & UPCOMING APPOINTMENTS ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Orders Table */}
        <section aria-labelledby="recent-orders-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="recent-orders-heading" className="text-base font-semibold text-white">
              Recent Orders
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className="text-xs font-semibold text-[var(--gold-primary)] hover:underline flex items-center gap-1"
            >
              View all orders <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] overflow-hidden">
            {showSkeleton ? (
              <div className="divide-y divide-[var(--border)]/40">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center gap-3 px-3.5 py-3">
                    <SkeletonBlock className="h-3 w-16 shrink-0" />
                    <SkeletonBlock className="h-3 w-24" />
                    <SkeletonBlock className="h-3 w-14 ml-auto shrink-0" />
                    <SkeletonBlock className="h-4 w-16 shrink-0" />
                  </div>
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                <p className="font-medium text-white">No recent orders</p>
                <p className="mt-1">Orders will appear here once they are created.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border)] bg-[var(--bg-primary)]/50 text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3.5">Order</th>
                      <th className="py-2.5 px-3.5">Customer</th>
                      <th className="py-2.5 px-3.5 text-right">Amount</th>
                      <th className="py-2.5 px-3.5 text-center">Status</th>
                      <th className="py-2.5 px-3.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/40 text-white">
                    {recentOrders.map((order) => {
                      const orderNum = `#${order.order_number || order.order_id?.slice(0, 8)}`
                      const customer = getCustomerName(order)
                      const amount = formatCurrency(getOrderTotal(order))
                      const status = order.status || 'pending'
                      const date = formatRecordTimeOrDate(order.created_at)

                      return (
                        <tr
                          key={order.order_id}
                          className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => setActiveTab('orders')}
                        >
                          <td className="py-3 px-3.5 font-mono font-medium text-[var(--gold-primary)]">
                            {orderNum}
                          </td>
                          <td className="py-3 px-3.5 font-medium truncate max-w-[140px]">
                            {customer}
                          </td>
                          <td className="py-3 px-3.5 text-right font-medium tabular-nums">
                            {amount}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <StatusBadge status={status} />
                          </td>
                          <td className="py-3 px-3.5 text-right text-[var(--text-muted)] whitespace-nowrap">
                            {date}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Upcoming Appointments List */}
        <section aria-labelledby="upcoming-appointments-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="upcoming-appointments-heading" className="text-base font-semibold text-white">
              Upcoming Appointments
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('appointments')}
              className="text-xs font-semibold text-[var(--gold-primary)] hover:underline flex items-center gap-1"
            >
              View all appointments <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] divide-y divide-[var(--border)]/50 overflow-hidden">
            {showSkeleton ? (
              <div>
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center gap-3 p-3.5">
                    <SkeletonBlock className="h-3 w-14 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <SkeletonBlock className="h-3 w-2/5" />
                      <SkeletonBlock className="h-2.5 w-1/4" />
                    </div>
                    <SkeletonBlock className="h-4 w-16 shrink-0" />
                  </div>
                ))}
              </div>
            ) : upcomingAppointments.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                <p className="font-medium text-white">No upcoming appointments</p>
                <p className="mt-1">Appointments will appear here once booked.</p>
              </div>
            ) : (
              upcomingAppointments.map((apt) => {
                const title = apt.service_name || apt.title || 'Appointment'
                const customer = apt.customer_name || apt.user_name || 'Customer'
                const status = apt.status || 'pending'
                const time = apt.scheduled_at
                  ? formatRecordTimeOrDate(apt.scheduled_at)
                  : apt.time || 'TBA'

                return (
                  <div
                    key={apt.appointment_id}
                    onClick={() => setActiveTab('appointments')}
                    className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 text-xs font-mono font-medium text-[var(--text-muted)] shrink-0">
                        {time}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{title}</p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">{customer}</p>
                      </div>
                    </div>
                    <div className="shrink-0 ml-3">
                      <StatusBadge status={status} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>

      {/* ── 6. RECENT ACTIVITY (REAL AUDIT EVENTS) ────────────────────────── */}
      {(showSkeleton || recentActivity.length > 0) && (
        <section aria-labelledby="recent-activity-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="recent-activity-heading" className="text-base font-semibold text-white">
              Recent Activity
            </h2>
            <span className="text-xs text-[var(--text-muted)]">Recent business events</span>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] divide-y divide-[var(--border)]/40 overflow-hidden">
            {showSkeleton
              ? [0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-3 p-3">
                    <SkeletonBlock className="h-3 w-16 shrink-0" />
                    <SkeletonBlock className="h-3 w-1/2" />
                  </div>
                ))
              : recentActivity.map((event) => (
                <div
                  key={event.id}
                  onClick={() => event.tab && setActiveTab(event.tab)}
                  className="flex items-center justify-between p-3 text-xs hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[var(--text-muted)] w-16 shrink-0">
                      {formatRecordTimeOrDate(event.timestamp)}
                    </span>
                    <span className="text-white font-medium truncate">
                      {event.description}
                    </span>
                    {event.detail && (
                      <span className="hidden sm:inline text-[var(--text-muted)] truncate">
                        &middot; {event.detail}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-60 ml-2 shrink-0" />
                </div>
              ))}
          </div>
        </section>
      )}

    </motion.div>
  )
}
