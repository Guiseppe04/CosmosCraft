import { useEffect, useMemo, useState } from 'react'
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
import { adminApi } from '../../../utils/adminApi'
import { getOrderCustomerName } from '../../../utils/invoiceBuilder.js'

/* ─── Helper Functions ─── */

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

function getCustomerName(order) {
  return getOrderCustomerName(order, order?.email || 'Customer')
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
  const dayOptions = { timeZone: 'Asia/Manila' }
  const isToday = d.toLocaleDateString('en-PH', dayOptions) === new Date().toLocaleDateString('en-PH', dayOptions)
  if (isToday) {
    return d.toLocaleTimeString('en-PH', { ...dayOptions, hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-PH', { ...dayOptions, month: 'short', day: 'numeric' })
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
  salesReport: initialSalesReport,
  visibleOrders = [],
  visibleProjects = [],
  visibleAppointments = [],
  inventoryHealthData,
  enhancedOrderStats,
  isLoading,
  setActiveTab,
}) {
  const [salesTrendMetric, setSalesTrendMetric] = useState('net')
  const [reportDays, setReportDays] = useState(30)
  const [periodReport, setPeriodReport] = useState(null)
  const [periodLoading, setPeriodLoading] = useState(false)
  const [periodError, setPeriodError] = useState('')
  const salesReport = periodReport ?? initialSalesReport

  useEffect(() => {
    if (initialSalesReport == null) return
    let active = true
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const value = type => parts.find(part => part.type === type).value
    const endDate = `${value('year')}-${value('month')}-${value('day')}`
    const startDate = new Date(`${endDate}T00:00:00Z`)
    startDate.setUTCDate(startDate.getUTCDate() - reportDays + 1)
    setPeriodLoading(true)
    setPeriodError('')
    adminApi.getSalesReport({ start_date: startDate.toISOString().slice(0, 10), end_date: endDate }).then(response => {
      if (active) setPeriodReport(response.data || null)
    }).catch(error => {
      if (active) { setPeriodReport(null); setPeriodError(`Unable to load the selected period. Showing available report data. ${error.message || ''}`) }
    }).finally(() => { if (active) setPeriodLoading(false) })
    return () => { active = false }
  }, [initialSalesReport, reportDays])

  // `salesReport` stays null until the first dashboard fetch resolves, so it is
  // a reliable "nothing rendered yet" signal alongside the shared isLoading flag.
  const showSkeleton = Boolean(isLoading) || periodLoading || salesReport == null

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

  const now = new Date()
  const manilaHour = Number(new Intl.DateTimeFormat('en-PH', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Manila' }).format(now))
  const greeting = manilaHour < 12 ? 'Good morning' : manilaHour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.first_name || user?.firstName || user?.name?.firstName || (typeof user?.name === 'string' ? user.name.split(' ')[0] : '') || 'Admin'
  const averageOrderValue = salesReport?.averagePerTransaction ?? (summary.totalOrders ? summary.revenue / summary.totalOrders : 0)
  const overdueCount = visibleProjects.filter(project => !['completed', 'cancelled'].includes(project.status) && project.estimated_completion_date && new Date(project.estimated_completion_date) < now).length
  const card = 'min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-sm'
  const metrics = [
    { label: 'Net revenue', value: formatCurrency(summary.revenue), detail: 'Net sales after discounts and refunds', icon: DollarSign, color: 'bg-emerald-500/10 text-emerald-500', tab: 'sales-report' },
    { label: 'Total orders', value: summary.totalOrders, detail: `${summary.awaitingPaymentOrders} require payment action`, icon: ShoppingBag, color: 'bg-violet-500/10 text-violet-500', tab: 'orders' },
    { label: 'Avg. order value', value: formatCurrency(averageOrderValue), detail: 'Average per reported transaction', icon: TrendingUp, color: 'bg-blue-500/10 text-blue-500', tab: 'sales-report' },
    { label: 'Active projects', value: summary.activeProjects, detail: `${overdueCount} overdue · ${summary.onHoldProjects} on hold`, icon: Briefcase, color: 'bg-orange-500/10 text-orange-500', tab: 'projects' },
  ]

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <header className="py-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-light)]">{greeting}, {firstName}</h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Here's what needs your attention today.</p>
      </header>

      <section aria-label="Business snapshot" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, color, tab }) => (
          <button type="button" key={label} onClick={() => setActiveTab(tab)} className={`${card} p-5 text-left transition-colors hover:border-[var(--gold-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)]`}>
            <span className={`inline-flex rounded-xl p-2 ${color}`}><Icon className="h-4 w-4" /></span>
            <p className="mt-3 text-xs text-[var(--text-muted)]">{label}</p>
            {showSkeleton ? <SkeletonBlock className="mt-2 h-7 w-28" /> : <p className="mt-1 break-words text-xl font-bold tabular-nums text-[var(--text-light)]">{value}</p>}
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">{detail}</p>
          </button>
        ))}
      </section>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,2.6fr)_minmax(280px,1fr)]">
        <section aria-labelledby="sales-performance-heading" className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5">
            <div><h2 id="sales-performance-heading" className="text-sm font-semibold text-[var(--text-light)]">Revenue performance</h2><p className="mt-1 text-[11px] text-[var(--text-muted)]">Net sales after discounts and refunds</p></div>
            <div className="inline-flex rounded-lg bg-[var(--bg-primary)] p-1">
              {[7,30,90].map(days => <button type="button" key={days} aria-pressed={reportDays === days} onClick={() => setReportDays(days)} className={`rounded-md px-3 py-1.5 text-xs ${reportDays === days ? 'bg-[var(--surface-dark)] font-semibold text-[var(--text-light)] shadow-sm' : 'text-[var(--text-muted)]'}`}>{days} days</button>)}
            </div>
          </div>
          <div className="p-5">
            {periodError && <p role="alert" className="mb-3 text-xs text-red-400">{periodError}</p>}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-[11px] text-[var(--text-muted)]">Net revenue</p>{showSkeleton ? <SkeletonBlock className="mt-2 h-6 w-28" /> : <p className="mt-1 text-xl font-bold text-[var(--text-light)]">{formatCurrency(summary.revenue)}</p>}</div>
              <div className="flex gap-6 text-[11px]"><div><p className="text-[var(--text-muted)]">Transactions</p><p className="mt-1 font-semibold text-[var(--text-light)]">{salesReport?.totalTransactions ?? summary.totalOrders}</p></div><div><p className="text-[var(--text-muted)]">Avg. order</p><p className="mt-1 font-semibold text-[var(--text-light)]">{formatCurrency(averageOrderValue)}</p></div></div>
            </div>
            {showSkeleton ? <SkeletonBlock className="mt-5 h-56 w-full" /> : salesTrendData.length ? (
              <div className="mt-5 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="dashboardTrendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis width={42} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={value => salesTrendMetric === 'net' ? `₱${value >= 1000 ? `${Math.round(value / 1000)}k` : value}` : value} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--surface-dark)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--text-muted)' }} formatter={value => [salesTrendMetric === 'net' ? formatCurrency(value) : `${value} transactions`, salesTrendMetric === 'net' ? 'Net sales' : 'Transactions']} />
                    <Area type="monotone" dataKey={salesTrendMetric} stroke="#6366f1" strokeWidth={2.5} fill="url(#dashboardTrendGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex min-h-64 items-center justify-center text-center text-xs text-[var(--text-muted)]">Historical daily trends will appear as transactions are recorded.</div>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setActiveTab('sales-report')} className="inline-flex items-center gap-1 text-xs text-[var(--gold-primary)]">View detailed report <ArrowRight className="h-3 w-3" /></button>
              <div className="inline-flex gap-2">{[['net','Net sales'],['transactions','Transactions']].map(([value,label]) => <button type="button" key={value} aria-pressed={salesTrendMetric === value} onClick={() => setSalesTrendMetric(value)} className={`rounded-md px-2 py-1 text-[10px] ${salesTrendMetric === value ? 'bg-[var(--bg-primary)] text-[var(--text-light)]' : 'text-[var(--text-muted)]'}`}>{label}</button>)}</div>
            </div>
          </div>
        </section>

        <section aria-labelledby="needs-attention-heading" className={`${card} flex flex-col p-5`}>
          <div className="flex items-start justify-between gap-2"><div><h2 id="needs-attention-heading" className="text-sm font-semibold text-[var(--text-light)]">Needs attention</h2><p className="mt-1 text-[11px] text-[var(--text-muted)]">Prioritized by urgency</p></div>{!showSkeleton && <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-500">{attentionItems.length} items</span>}</div>
          <div className="mt-4 flex-1 space-y-2">
            {showSkeleton ? [0,1,2].map(index => <SkeletonBlock key={index} className="h-14 w-full" />) : attentionItems.length ? attentionItems.map(item => (
              <button type="button" key={item.id} onClick={() => setActiveTab(item.tab)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--gold-primary)]">
                <span className={`rounded-lg p-2 ${item.severity === 'high' ? 'bg-orange-500/10 text-orange-500' : 'bg-violet-500/10 text-violet-500'}`}>{item.tab === 'appointments' ? <Calendar className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[var(--text-light)]">{item.label}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{item.actionLabel}</span></span><ArrowRight className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
              </button>
            )) : <div className="flex items-center gap-2 p-3 text-xs text-[var(--text-muted)]"><CheckCircle2 className="h-4 w-4 text-emerald-500" />No urgent actions needed.</div>}
          </div>
          <button type="button" onClick={() => setActiveTab('inventory')} className="mt-4 rounded-xl bg-[var(--bg-primary)] p-3 text-left">
            <div className="flex justify-between gap-2 text-[10px]"><span className="text-[var(--text-muted)]">Inventory health</span><span className="font-semibold text-[var(--text-light)]">{inventoryHealthData?.status || 'Not available'} {inventoryHealthData?.value || ''}</span></div>
          </button>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
        <section aria-labelledby="recent-orders-heading" className={card}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-5"><div><h2 id="recent-orders-heading" className="text-sm font-semibold text-[var(--text-light)]">Recent orders</h2><p className="mt-1 text-[11px] text-[var(--text-muted)]">Latest order activity</p></div><button type="button" onClick={() => setActiveTab('orders')} className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--gold-primary)]">View all <ArrowRight className="h-3 w-3" /></button></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]"><tr>{['Order','Customer','Amount','Status','Date'].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {showSkeleton ? [0,1,2,3].map(index => <tr key={index}><td colSpan={5} className="p-4"><SkeletonBlock className="h-4 w-full" /></td></tr>) : recentOrders.length ? recentOrders.map(order => {
                  const customer = getCustomerName(order)
                  const initials = customer.split(' ').slice(0,2).map(part => part[0]).join('')
                  return <tr key={order.order_id} className="text-[var(--text-light)] hover:bg-[var(--bg-primary)]/50"><td className="whitespace-nowrap px-4 py-4"><button type="button" onClick={() => setActiveTab('orders')} className="text-[var(--gold-primary)]">{order.order_number || order.order_id?.slice(0,8)}</button></td><td className="px-4 py-4"><div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-primary)] text-[10px]">{initials}</span><span className="max-w-[140px] truncate">{customer}</span></div></td><td className="whitespace-nowrap px-4 py-4 font-semibold">{formatCurrency(getOrderTotal(order))}</td><td className="px-4 py-4"><StatusBadge status={order.status} /></td><td className="whitespace-nowrap px-4 py-4 text-[var(--text-muted)]">{formatRecordTimeOrDate(order.created_at)}</td></tr>
                }) : <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No recent orders.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="upcoming-appointments-heading" className={`${card} p-5`}>
          <div className="flex items-center justify-between"><div><h2 id="upcoming-appointments-heading" className="text-sm font-semibold text-[var(--text-light)]">Upcoming appointments</h2><p className="mt-1 text-[11px] text-[var(--text-muted)]">Next confirmed and pending visits</p></div><Calendar className="h-4 w-4 text-[var(--text-muted)]" /></div>
          <div className="mt-4 space-y-3">
            {showSkeleton ? [0,1,2].map(index => <SkeletonBlock key={index} className="h-12 w-full" />) : upcomingAppointments.length ? upcomingAppointments.map(apt => {
              const date = apt.scheduled_at ? new Date(apt.scheduled_at) : null
              const validDate = date && !isNaN(date.getTime())
              return <button type="button" key={apt.appointment_id} onClick={() => setActiveTab('appointments')} className="flex w-full items-center gap-3 rounded-lg py-2 text-left hover:bg-[var(--bg-primary)]">
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500"><span className="text-[9px] uppercase">{validDate ? date.toLocaleDateString('en-PH',{month:'short', timeZone:'Asia/Manila'}) : 'TBA'}</span><span className="text-sm font-semibold">{validDate ? date.toLocaleDateString('en-PH',{day:'numeric', timeZone:'Asia/Manila'}) : '-'}</span></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--text-light)]">{apt.service_name || apt.title || 'Appointment'}</span><span className="mt-1 block truncate text-[10px] text-[var(--text-muted)]">{apt.customer_name || apt.user_name || 'Customer'} · {String(apt.status || 'pending').replace(/_/g,' ')}</span></span>
                <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{validDate ? date.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Manila'}) : apt.time || 'TBA'}</span>
              </button>
            }) : <p className="py-6 text-center text-xs text-[var(--text-muted)]">No upcoming appointments.</p>}
          </div>
          <button type="button" onClick={() => setActiveTab('appointments')} className="mt-4 w-full rounded-xl border border-dashed border-[var(--border)] p-3 text-xs text-[var(--gold-primary)] hover:border-[var(--gold-primary)]">View appointment calendar</button>
        </section>
      </div>

      <section aria-labelledby="recent-activity-heading" className={card}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-5"><div><h2 id="recent-activity-heading" className="text-sm font-semibold text-[var(--text-light)]">Recent activity</h2><p className="mt-1 text-[11px] text-[var(--text-muted)]">A chronological view of business events</p></div><span className="text-[10px] text-[var(--text-muted)]">Latest business activity</span></div>
        <div className="divide-y divide-[var(--border)]">
          {showSkeleton ? [0,1,2].map(index => <div key={index} className="p-4"><SkeletonBlock className="h-4 w-full" /></div>) : recentActivity.length ? recentActivity.map(event => <button type="button" key={event.id} onClick={() => setActiveTab(event.tab)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-[var(--bg-primary)]/50"><span className="w-16 shrink-0 text-[10px] text-[var(--text-muted)]">{formatRecordTimeOrDate(event.timestamp)}</span><span className="rounded-lg bg-[var(--bg-primary)] p-2"><Activity className="h-3 w-3 text-[var(--text-muted)]" /></span><span className="min-w-0 flex-1 text-xs text-[var(--text-light)]">{event.description}{event.detail && <span className="text-[var(--text-muted)]"> &middot; {event.detail}</span>}</span><ArrowRight className="h-3 w-3 shrink-0 text-[var(--text-muted)]" /></button>) : <p className="p-8 text-center text-xs text-[var(--text-muted)]">No recent activity.</p>}
        </div>
      </section>
    </motion.div>
  )
}
