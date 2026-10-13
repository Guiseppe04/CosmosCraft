import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  History, Eye,
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
  { value: 'rbac', label: 'Roles & Permissions', icon: Shield },
  { value: 'settings', label: 'Settings', icon: Wrench },
  { value: 'cart', label: 'Cart', icon: ShoppingBag },
  { value: 'customizations', label: 'Customizations', icon: Layers },
  { value: 'notifications', label: 'Notifications', icon: History },
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
  rbac: Shield,
  settings: Wrench,
  cart: ShoppingBag,
  customizations: Layers,
  notifications: History,
}

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
  const empty = { entity_type: 'all', action: 'all', search: '', start_date: '', end_date: '' }
  const [draft, setDraft] = useState(empty)
  const [applied, setApplied] = useState(null)
  const [logs, setLogs] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(25)
  const [selectedLog, setSelectedLog] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const request = useRef(null)
  const detailRequest = useRef(null)
  const actionsRequest = useRef(null)
  const update = (field, value) => setDraft(prev => ({ ...prev, [field]: value }))
  const datePreset = days => {
    const now = new Date()
    const calendarDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    setDraft(prev => ({ ...prev,
      start_date: days ? calendarDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1)) : '',
      end_date: days ? calendarDate(now) : '',
    }))
  }
  useEffect(() => {
    let active = true
    actionsRequest.current ||= adminApi.getAuditActions()
    actionsRequest.current.then(res => { if (active) setActions(res.data || []) }).catch(() => {})
    return () => { active = false }
  }, [])
  useEffect(() => () => { request.current?.abort(); detailRequest.current?.abort() }, [])
  const closeDetails = () => { detailRequest.current?.abort(); setSelectedLog(null) }
  useEffect(() => {
    if (!selectedLog) return
    const listener = event => { if (event.key === 'Escape') closeDetails() }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [selectedLog])
  const load = async (filters, nextPage = 1, nextSize = size) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setError(''); setLogs([]); setPage(nextPage); setSize(nextSize)
    try {
      const res = await adminApi.getAuditLogs({ ...filters, limit: nextSize, offset: (nextPage - 1) * nextSize }, { signal: controller.signal })
      if (controller.signal.aborted) return
      setLogs(res.data || []); setTotal(res.pagination?.total || 0)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err.message || 'Failed to load audit logs'); setTotal(0)
      showToast?.(err.message || 'Failed to load audit logs', 'error')
    } finally { if (!controller.signal.aborted) setLoading(false) }
  }
  const submit = event => {
    event.preventDefault()
    if (loading) return
    if (draft.start_date && draft.end_date && draft.start_date > draft.end_date) {
      setError('Start date must be on or before end date.'); return
    }
    const filters = {}
    if (draft.entity_type !== 'all') filters.entity_type = draft.entity_type
    if (draft.action !== 'all') filters.action = draft.action
    if (draft.search.trim()) filters.search = draft.search.trim()
    if (draft.start_date) filters.start_date = new Date(draft.start_date + 'T00:00:00').toISOString()
    if (draft.end_date) filters.end_date = new Date(draft.end_date + 'T23:59:59.999').toISOString()
    closeDetails(); setApplied(filters); load(filters)
  }
  const reset = () => {
    request.current?.abort(); closeDetails(); setDraft(empty); setApplied(null)
    setLogs([]); setTotal(0); setPage(1); setLoading(false); setError('')
  }
  const openDetails = async log => {
    detailRequest.current?.abort()
    const controller = new AbortController()
    detailRequest.current = controller
    setSelectedLog(log); setDetailLoading(true); setDetailError('')
    try {
      const res = await adminApi.getAuditLog(log.audit_id, { signal: controller.signal })
      if (!controller.signal.aborted) setSelectedLog(res.data)
    } catch (err) { if (!controller.signal.aborted) setDetailError(err.message || 'Failed to load details') }
    finally { if (!controller.signal.aborted) setDetailLoading(false) }
  }
  const control = 'mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:outline-none focus:border-[var(--gold-primary)]'
  const button = 'rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-light)] hover:border-[var(--gold-primary)] disabled:opacity-40'
  const pages = Math.max(1, Math.ceil(total / size))
  return <div className="space-y-6">
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-4">
      <h2 className="text-base font-bold text-[var(--text-light)]">Audit Logs</h2>
      <p className="text-xs text-[var(--text-muted)] mt-1">A read-only record of who changed each record and when.</p>
    </div>
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <form onSubmit={submit} className="p-4 space-y-4 border-b border-[var(--border)]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-[var(--text-light)]">Module<select aria-label="Module" className={control} value={draft.entity_type} onChange={e => update('entity_type', e.target.value)}>{MODULE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-xs text-[var(--text-light)]">Action<select aria-label="Action" className={control} value={draft.action} onChange={e => update('action', e.target.value)}><option value="all">All Actions</option>{actions.map(action => <option key={action} value={action}>{formatAction(action)}</option>)}</select></label>
          <label className="text-xs text-[var(--text-light)]">Search<input type="search" aria-label="Search audit history" className={control} maxLength={200} value={draft.search} onChange={e => update('search', e.target.value)} placeholder="Details, reference, entity or actor" /></label>
          <label className="text-xs text-[var(--text-light)]">Start date<input type="date" className={control} value={draft.start_date} onChange={e => update('start_date', e.target.value)} /></label>
          <label className="text-xs text-[var(--text-light)]">End date<input type="date" className={control} value={draft.end_date} onChange={e => update('end_date', e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-2">{[['All Time', 0], ['Today', 1], ['Last 7 Days', 7], ['Last 30 Days', 30]].map(([label, days]) => <button key={label} type="button" className={button} onClick={() => datePreset(days)}>{label}</button>)}</div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={button} disabled={loading}>Apply Filters</button>
          <button type="button" className={button} onClick={reset}>Reset Filters</button>
          <span className="text-xs text-[var(--text-muted)]">Edit filters, then apply to update results. Dates use your local time.</span>
        </div>
      </form>
      {error && <div role="alert" className="p-4 text-sm text-red-400">{error}</div>}
      {!applied ? <p className="p-12 text-center text-sm text-[var(--text-muted)]">Select your filters to view audit records.</p> : loading ? <SectionLoader label="Loading audit logs..." className="py-20" /> : !error && <>
        {logs.length === 0 ? <p className="p-12 text-center text-sm text-[var(--text-muted)]">No audit records match the applied filters.</p> : <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--text-light)]">
            <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)]"><tr>{['Date & Time', 'Actor', 'Module', 'Action', 'Activity / Reference', 'Changes', 'Details'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead>
            <tbody>{logs.map(log => {
              const entry = formatAuditEntry(log)
              const actor = getAuditActor(log)
              const changes = getChangeList(log)
              return <tr key={log.audit_id} className="border-t border-[var(--border)]">
                <td className="p-4 whitespace-nowrap">{formatAuditTimestamp(log.created_at).full}</td>
                <td className="p-4">{actor.name}<span className="block text-[var(--text-muted)]">{actor.subtitle}</span></td>
                <td className="p-4">{entry.moduleLabel}</td><td className="p-4">{formatAction(log.action)}</td>
                <td className="p-4 min-w-[240px]"><p className="font-semibold">{entry.title}</p><p>{entry.description}</p>{entry.entity && <p>{entry.entity.label}: {entry.entity.value}</p>}{log.entity_id && <p className="font-mono text-[var(--text-muted)]">{formatEntityId(log.entity_id)}</p>}</td>
                <td className="p-4">{changes.slice(0, 3).map((change, index) => <div key={index}><ChangeLine change={change} /></div>)}{log.previous_status && log.new_status && <p>{formatStatus(log.previous_status)} <ArrowRight className="inline w-3 h-3" /> {formatStatus(log.new_status)}</p>}</td>
                <td className="p-4"><button type="button" className={button} aria-label="View activity details" onClick={() => openDetails(log)}><Eye className="w-4 h-4" /></button></td>
              </tr>
            })}</tbody>
          </table>
        </div>}
        <div className="p-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <span>Page {page} of {pages} ({total} matching records)</span>
          <label>Per page: <select aria-label="Records per page" className={control} value={size} onChange={e => load(applied, 1, Number(e.target.value))}>{[25, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <div className="flex gap-2"><button type="button" className={button} disabled={page <= 1} onClick={() => load(applied, page - 1)}>Previous</button><button type="button" className={button} disabled={page >= pages} onClick={() => load(applied, page + 1)}>Next</button></div>
        </div>
      </>}
    </div>
    <AnimatePresence>{selectedLog && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={e => { if (e.target === e.currentTarget) closeDetails() }}>
      <div role="dialog" aria-modal="true" aria-label="Activity details" className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl w-full max-w-2xl overflow-hidden">
        <div className="p-6 flex justify-between border-b border-[var(--border)]"><h3 className="text-lg font-bold text-[var(--text-light)]">Activity Details</h3><button type="button" onClick={closeDetails} aria-label="Close details" className={button}><X className="w-4 h-4" /></button></div>
        {detailLoading ? <SectionLoader label="Loading details..." /> : detailError ? <div role="alert" className="p-6 text-red-400">{detailError}</div> : <AuditDetailBody log={selectedLog} />}
      </div>
    </motion.div>}</AnimatePresence>
  </div>
}
export default AuditLogsSection
