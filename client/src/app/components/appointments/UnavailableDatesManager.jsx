import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X, Calendar, Trash2, Loader2, ChevronLeft, ChevronRight,
  CalendarOff, AlertTriangle, Info
} from 'lucide-react'
import {
  format, parseISO, addMonths, subMonths,
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, isSunday, isPast, isBefore, startOfDay
} from 'date-fns'
import Holidays from 'date-holidays'

// ---------------------------------------------------------------------------
// Holiday helper (Philippines)
// ---------------------------------------------------------------------------
const hd = new Holidays('PH')

function getHolidaysForYear(year) {
  const raw = hd.getHolidays(year)
  const map = {}
  for (const h of raw) {
    // date-holidays gives date as a Date or ISO string depending on version
    const d = h.date instanceof Date ? h.date : new Date(h.date)
    const key = format(d, 'yyyy-MM-dd')
    if (!map[key]) {
      map[key] = h.name
    }
  }
  return map
}

function normalizeDateKey(d) {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 10)
  return format(d, 'yyyy-MM-dd')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function UnavailableDatesManager({
  isOpen,
  onClose,
  unavailableDates = [],
  openOverrides = [],
  onAddUnavailable,
  onRemoveUnavailable,
  onAddOpenOverride,
  onRemoveOpenOverride,
  onOpen,
  onAdd,
  onRemove,
  loading = false,
}) {
  const today = startOfDay(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [modal, setModal] = useState(null) // 'add' | 'remove-confirm' | 'open-override' | 'revert-holiday'
  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const handleAddAction = onAddUnavailable || onAdd
  const handleRemoveAction = onRemoveUnavailable || onRemove

  // Fetch open overrides when panel opens.
  // Deferred via requestAnimationFrame so the fetch-triggered parent re-render
  // (setOpenOverrides) doesn't race with the opening animation and cause a flicker.
  useEffect(() => {
    if (!isOpen || !onOpen) return
    const raf = requestAnimationFrame(() => { onOpen() })
    return () => cancelAnimationFrame(raf)
  }, [isOpen])

  // ── Holidays for the visible month's year (and next, if near year end) ──
  const holidayMap = useMemo(() => {
    const year = currentMonth.getFullYear()
    const map = getHolidaysForYear(year)
    // Also load next year if viewing Dec, so Jan of next year is available
    if (currentMonth.getMonth() === 11) {
      Object.assign(map, getHolidaysForYear(year + 1))
    }
    return map
  }, [currentMonth])

  // ── Open override set for O(1) lookup ──
  const openOverrideSet = useMemo(() => {
    return new Set(openOverrides.map(d => normalizeDateKey(d.date)))
  }, [openOverrides])

  // ── Unavailable set for O(1) lookup ──
  const unavailableSet = useMemo(() => {
    return new Set(unavailableDates.map(d => normalizeDateKey(d.date)))
  }, [unavailableDates])

  // ── Calendar days for current month ──
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    const padding = Array(start.getDay()).fill(null)
    return [...padding, ...days]
  }, [currentMonth])

  // ── Sorted unavailable dates for the current month only ──
  const sortedUnavailable = useMemo(() => {
    return [...unavailableDates]
      .map(d => ({
        ...d,
        _dateObj: d.date instanceof Date ? d.date : parseISO(d.date),
        _key: normalizeDateKey(d.date),
      }))
      .filter(d => isSameMonth(d._dateObj, currentMonth))
      .sort((a, b) => a._dateObj - b._dateObj)
  }, [unavailableDates, currentMonth])

  // ── Navigation ──
  const goToToday = () => setCurrentMonth(new Date())
  const prevMonth = () => setCurrentMonth(m => subMonths(m, 1))
  const nextMonth = () => setCurrentMonth(m => addMonths(m, 1))

  // ── Date status (priority order) ──
  const getDateStatus = useCallback((date) => {
    if (!date) return { type: 'empty' }
    const key = normalizeDateKey(date)
    const isPastDate = isBefore(date, today)
    const isHolidayDay = !!holidayMap[key]
    const isSundayDay = isSunday(date)
    const isUnavailableDay = unavailableSet.has(key)
    const isOpenOverride = openOverrideSet.has(key)

    // Priority: Past > Sunday > Holiday (unless open override) > Admin-Unavailable > Available
    if (isPastDate) return { type: 'past', disabled: true }
    if (isSundayDay) return { type: 'sunday', label: 'Closed — Sunday', disabled: true }
    if (isHolidayDay && isOpenOverride) return { type: 'open-holiday', label: `Open on ${holidayMap[key]}`, disabled: false }
    if (isHolidayDay) return { type: 'holiday', label: holidayMap[key], disabled: false } // clickable!
    if (isUnavailableDay) return { type: 'unavailable', label: 'Marked Unavailable', disabled: false }
    return { type: 'available', label: 'Available', disabled: false }
  }, [holidayMap, unavailableSet, openOverrideSet, today])

  // ── Click handler ──
  const handleDateClick = (date) => {
    if (!date) return
    const status = getDateStatus(date)
    if (status.disabled) return

    setSelectedDate(date)
    if (status.type === 'unavailable') {
      setModal('remove-confirm')
    } else if (status.type === 'holiday') {
      setModal('open-override')       // offer to mark holiday as open
    } else if (status.type === 'open-holiday') {
      setModal('revert-holiday')      // offer to revert back to closed
    } else {
      setReason('')
      setModal('add')
    }
  }

  // ── From list: navigate to month and open remove ──
  const handleListItemClick = (entry) => {
    setCurrentMonth(entry._dateObj)
    setSelectedDate(entry._dateObj)
    setModal('remove-confirm')
  }

  // ── Actions ──
  const handleConfirmAdd = async () => {
    if (!selectedDate) return
    setActionLoading(true)
    try {
      await handleAddAction?.(normalizeDateKey(selectedDate), reason.trim())
      closeModal()
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmRemove = async () => {
    if (!selectedDate) return
    setActionLoading(true)
    try {
      const key = normalizeDateKey(selectedDate)
      const entry = unavailableDates.find(d => normalizeDateKey(d.date) === key)
      const targetId = entry?.id || key
      await handleRemoveAction?.(targetId)
      closeModal()
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmOpenOverride = async () => {
    if (!selectedDate) return
    setActionLoading(true)
    try {
      await onAddOpenOverride?.(normalizeDateKey(selectedDate))
      closeModal()
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmRevertHoliday = async () => {
    if (!selectedDate) return
    setActionLoading(true)
    try {
      const key = normalizeDateKey(selectedDate)
      const entry = openOverrides.find(d => normalizeDateKey(d.date) === key)
      const targetId = entry?.id || key
      await onRemoveOpenOverride?.(targetId)
      closeModal()
    } finally {
      setActionLoading(false)
    }
  }

  const closeModal = () => {
    setModal(null)
    setSelectedDate(null)
    setReason('')
  }

  // ── Cell styles by status ──
  const cellStyle = (date, status, isSelected) => {
    const base = 'relative h-10 w-full rounded-lg border text-sm font-medium transition-all duration-150 flex items-center justify-center'
    if (isSelected) return `${base} border-[var(--gold-primary)] bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] ring-1 ring-[var(--gold-primary)]/50`
    if (isToday(date)) {
      if (status.type === 'available') return `${base} border-[var(--gold-primary)]/50 bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] cursor-pointer hover:bg-[var(--gold-primary)]/20`
    }
    switch (status.type) {
      case 'holiday':
        return `${base} border-amber-500/35 bg-amber-500/10 text-amber-400 cursor-pointer hover:bg-amber-500/18 hover:border-amber-400/60`
      case 'open-holiday':
        return `${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-400 cursor-pointer hover:bg-emerald-500/20`
      case 'sunday':
        return `${base} border-slate-600/30 bg-slate-700/20 text-[var(--text-muted)]/50 cursor-not-allowed`
      case 'past':
        return `${base} border-transparent bg-transparent text-[var(--text-muted)]/30 cursor-not-allowed`
      case 'unavailable':
        return `${base} border-red-500/40 bg-red-500/10 text-red-400 cursor-pointer hover:bg-red-500/20`
      case 'available':
        return `${base} border-[var(--border)]/50 bg-transparent text-[var(--text-light)] cursor-pointer hover:border-[var(--gold-primary)]/60 hover:bg-[var(--gold-primary)]/5`
      default:
        return base
    }
  }

  const isCurrentMonthToday = isSameMonth(currentMonth, new Date())

  return (
    <>
    <AnimatePresence>
      {isOpen && (
      <motion.div
        key="udm-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-[480px] max-h-[92vh] overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)] shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-dark)] px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text-light)]">Unavailable Dates</h2>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">Manage dates when appointments cannot be booked</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-2.5 text-[var(--text-muted)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--text-light)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            {/* Calendar */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 sm:p-5">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={prevMonth}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--text-light)]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-[var(--text-light)]">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h3>
                  {!isCurrentMonthToday && (
                    <button
                      onClick={goToToday}
                      className="text-xs px-2.5 py-1 rounded-lg bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 hover:bg-[var(--gold-primary)]/25 transition-colors"
                    >
                      Today
                    </button>
                  )}
                </div>

                <button
                  onClick={nextMonth}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--text-light)]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} className="py-1.5 text-center text-[10px] uppercase tracking-widest text-[var(--text-muted)]/60 font-medium">
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, i) => {
                  if (!date) return <div key={`pad-${i}`} className="h-10" />

                  const status = getDateStatus(date)
                  const isSelected = selectedDate && isSameDay(date, selectedDate)
                  const dateIsToday = isToday(date)

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => handleDateClick(date)}
                      disabled={status.disabled}
                      title={status.label || ''}
                      className={cellStyle(date, status, isSelected)}
                    >
                      <span className="relative z-10">{format(date, 'd')}</span>
                      {/* Today dot */}
                      {dateIsToday && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--gold-primary)]" />
                      )}
                      {/* Holiday dot */}
                      {status.type === 'holiday' && (
                        <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-amber-400" />
                      )}
                      {/* Open holiday dot */}
                      {status.type === 'open-holiday' && !isSelected && (
                        <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-emerald-400" />
                      )}
                      {/* Unavailable dot */}
                      {status.type === 'unavailable' && !isSelected && (
                        <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-red-400" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Compact legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-[var(--border)]/50">
                {[
                  { color: 'bg-emerald-400', label: 'Available' },
                  { color: 'bg-red-400', label: 'Unavailable' },
                  { color: 'bg-amber-400', label: 'Holiday (click to open)' },
                  { color: 'bg-emerald-400/60', label: 'Holiday (open)' },
                  { color: 'bg-[var(--text-muted)]/30', label: 'Sunday / Past' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-[11px] text-[var(--text-muted)]">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unavailable Dates List */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-light)] uppercase tracking-wider">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                {sortedUnavailable.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                    {sortedUnavailable.length} date{sortedUnavailable.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : sortedUnavailable.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-[var(--text-muted)]">
                  <CalendarOff className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No unavailable dates in {format(currentMonth, 'MMMM')}</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {sortedUnavailable.map((entry, i) => {
                    const isPastEntry = isBefore(entry._dateObj, today)
                    return (
                      <button
                        key={entry.id || i}
                        onClick={() => !isPastEntry && handleListItemClick(entry)}
                        disabled={isPastEntry}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left group ${
                          isPastEntry
                            ? 'border-[var(--border)]/30 bg-transparent opacity-40 cursor-not-allowed'
                            : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/35 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 shrink-0 rounded-lg bg-red-500/15 flex items-center justify-center">
                            <Calendar className="w-3.5 h-3.5 text-red-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--text-light)] leading-tight">
                              {format(entry._dateObj, 'EEE, MMM d, yyyy')}
                            </p>
                            {entry.reason && (
                              <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{entry.reason}</p>
                            )}
                          </div>
                        </div>
                        {!isPastEntry && (
                          <Trash2 className="w-3.5 h-3.5 text-red-400/50 group-hover:text-red-400 shrink-0 ml-2 transition-colors" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>

      {/* ── Add Modal ── */}
      <AnimatePresence>
        {modal === 'add' && selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--gold-primary)]/15 flex items-center justify-center">
                  <CalendarOff className="w-5 h-5 text-[var(--gold-primary)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-light)]">Mark as Unavailable</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Reason <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmAdd()}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none transition-colors"
                  placeholder="e.g. Staff training, Maintenance…"
                  autoFocus
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-sm text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--text-light)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAdd}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--gold-primary)] text-sm font-medium text-black hover:bg-[var(--gold-primary)]/90 transition-colors disabled:opacity-50"
                >
                  {actionLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CalendarOff className="w-4 h-4" />}
                  Mark Unavailable
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Remove Confirm Modal ── */}
      <AnimatePresence>
        {modal === 'remove-confirm' && selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-light)]">Remove Unavailable Date</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              <p className="text-sm text-[var(--text-muted)] mb-5 pl-[52px]">
                This date will become available for appointment bookings again.
              </p>

              {/* Show existing reason if any */}
              {(() => {
                const key = normalizeDateKey(selectedDate)
                const entry = unavailableDates.find(d => normalizeDateKey(d.date) === key)
                return entry?.reason ? (
                  <div className="mb-5 pl-[52px]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Current reason</p>
                    <p className="text-sm text-[var(--text-light)] bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl px-3 py-2">
                      {entry.reason}
                    </p>
                  </div>
                ) : null
              })()}

              <div className="flex gap-2.5">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-sm text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--text-light)] transition-colors"
                >
                  Keep
                </button>
                <button
                  onClick={handleConfirmRemove}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/90 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {actionLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                  Remove Date
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Open Override Modal (mark holiday as open) ── */}
      <AnimatePresence>
        {modal === 'open-override' && selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-light)]">Open Holiday for Bookings</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              <p className="text-sm text-[var(--text-muted)] mb-6 pl-[52px]">
                {(() => { const k = normalizeDateKey(selectedDate); return holidayMap[k] ? <><strong className="text-amber-400">{holidayMap[k]}</strong> is normally closed. </> : null })()}
                Clients will be able to book appointments on this day.
              </p>

              <div className="flex gap-2.5">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-sm text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--text-light)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmOpenOverride}
                  disabled={actionLoading || !onAddOpenOverride}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/90 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  {actionLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Calendar className="w-4 h-4" />}
                  Mark as Open
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Revert Holiday Modal (close an open override) ── */}
      <AnimatePresence>
        {modal === 'revert-holiday' && selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-light)]">Revert to Holiday (Closed)</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              <p className="text-sm text-[var(--text-muted)] mb-6 pl-[52px]">
                {(() => { const k = normalizeDateKey(selectedDate); return holidayMap[k] ? <><strong className="text-amber-400">{holidayMap[k]}</strong> — </> : null })()}
                This day will be closed again. Clients will not be able to book appointments.
              </p>

              <div className="flex gap-2.5">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-sm text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--text-light)] transition-colors"
                >
                  Keep Open
                </button>
                <button
                  onClick={handleConfirmRevertHoliday}
                  disabled={actionLoading || !onRemoveOpenOverride}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/90 text-sm font-medium text-black hover:bg-amber-500 transition-colors disabled:opacity-50"
                >
                  {actionLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CalendarOff className="w-4 h-4" />}
                  Close Holiday
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
