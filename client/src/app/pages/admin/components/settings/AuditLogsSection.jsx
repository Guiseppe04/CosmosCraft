import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  History, Search, Filter, ChevronDown, ChevronLeft, ChevronRight, Eye,
  X, ArrowRight, Briefcase, ShoppingBag, CreditCard, Truck, Wallet,
  Package, Layers, Wrench, Shield, CalendarOff,
} from 'lucide-react'
import { adminApi } from '../../../../utils/adminApi'
import { SectionLoader } from '../shared/SectionLoader'
import { formatAuditEntry, getChangeList } from '../../../../utils/auditFormatters'
import {
  formatAction,
  formatAuditTimestamp,
  formatEntityId,
  formatEntityType,
  formatStatus,
  getAuditActor,
} from '../../../../utils/auditLabels'

const MODULE_OPTIONS = [
  { value: 'all', label: 'All Modules' },
  { value: 'project', label: 'Projects', icon: Briefcase },
  { value: 'order', label: 'Orders', icon: ShoppingBag },
  { value: 'payment', label: 'Payments', icon: CreditCard },
  { value: 'refund', label: 'Refunds', icon: CreditCard },
  { value: 'inventory', label: 'Inventory', icon: Package },
  { value: 'fulfillment', label: 'Fulfillment', icon: Truck },
  { value: 'pos', label: 'POS', icon: Wallet },
  { value: 'products', label: 'Products', icon: Package },
  { value: 'guitar_builder_parts', label: 'Guitar Parts', icon: Layers },
  { value: 'appointments', label: 'Appointments', icon: Truck },
  { value: 'appointment_schedule', label: 'Booking Schedule', icon: CalendarOff },
  { value: 'services', label: 'Services', icon: Wrench },
  { value: 'users', label: 'Users', icon: Shield },
]

const MODULE_ICONS = {
  project: Briefcase,
  order: ShoppingBag,
  payment: CreditCard,
  refund: CreditCard,
  inventory: Package,
  fulfillment: Truck,
  pos: Wallet,
  products: Package,
  guitar_builder_parts: Layers,
  appointments: Truck,
  appointment_schedule: CalendarOff,
  services: Wrench,
  users: Shield,
}

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
]

const PAGE_SIZE_VALUES = [10, 25, 50, 100]

const PILL_BASE = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold'
const PILL_TONES = {
  neutral: 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border)]',
  gold: 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] border-[var(--gold-primary)]/30',
  success: 'bg-green-500/15 text-green-400 border-green-500/30',
  danger: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const STATUS_PILL_TONES = {
  success: PILL_TONES.success,
  danger: PILL_TONES.danger,
  gold: PILL_TONES.gold,
}

const POSITIVE_STATUSES = ['completed', 'approved', 'delivered', 'received', 'paid', 'verified', 'confirmed', 'active', 'paid_in_full']
const NEGATIVE_STATUSES = ['cancelled', 'canceled', 'rejected', 'failed', 'voided', 'returned', 'no_show']

const statusTone = (status) => {
  const key = String(status || '').trim().toLowerCase()
  if (POSITIVE_STATUSES.includes(key)) return 'success'
  if (NEGATIVE_STATUSES.includes(key)) return 'danger'
  return 'gold'
}

const getModuleIcon = (entityType) => MODULE_ICONS[String(entityType || '').toLowerCase()] || History

const pillClass = (tone) => `${PILL_BASE} ${PILL_TONES[tone] || PILL_TONES.neutral}`

const monoClass = (mono) => (mono ? 'font-mono tracking-tight' : '')

const DetailRow = ({ label, children }) => (
  <div className="flex flex-col gap-1 border-b border-[var(--border)]/50 py-2.5 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] sm:pt-0.5">{label}</span>
    <div className="text-xs text-[var(--text-light)] sm:max-w-[65%] sm:text-right break-words">{children}</div>
  </div>
)

/**
 * "Pending Verification → Verified" for a status transition, or
 * "₱2,500 → ₱2,800" for a field change.
 */
const ChangeLine = ({ change }) => {
  if (!change) return null
  const { label, from, to, delta } = change
  return (
    <span className="inline-flex items-center justify-end gap-1.5 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      {from && <span className="line-through text-[var(--text-muted)]">{from}</span>}
      {from && to && <ArrowRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />}
      {to && <span className="font-semibold text-[var(--text-light)]">{to}</span>}
      {delta && <span className="text-[11px] text-[var(--text-muted)]">({delta})</span>}
    </span>
  )
}

/**
 * Structured details view. Sections only render when the record actually holds
 * that information — there is no raw payload view anywhere in this screen.
 */
function AuditDetailBody({ log }) {
  const timestamp = formatAuditTimestamp(log.created_at)
  const actor = getAuditActor(log)
  const entry = useMemo(() => formatAuditEntry(log), [log])
  const changes = useMemo(() => getChangeList(log), [log])
  const ModuleIcon = getModuleIcon(log.entity_type)

  const hasStatusPill = !!(log.previous_status || log.new_status)

  // The formatter's headline change comes first, then the remaining field
  // changes. Status transitions render as pills above, so drop the duplicate.
  const changeEntries = useMemo(() => {
    const seen = new Set()
    return [entry.change, ...changes].filter((change) => {
      if (!change || (hasStatusPill && change.label === 'Status')) return false
      const key = `${change.label}|${change.from}|${change.to}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [changes, entry.change, hasStatusPill])

  return (
    <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Activity</p>
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-[var(--gold-primary)]/15 border border-[var(--gold-primary)]/30 text-[var(--gold-primary)]">
            <ModuleIcon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-[var(--text-light)]">{entry.title}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{entry.moduleLabel}</p>
          </div>
        </div>
        <p className="text-sm text-[var(--text-light)]/90 mt-2.5 leading-relaxed">{entry.description}</p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/40 px-4">
        <DetailRow label="Performed By">
          {actor.name}
          <span className="block text-[11px] text-[var(--text-muted)]">{actor.subtitle}</span>
        </DetailRow>
        <DetailRow label="Date &amp; Time">{timestamp.full}</DetailRow>

        {entry.entity && (
          <DetailRow label={entry.entity.label}>
            <span className={monoClass(entry.entity.mono)}>{entry.entity.value}</span>
          </DetailRow>
        )}

        {entry.relatedEntity && (
          <DetailRow label={entry.relatedEntity.label}>
            <span className={monoClass(entry.relatedEntity.mono)}>{entry.relatedEntity.value}</span>
          </DetailRow>
        )}

        {hasStatusPill && (
          <DetailRow label="Status Change">
            <span className="inline-flex items-center justify-end gap-1.5 flex-wrap">
              {log.previous_status && (
                <span className={`${PILL_BASE} ${PILL_TONES.neutral}`}>{formatStatus(log.previous_status)}</span>
              )}
              {log.previous_status && log.new_status && (
                <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
              )}
              {log.new_status && (
                <span className={pillClass(statusTone(log.new_status))}>{formatStatus(log.new_status)}</span>
              )}
            </span>
          </DetailRow>
        )}

        {entry.metadata.map((item) => (
          <DetailRow key={`${item.label}-${item.value}`} label={item.label}>
            <span className={monoClass(item.mono)}>{item.value}</span>
          </DetailRow>
        ))}
      </div>

      {changeEntries.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Changes</p>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/40 px-4">
            {changeEntries.map((change) => (
              <DetailRow key={`${change.label}-${change.from}-${change.to}`} label={change.label}>
                <ChangeLine change={change} />
              </DetailRow>
            ))}
          </div>
        </div>
      )}

      {log.entity_id && (
        <p className="text-[11px] text-[var(--text-muted)]">
          Record reference:{' '}
          <span className="font-mono text-[var(--text-light)]">{formatEntityId(log.entity_id)}</span>
          {log.entity_type && <span> · {formatEntityType(log.entity_type)}</span>}
        </p>
      )}
    </div>
  )
}

export function AuditLogsSection({ showToast }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Filter inputs (uncommitted) vs applied filters. The applied set is what the
  // request uses, so typing never triggers a request on every keystroke.
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [selectedModule, setSelectedModule] = useState('all')
  const [selectedAction, setSelectedAction] = useState('all')
  const [dateRangePreset, setDateRangePreset] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [actionOptions, setActionOptions] = useState([])
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)

  const [selectedLog, setSelectedLog] = useState(null)

  const filterDropdownRef = useRef(null)
  // Monotonic request id: a slow earlier response can never overwrite a newer one.
  const requestIdRef = useRef(0)

  const isSearching = appliedSearch.length > 0

  /* ── Date range (local-time safe) ────────────────────────────────────── */

  /**
   * Calendar dates are interpreted in the browser's timezone on purpose: a
   * "Today" filter must match the admin's own day, not UTC's. Only the custom
   * end date is pushed to the last millisecond of that local day.
   */
  const { startDate, endDate } = useMemo(() => {
    const now = new Date()

    if (dateRangePreset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return { startDate: start.toISOString(), endDate: now.toISOString() }
    }

    if (dateRangePreset === '7days' || dateRangePreset === '30days') {
      const days = dateRangePreset === '7days' ? 7 : 30
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
      return { startDate: start.toISOString(), endDate: now.toISOString() }
    }

    if (dateRangePreset === 'custom') {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : null
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : null
      return {
        startDate: start && !Number.isNaN(start.getTime()) ? start.toISOString() : undefined,
        endDate: end && !Number.isNaN(end.getTime()) ? end.toISOString() : undefined,
      }
    }

    return { startDate: undefined, endDate: undefined }
  }, [dateRangePreset, customStartDate, customEndDate])

  /* ── Data loading ────────────────────────────────────────────────────── */

  const fetchLogs = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)

    try {
      const params = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }

      if (selectedModule !== 'all') params.entity_type = selectedModule
      if (selectedAction !== 'all') params.action = selectedAction
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      if (appliedSearch) params.search = appliedSearch

      const res = await adminApi.getAuditLogs(params)

      // Ignore a response that a newer request has already superseded.
      if (requestId !== requestIdRef.current) return

      if (res?.data) {
        setLogs(res.data)
        setTotal(res.pagination?.total ?? res.data.length)
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      console.error('Failed to load audit logs:', err)
      showToast?.(err.message || 'Failed to load audit logs', 'error')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [appliedSearch, endDate, page, pageSize, selectedAction, selectedModule, startDate, showToast])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Action filter values come from the server so the list only offers actions
  // that can actually return results.
  useEffect(() => {
    let cancelled = false
    adminApi
      .getAuditActions()
      .then((res) => {
        if (!cancelled) setActionOptions(Array.isArray(res?.data) ? res.data : [])
      })
      .catch(() => {
        if (!cancelled) setActionOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounce the search box; every application of a filter returns to page 1.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setAppliedSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)

  // Never keep a page the server cannot serve (filters can shrink the result set).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!selectedLog) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedLog(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedLog])

  /* ── Filter handlers (no state setters run during render) ─────────────── */

  const applyModule = (value) => {
    setSelectedModule(value)
    setPage(1)
  }

  const applyAction = (value) => {
    setSelectedAction(value)
    setPage(1)
  }

  const applyDatePreset = (value) => {
    setDateRangePreset(value)
    setPage(1)
  }

  const applyStartDate = (value) => {
    setCustomStartDate(value)
    setPage(1)
  }

  const applyEndDate = (value) => {
    setCustomEndDate(value)
    setPage(1)
  }

  const applyPageSize = (value) => {
    setPageSize(value)
    setPage(1)
  }

  const resetFilters = () => {
    setSearchInput('')
    setAppliedSearch('')
    setSelectedModule('all')
    setSelectedAction('all')
    setDateRangePreset('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setPage(1)
  }

  const hasActiveFilters =
    !!searchInput.trim() ||
    selectedModule !== 'all' ||
    selectedAction !== 'all' ||
    dateRangePreset !== 'all' ||
    !!customStartDate ||
    !!customEndDate

  const activeFilterList = useMemo(() => {
    const list = []

    if (searchInput.trim()) {
      list.push({
        key: 'search',
        label: `Search: ${searchInput.trim()}`,
        onRemove: () => {
          setSearchInput('')
          setAppliedSearch('')
          setPage(1)
        },
      })
    }
    if (selectedModule !== 'all') {
      const moduleLabel = MODULE_OPTIONS.find((option) => option.value === selectedModule)?.label || formatEntityType(selectedModule)
      list.push({ key: 'module', label: `Module: ${moduleLabel}`, onRemove: () => applyModule('all') })
    }
    if (selectedAction !== 'all') {
      list.push({ key: 'action', label: `Action: ${formatAction(selectedAction)}`, onRemove: () => applyAction('all') })
    }
    if (dateRangePreset !== 'all') {
      const presetLabel = DATE_PRESETS.find((preset) => preset.value === dateRangePreset)?.label || 'Custom Range'
      const rangeLabel = dateRangePreset === 'custom'
        ? `${customStartDate || 'Any'} → ${customEndDate || 'Any'}`
        : presetLabel
      list.push({
        key: 'date',
        label: `Date: ${rangeLabel}`,
        onRemove: () => {
          setDateRangePreset('all')
          setCustomStartDate('')
          setCustomEndDate('')
          setPage(1)
        },
      })
    }

    return list
    // applyModule/applyAction are stable wrappers over setState; including them
    // would only rebuild this list on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, selectedModule, selectedAction, dateRangePreset, customStartDate, customEndDate])

  const buttonClass = 'inline-flex h-9 sm:h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-semibold text-[var(--text-light)] transition-colors hover:border-[var(--gold-primary)] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'
  const selectClass = 'mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:outline-none focus:border-[var(--gold-primary)]'

  const showTable = !(loading && logs.length === 0)

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl shadow-sm p-4">
        <h2 className="text-base font-bold text-[var(--text-light)]">Audit Logs</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 max-w-2xl">
          A read-only record of who did what, to which order, project or appointment, and when.
          Entries are written by the system and can never be edited or removed.
        </p>
      </div>

      {/* ── Filter Toolbar + Table ────────────────────────────────────────── */}
      <div className={`relative bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl shadow-sm ${filterMenuOpen ? 'z-30 overflow-visible' : 'overflow-hidden'}`}>
        <div className="p-4 border-b border-[var(--border)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <span className="text-sm font-bold text-[var(--text-light)] uppercase tracking-wider">Activity Records</span>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search order, payment, customer, product, or ID..."
                aria-label="Search audit history"
                className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg pl-9 pr-9 py-2 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none w-48 sm:w-72 shadow-sm"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-light)] transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => setFilterMenuOpen((open) => !open)}
                aria-expanded={filterMenuOpen}
                aria-haspopup="true"
                className={buttonClass}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {activeFilterList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-[var(--gold-primary)] text-[var(--text-dark)]">
                    {activeFilterList.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </button>

              {filterMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,22rem)] overflow-y-auto max-h-[75vh] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl p-4 text-[var(--text-light)]">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-light)]">Filters</p>

                    <label className="block text-xs font-semibold text-[var(--text-light)]">
                      Module
                      <select value={selectedModule} onChange={(event) => applyModule(event.target.value)} className={selectClass}>
                        {MODULE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} className="text-[var(--text-light)] bg-[var(--surface-dark)]">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-semibold text-[var(--text-light)]">
                      Action
                      <select value={selectedAction} onChange={(event) => applyAction(event.target.value)} className={selectClass}>
                        <option value="all" className="text-[var(--text-light)] bg-[var(--surface-dark)]">All Actions</option>
                        {actionOptions.map((action) => (
                          <option key={action} value={action} className="text-[var(--text-light)] bg-[var(--surface-dark)]">
                            {formatAction(action)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-semibold text-[var(--text-light)]">
                      Date Range
                      <select value={dateRangePreset} onChange={(event) => applyDatePreset(event.target.value)} className={selectClass}>
                        {DATE_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value} className="text-[var(--text-light)] bg-[var(--surface-dark)]">
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {dateRangePreset === 'custom' && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-[var(--text-light)]">
                          From
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(event) => applyStartDate(event.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:outline-none focus:border-[var(--gold-primary)] [color-scheme:dark]"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-[var(--text-light)]">
                          To
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(event) => applyEndDate(event.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:outline-none focus:border-[var(--gold-primary)] [color-scheme:dark]"
                          />
                        </label>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[var(--border)]">
                      <button
                        type="button"
                        onClick={resetFilters}
                        disabled={!hasActiveFilters}
                        className="w-full py-2 px-3 text-xs font-bold text-[var(--text-light)] bg-[var(--surface-dark)] hover:bg-[var(--bg-primary)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {activeFilterList.length > 0 && (
          <div className="px-5 py-2.5 border-b border-[var(--border)] flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Active:</span>
            {activeFilterList.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[var(--gold-primary)]/15 text-[var(--text-light)] border border-[var(--gold-primary)]/40"
              >
                <span>{item.label}</span>
                <button
                  type="button"
                  onClick={item.onRemove}
                  className="text-[var(--text-muted)] hover:text-[var(--text-light)] transition-colors"
                  title="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-light)] underline ml-2 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-bold border-b border-[var(--border)]">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Date &amp; Time</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4 hidden xl:table-cell">Module</th>
                  <th className="py-3 px-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/50">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center px-4">
                      <History className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
                      <p className="text-sm font-semibold text-[var(--text-light)]">
                        {isSearching ? 'No matching activity' : 'No activity found'}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                        {isSearching
                          ? `Nothing in the audit history matches "${appliedSearch}". Try a shorter term or a different date range.`
                          : hasActiveFilters
                            ? 'No audit activity matches your current filters.'
                            : 'No audit records have been generated yet.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="mt-4 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] hover:border-[var(--gold-primary)] transition-colors"
                        >
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const timestamp = formatAuditTimestamp(log.created_at)
                    const actor = getAuditActor(log)
                    const entry = formatAuditEntry(log)
                    const ModuleIcon = getModuleIcon(log.entity_type)

                    return (
                      <tr
                        key={log.audit_id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-[var(--bg-primary)]/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 whitespace-nowrap align-top">
                          <p className="text-[var(--text-light)] font-semibold">{timestamp.date}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">{timestamp.time}</p>
                          {timestamp.relative && (
                            <p className="text-[10px] text-[var(--text-muted)]/70">{timestamp.relative}</p>
                          )}
                        </td>

                        <td className="py-3 px-4 align-top">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[var(--gold-primary)]/15 border border-[var(--gold-primary)]/30 flex items-center justify-center text-[10px] font-bold text-[var(--gold-primary)] shrink-0">
                              {actor.initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[var(--text-light)] font-semibold truncate max-w-[130px]">{actor.name}</p>
                              <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[130px]">{actor.subtitle}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[var(--text-light)] font-semibold">{entry.title}</span>
                            {entry.tone !== 'neutral' && (
                              <span className={`${PILL_BASE} ${STATUS_PILL_TONES[entry.tone] || PILL_TONES.neutral}`}>
                                {entry.entity ? entry.entity.value : entry.moduleLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-[var(--text-muted)] mt-0.5 max-w-[520px] leading-relaxed">{entry.description}</p>
                          {entry.secondary && (
                            <p className="text-[11px] text-[var(--text-muted)]/80 mt-0.5 truncate max-w-[520px]">
                              {entry.secondary}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4 hidden xl:table-cell align-top whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-muted)]">
                              <ModuleIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gold-primary)]/20 text-[var(--text-light)] border border-[var(--gold-primary)]/40">
                              {formatEntityType(log.entity_type)}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right align-top whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedLog(log)
                            }}
                            className="p-1.5 rounded-lg border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-light)] transition"
                            title="View details"
                            aria-label="View activity details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <SectionLoader label="Loading audit logs..." className="py-20" />
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[var(--text-muted)]">
              Showing page <strong className="text-[var(--text-light)]">{currentPage}</strong> of{' '}
              <strong className="text-[var(--text-light)]">{totalPages}</strong> ({total}{' '}
              {isSearching ? `matching "${appliedSearch}"` : 'total records'})
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[var(--text-muted)]">Per page:</span>
              <select
                value={pageSize}
                onChange={(event) => applyPageSize(event.target.value)}
                aria-label="Records per page"
                className="bg-[var(--surface-elevated)] text-[var(--text-light)] border border-[var(--border)] rounded px-2 py-0.5 text-xs font-semibold focus:outline-none"
              >
                {PAGE_SIZE_VALUES.map((size) => (
                  <option key={size} value={size} className="text-[var(--text-light)] bg-[var(--surface-elevated)]">
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)] hover:border-[var(--gold-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)] hover:border-[var(--gold-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Details Modal (structured, no raw payload) ────────────────────── */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            key="audit-detail-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedLog(null)
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              role="dialog"
              aria-modal="true"
              aria-label="Activity details"
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--gold-primary)]/15 border border-[var(--gold-primary)]/30 flex items-center justify-center text-[var(--gold-primary)] shrink-0">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-[var(--text-light)]">Activity Details</h3>
                    <p className="text-xs text-[var(--text-muted)] truncate">{formatAuditEntry(selectedLog).moduleLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-light)] rounded-xl hover:bg-[var(--bg-primary)] transition-colors shrink-0"
                  aria-label="Close details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <AuditDetailBody log={selectedLog} />

              <div className="p-4 border-t border-[var(--border)] flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] text-sm font-semibold hover:border-[var(--gold-primary)] transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AuditLogsSection