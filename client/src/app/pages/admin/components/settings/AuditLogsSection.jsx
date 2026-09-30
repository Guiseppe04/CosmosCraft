import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  History, Search, RefreshCw, Filter, Download, Trash2,
  Calendar, User, Clock, ArrowRight, CheckCircle2,
  AlertCircle, ChevronRight, Eye, Copy, Check, FileJson,
  Layers, Package, ShoppingBag, Briefcase, CreditCard,
  Truck, Wallet, Wrench, Shield, ArrowUpRight, X, Sparkles
} from 'lucide-react'
import { adminApi } from '../../../../utils/adminApi'
import { SectionLoader } from '../shared/SectionLoader'
import { PaginationBar } from '../shared/PaginationBar'
import { ConfirmModal } from '../../../../components/ui/ConfirmModal'

const MODULE_OPTIONS = [
  { value: 'all', label: 'All Modules' },
  { value: 'project', label: 'Projects', icon: Briefcase },
  { value: 'order', label: 'Orders', icon: ShoppingBag },
  { value: 'payment', label: 'Payments', icon: CreditCard },
  { value: 'fulfillment', label: 'Fulfillment', icon: Truck },
  { value: 'pos', label: 'POS', icon: Wallet },
  { value: 'products', label: 'Products', icon: Package },
  { value: 'guitar_builder_parts', label: 'Guitar Parts', icon: Layers },
  { value: 'services', label: 'Services', icon: Wrench },
  { value: 'users', label: 'Users', icon: Shield },
]

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'INSERT', label: 'Created (INSERT)' },
  { value: 'UPDATE', label: 'Updated (UPDATE)' },
  { value: 'DELETE', label: 'Deleted (DELETE)' },
  { value: 'milestone_updated', label: 'Milestone Updated' },
  { value: 'subtask_status_changed', label: 'Subtask Status Changed' },
  { value: 'project_claimed', label: 'Project Claimed' },
  { value: 'project_cancelled', label: 'Project Cancelled' },
  { value: 'project_resumed', label: 'Project Resumed' },
  { value: 'hold_requested', label: 'Hold Requested' },
  { value: 'cancel_requested', label: 'Cancel Requested' },
  { value: 'cancel_approved', label: 'Cancel Approved' },
  { value: 'refund_requested', label: 'Refund Requested' },
  { value: 'refund_approved', label: 'Refund Approved' },
  { value: 'refund_processing', label: 'Refund Processing' },
  { value: 'refund_refunded', label: 'Refund Completed' },
  { value: 'build_claim_status_updated', label: 'Build Claim Status' },
  { value: 'build_claim_courier_arranged', label: 'Courier Arranged' },
  { value: 'fulfillment_updated', label: 'Fulfillment Updated' },
]

export function AuditLogsSection({ isSuperAdmin, showToast }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [summary, setSummary] = useState(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModule, setSelectedModule] = useState('all')
  const [selectedAction, setSelectedAction] = useState('all')
  const [dateRangePreset, setDateRangePreset] = useState('all') // 'all', 'today', '7days', '30days', 'custom'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Modals & detail view
  const [selectedLog, setSelectedLog] = useState(null)
  const [showCleanupModal, setShowCleanupModal] = useState(false)
  const [cleanupDays, setCleanupDays] = useState(90)
  const [isCleaning, setIsCleaning] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  // Calculate actual dates based on preset
  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    if (dateRangePreset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      return { startDate: start, endDate: now.toISOString() }
    }
    if (dateRangePreset === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      return { startDate: start, endDate: now.toISOString() }
    }
    if (dateRangePreset === '30days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      return { startDate: start, endDate: now.toISOString() }
    }
    if (dateRangePreset === 'custom') {
      return {
        startDate: customStartDate ? new Date(customStartDate).toISOString() : undefined,
        endDate: customEndDate ? new Date(customEndDate + 'T23:59:59').toISOString() : undefined,
      }
    }
    return { startDate: undefined, endDate: undefined }
  }, [dateRangePreset, customStartDate, customEndDate])

  const fetchLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    else setRefreshing(true)

    try {
      const params = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }

      if (selectedModule !== 'all') params.entity_type = selectedModule
      if (selectedAction !== 'all') params.action = selectedAction
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const res = await adminApi.getAuditLogs(params)
      if (res?.data) {
        setLogs(res.data)
        setTotal(res.pagination?.total ?? res.data.length)
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err)
      showToast?.(err.message || 'Failed to load audit logs', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, pageSize, selectedModule, selectedAction, startDate, endDate, showToast])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await adminApi.getAuditSummary()
      if (res?.data) {
        setSummary(res.data)
      }
    } catch (err) {
      console.warn('Could not fetch audit summary:', err)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Filter logs locally by search query for instant responsiveness
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs
    const q = searchQuery.toLowerCase()
    return logs.filter((log) => {
      const action = (log.action || '').toLowerCase()
      const entityType = (log.entity_type || '').toLowerCase()
      const entityId = String(log.entity_id || '').toLowerCase()
      const userName = (log.user_name || '').toLowerCase()
      const userEmail = (log.user_email || '').toLowerCase()
      const detailsStr = typeof log.details === 'object' ? JSON.stringify(log.details).toLowerCase() : String(log.details || '').toLowerCase()
      return (
        action.includes(q) ||
        entityType.includes(q) ||
        entityId.includes(q) ||
        userName.includes(q) ||
        userEmail.includes(q) ||
        detailsStr.includes(q)
      )
    })
  }, [logs, searchQuery])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedModule('all')
    setSelectedAction('all')
    setDateRangePreset('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setPage(1)
  }

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    showToast?.('Copied to clipboard', 'info')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleExport = (format = 'json') => {
    try {
      if (!logs.length) {
        showToast?.('No logs to export', 'warning')
        return
      }

      let content = ''
      let mimeType = ''
      let extension = ''

      if (format === 'json') {
        content = JSON.stringify(filteredLogs, null, 2)
        mimeType = 'application/json'
        extension = 'json'
      } else {
        // CSV format
        const headers = ['Audit ID', 'Timestamp', 'User Name', 'User Email', 'Entity Type', 'Entity ID', 'Action', 'Previous Status', 'New Status', 'Details']
        const rows = filteredLogs.map(l => [
          l.audit_id,
          new Date(l.created_at).toISOString(),
          `"${(l.user_name || '').replace(/"/g, '""')}"`,
          `"${(l.user_email || '').replace(/"/g, '""')}"`,
          l.entity_type,
          l.entity_id || '',
          l.action,
          l.previous_status || '',
          l.new_status || '',
          `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
        ])
        content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        mimeType = 'text/csv'
        extension = 'csv'
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast?.(`Exported ${filteredLogs.length} audit logs as ${extension.toUpperCase()}`, 'success')
    } catch (err) {
      console.error('Export error:', err)
      showToast?.('Failed to export audit logs', 'error')
    }
  }

  const handleCleanup = async () => {
    setIsCleaning(true)
    try {
      const res = await adminApi.cleanupOldAuditLogs(cleanupDays)
      showToast?.(`Cleaned up ${res.deleted || 0} logs older than ${cleanupDays} days`, 'success')
      setShowCleanupModal(false)
      fetchLogs()
      fetchSummary()
    } catch (err) {
      showToast?.(err.message || 'Failed to cleanup old logs', 'error')
    } finally {
      setIsCleaning(false)
    }
  }

  const formatTimestamp = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      relative: getRelativeTimeString(date),
    }
  }

  const getRelativeTimeString = (date) => {
    const deltaSeconds = Math.round((new Date() - date) / 1000)
    if (deltaSeconds < 60) return 'Just now'
    if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`
    if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)}h ago`
    return `${Math.floor(deltaSeconds / 86400)}d ago`
  }

  const getActionBadge = (action = '') => {
    const act = action.toUpperCase()
    if (act.includes('DELETE') || act.includes('CANCEL') || act.includes('REJECT') || act.includes('VOID')) {
      return {
        bg: 'bg-red-500/10 text-red-400 border-red-500/20',
        dot: 'bg-red-400',
      }
    }
    if (act.includes('INSERT') || act.includes('CREATE') || act.includes('APPROVE') || act.includes('VERIFY') || act.includes('CONFIRM')) {
      return {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-400',
      }
    }
    if (act.includes('REFUND') || act.includes('PAYMENT')) {
      return {
        bg: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
        dot: 'bg-purple-400',
      }
    }
    if (act.includes('HOLD') || act.includes('RETURN')) {
      return {
        bg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        dot: 'bg-amber-400',
      }
    }
    if (act.includes('CLAIM') || act.includes('COURIER') || act.includes('FULFILLMENT')) {
      return {
        bg: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
        dot: 'bg-sky-400',
      }
    }
    // Default update/action
    return {
      bg: 'bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border-[var(--gold-primary)]/20',
      dot: 'bg-[var(--gold-primary)]',
    }
  }

  const getEntityIcon = (entityType) => {
    switch (entityType?.toLowerCase()) {
      case 'project': return Briefcase
      case 'order': return ShoppingBag
      case 'payment': return CreditCard
      case 'fulfillment': return Truck
      case 'pos': return Wallet
      case 'products': return Package
      case 'guitar_builder_parts': return Layers
      case 'services': return Wrench
      case 'users': return Shield
      default: return History
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header Banner & Stats ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[var(--surface-dark)] via-[var(--surface-dark)] to-[var(--surface-elevated)] border border-[var(--border)] rounded-3xl p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--gold-primary)]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/20 text-xs font-semibold text-[var(--gold-primary)] mb-3">
              <History className="w-3.5 h-3.5" />
              <span>Immutable Audit Trail</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">System Audit & Activity Logs</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-xl">
              Real-time audit log of all system state changes, user interactions, inventory updates, and order workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => fetchLogs(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)] text-sm font-semibold hover:border-[var(--gold-primary)]/50 hover:bg-white/5 transition-all disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[var(--gold-primary)]' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Export Dropdown / Buttons */}
            <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-0.5">
              <button
                onClick={() => handleExport('json')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition"
                title="Export as JSON"
              >
                <FileJson className="w-3.5 h-3.5 text-amber-400" />
                <span>JSON</span>
              </button>
              <div className="w-px bg-[var(--border)] my-1" />
              <button
                onClick={() => handleExport('csv')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition"
                title="Export as CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
            </div>

            {isSuperAdmin && (
              <button
                onClick={() => setShowCleanupModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-colors"
                title="Log Retention & Cleanup"
              >
                <Trash2 className="w-4 h-4" />
                <span>Cleanup</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stat Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[var(--border)]/60">
          <div className="bg-[var(--bg-primary)]/40 border border-[var(--border)]/50 rounded-2xl p-4">
            <span className="text-xs text-[var(--text-muted)] font-medium">Total Audit Events</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-white">{total.toLocaleString()}</span>
              <span className="text-xs text-[var(--gold-primary)] font-medium">Records</span>
            </div>
          </div>

          <div className="bg-[var(--bg-primary)]/40 border border-[var(--border)]/50 rounded-2xl p-4">
            <span className="text-xs text-[var(--text-muted)] font-medium">Filtered Results</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-white">{filteredLogs.length}</span>
              <span className="text-xs text-[var(--text-muted)]">on current page</span>
            </div>
          </div>

          <div className="bg-[var(--bg-primary)]/40 border border-[var(--border)]/50 rounded-2xl p-4">
            <span className="text-xs text-[var(--text-muted)] font-medium">Most Active Module</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold capitalize text-white truncate">
                {summary?.by_module_action?.[0]?.module || 'Project'}
              </span>
              <span className="text-xs text-sky-400 font-medium">
                {summary?.by_module_action?.[0]?.count ? `${summary.by_module_action[0].count} logs` : ''}
              </span>
            </div>
          </div>

          <div className="bg-[var(--bg-primary)]/40 border border-[var(--border)]/50 rounded-2xl p-4">
            <span className="text-xs text-[var(--text-muted)] font-medium">Top Activity Lead</span>
            <div className="flex items-baseline gap-2 mt-1 truncate">
              <span className="text-sm font-semibold text-white truncate">
                {summary?.top_users?.[0]?.name?.trim() || summary?.top_users?.[0]?.email || 'Staff & Admins'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters Bar ───────────────────────────────────────────────────── */}
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, action, ID or details..."
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module Selector */}
          <div>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value)
                setPage(1)
              }}
              className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 cursor-pointer"
            >
              {MODULE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[var(--surface-dark)] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Selector */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value)
                setPage(1)
              }}
              className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 cursor-pointer"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[var(--surface-dark)] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Preset Selector */}
          <div>
            <select
              value={dateRangePreset}
              onChange={(e) => {
                setDateRangePreset(e.target.value)
                setPage(1)
              }}
              className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/50 cursor-pointer"
            >
              <option value="all" className="bg-[var(--surface-dark)] text-white">All Time</option>
              <option value="today" className="bg-[var(--surface-dark)] text-white">Today</option>
              <option value="7days" className="bg-[var(--surface-dark)] text-white">Last 7 Days</option>
              <option value="30days" className="bg-[var(--surface-dark)] text-white">Last 30 Days</option>
              <option value="custom" className="bg-[var(--surface-dark)] text-white">Custom Range...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers row (only if 'custom' is selected) */}
        {dateRangePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[var(--border)]/60">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] font-medium">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value)
                  setPage(1)
                }}
                className="px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] font-medium">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value)
                  setPage(1)
                }}
                className="px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
              />
            </div>
          </div>
        )}

        {/* Bottom bar of filter panel: active filter summary + reset + page size */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span>Showing page {page} of {totalPages} ({total} total entries)</span>
            {(selectedModule !== 'all' || selectedAction !== 'all' || dateRangePreset !== 'all' || searchQuery) && (
              <button
                onClick={handleResetFilters}
                className="text-[var(--gold-primary)] hover:underline font-semibold ml-2"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span>Per page:</span>
            {[25, 50, 100].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setPageSize(size)
                  setPage(1)
                }}
                className={`px-2 py-1 rounded-md transition ${pageSize === size ? 'bg-[var(--gold-primary)] text-black font-bold' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-white'}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Audit Logs Table ─────────────────────────────────────────────── */}
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <SectionLoader label="Loading audit logs..." className="py-20" />
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-[var(--border)] flex items-center justify-center mx-auto mb-4 text-[var(--text-muted)]">
              <History className="w-8 h-8 opacity-40" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No Audit Logs Found</h3>
            <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto mb-5">
              {searchQuery || selectedModule !== 'all' || selectedAction !== 'all' || dateRangePreset !== 'all'
                ? 'No activity matches your current filter parameters.'
                : 'No audit records have been generated yet.'}
            </p>
            {(searchQuery || selectedModule !== 'all' || selectedAction !== 'all' || dateRangePreset !== 'all') && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black text-sm font-semibold hover:opacity-90 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-primary)]/60 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Module / Entity</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Status Transition</th>
                  <th className="py-3.5 px-4">Details Preview</th>
                  <th className="py-3.5 px-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40 font-normal">
                {filteredLogs.map((log) => {
                  const ts = formatTimestamp(log.created_at)
                  const actionBadge = getActionBadge(log.action)
                  const EntityIcon = getEntityIcon(log.entity_type)
                  const actorName = log.user_name?.trim() || log.user_email || 'System'
                  const actorInitials = actorName
                    .split(' ')
                    .filter(Boolean)
                    .map(p => p[0]?.toUpperCase())
                    .slice(0, 2)
                    .join('') || 'SY'

                  return (
                    <tr
                      key={log.audit_id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-white font-medium">{ts.date}</span>
                          <span className="font-mono text-[11px] text-[var(--text-muted)]">{ts.time}</span>
                          <span className="text-[10px] text-[var(--gold-primary)]/80 mt-0.5">{ts.relative}</span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[var(--gold-primary)]/15 border border-[var(--gold-primary)]/30 flex items-center justify-center text-[10px] font-bold text-[var(--gold-primary)] shrink-0">
                            {actorInitials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-xs font-semibold truncate max-w-[140px]">{actorName}</p>
                            {log.user_email && (
                              <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[140px]">{log.user_email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Module / Entity */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white/5 border border-[var(--border)] text-[var(--text-muted)]">
                            <EntityIcon className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                          </div>
                          <div>
                            <span className="text-xs font-medium text-white capitalize block">
                              {log.entity_type?.replace(/_/g, ' ') || 'Unknown'}
                            </span>
                            {log.entity_id && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopy(log.entity_id, `entity-${log.audit_id}`)
                                }}
                                className="font-mono text-[10px] text-[var(--text-muted)] hover:text-white inline-flex items-center gap-1 cursor-copy"
                                title="Click to copy entity ID"
                              >
                                {String(log.entity_id).slice(0, 10)}...
                                {copiedId === `entity-${log.audit_id}` ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 opacity-50" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${actionBadge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${actionBadge.dot}`} />
                          {log.action}
                        </span>
                      </td>

                      {/* Status Transition */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {log.previous_status || log.new_status ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="px-2 py-0.5 rounded bg-white/5 text-[var(--text-muted)] font-mono text-[11px]">
                              {log.previous_status || 'none'}
                            </span>
                            <ArrowRight className="w-3 h-3 text-[var(--gold-primary)]" />
                            <span className="px-2 py-0.5 rounded bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] font-mono text-[11px] font-semibold">
                              {log.new_status || 'none'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]/50 text-xs">—</span>
                        )}
                      </td>

                      {/* Details preview */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="truncate text-xs font-mono text-[var(--text-muted)] group-hover:text-[var(--text-light)] transition-colors">
                          {typeof log.details === 'object' && log.details !== null
                            ? Object.entries(log.details)
                                .slice(0, 2)
                                .map(([k, v]) => `${k}: ${typeof v === 'object' ? '...' : String(v)}`)
                                .join(' · ') || '{}'
                            : String(log.details || '—')}
                        </div>
                      </td>

                      {/* View Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(log)
                          }}
                          className="p-1.5 rounded-lg border border-transparent hover:border-[var(--border)] hover:bg-white/5 text-[var(--text-muted)] hover:text-white transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-primary)]/40">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              loading={loading}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}
      </div>

      {/* ── Log Details Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            key="audit-detail-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedLog(null)
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--bg-primary)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--gold-primary)]/15 border border-[var(--gold-primary)]/30 flex items-center justify-center text-[var(--gold-primary)]">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>Audit Record</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-white/10 text-[var(--gold-primary)]">
                        #{selectedLog.audit_id}
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] font-mono">
                      {new Date(selectedLog.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), 'modal-full-json')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-xs text-[var(--text-muted)] hover:text-white transition"
                    title="Copy full JSON"
                  >
                    {copiedId === 'modal-full-json' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copy JSON</span>
                  </button>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-2 text-[var(--text-muted)] hover:text-white rounded-xl hover:bg-white/10 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Highlights Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Actor details */}
                  <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl p-4 space-y-2">
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold block">
                      Actor Information
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] font-bold flex items-center justify-center text-xs">
                        {(selectedLog.user_name || selectedLog.user_email || 'SY')
                          .split(' ')
                          .filter(Boolean)
                          .map(p => p[0]?.toUpperCase())
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {selectedLog.user_name || 'System Actor'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {selectedLog.user_email || 'Automated Internal Process'}
                        </p>
                      </div>
                    </div>
                    {selectedLog.user_id && (
                      <div className="text-[11px] font-mono text-[var(--text-muted)] pt-1 flex items-center justify-between">
                        <span>User ID:</span>
                        <span
                          className="hover:text-white cursor-pointer"
                          onClick={() => handleCopy(selectedLog.user_id, 'uid')}
                        >
                          {selectedLog.user_id.slice(0, 18)}...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Target Entity */}
                  <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl p-4 space-y-2">
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold block">
                      Target Entity
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">Module:</span>
                      <span className="text-sm font-semibold text-white capitalize">
                        {selectedLog.entity_type?.replace(/_/g, ' ') || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">Action:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActionBadge(selectedLog.action).bg}`}>
                        {selectedLog.action}
                      </span>
                    </div>
                    {selectedLog.entity_id && (
                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-[var(--text-muted)]">
                        <span>Entity ID:</span>
                        <span
                          onClick={() => handleCopy(selectedLog.entity_id, 'modal-eid')}
                          className="text-white hover:underline cursor-copy flex items-center gap-1"
                        >
                          {String(selectedLog.entity_id)}
                          <Copy className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Transition (if exists) */}
                {(selectedLog.previous_status || selectedLog.new_status) && (
                  <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl p-4">
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2">
                      State Transition
                    </span>
                    <div className="flex items-center justify-center gap-4 py-2">
                      <div className="text-center">
                        <span className="text-[11px] text-[var(--text-muted)] block mb-1">Previous Status</span>
                        <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-xs">
                          {selectedLog.previous_status || 'null'}
                        </span>
                      </div>
                      <ArrowRight className="w-5 h-5 text-[var(--gold-primary)]" />
                      <div className="text-center">
                        <span className="text-[11px] text-[var(--text-muted)] block mb-1">New Status</span>
                        <span className="px-3 py-1 rounded-lg bg-[var(--gold-primary)]/15 border border-[var(--gold-primary)]/30 text-[var(--gold-primary)] font-mono text-xs font-bold">
                          {selectedLog.new_status || 'null'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Network Context */}
                {(selectedLog.ip_address || selectedLog.user_agent) && (
                  <div className="bg-[var(--bg-primary)]/40 border border-[var(--border)]/50 rounded-xl p-3 text-xs text-[var(--text-muted)] flex flex-wrap justify-between gap-2">
                    {selectedLog.ip_address && (
                      <div>
                        <span className="font-semibold text-white">IP: </span>
                        <span className="font-mono">{selectedLog.ip_address}</span>
                      </div>
                    )}
                    {selectedLog.user_agent && (
                      <div className="truncate max-w-md" title={selectedLog.user_agent}>
                        <span className="font-semibold text-white">UA: </span>
                        <span>{selectedLog.user_agent}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Full Details Payload (JSON Tree) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      Action Payload Details (JSON)
                    </span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedLog.details, null, 2), 'payload-json')}
                      className="text-xs text-[var(--gold-primary)] hover:underline inline-flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedId === 'payload-json' ? 'Copied!' : 'Copy Payload'}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl font-mono text-xs text-emerald-400 overflow-x-auto max-h-64 leading-relaxed">
                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[var(--bg-primary)]/70 border-t border-[var(--border)] flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2.5 rounded-xl bg-[var(--surface-dark)] border border-[var(--border)] text-white text-sm font-semibold hover:border-[var(--gold-primary)] transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cleanup Retention Modal ────────────────────────────────────────── */}
      <ConfirmModal
        open={showCleanupModal}
        title="Audit Logs Cleanup & Retention"
        description={`This will permanently delete all audit logs older than ${cleanupDays} days from the database. This action is irreversible. Are you sure you want to proceed?`}
        confirmLabel={isCleaning ? 'Cleaning...' : `Delete Logs Older Than ${cleanupDays} Days`}
        cancelLabel="Cancel"
        variant="danger"
        isBusy={isCleaning}
        onConfirm={handleCleanup}
        onCancel={() => setShowCleanupModal(false)}
      />
    </div>
  )
}

export default AuditLogsSection
