import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X, Calendar, Plus, Trash2, Loader2, AlertCircle, CheckCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { format, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isSunday, isPast } from 'date-fns'

// Default holidays
const DEFAULT_HOLIDAYS = [
  '2026-01-01', '2026-02-17', '2026-04-02', '2026-04-03', '2026-04-04',
  '2026-04-09', '2026-05-01', '2026-06-12', '2026-08-21', '2026-08-31',
  '2026-11-01', '2026-11-02', '2026-11-30', '2026-12-08', '2026-12-24',
  '2026-12-25', '2026-12-30', '2026-12-31',
]

const HOLIDAY_LABELS = {
  '2026-01-01': "New Year's Day",
  '2026-02-17': 'Chinese New Year',
  '2026-04-02': 'Maundy Thursday',
  '2026-04-03': 'Good Friday',
  '2026-04-04': 'Black Saturday',
  '2026-04-09': 'Araw ng Kagitingan',
  '2026-05-01': 'Labor Day',
  '2026-06-12': 'Independence Day',
  '2026-08-21': 'Ninoy Aquino Day',
  '2026-08-31': 'National Heroes Day',
  '2026-11-01': 'All Saints\' Day',
  '2026-11-02': 'All Souls\' Day',
  '2026-11-30': 'Bonifacio Day',
  '2026-12-08': 'Feast of the Immaculate Conception',
  '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day',
  '2026-12-30': 'Rizal Day',
  '2026-12-31': 'Last Day of the Year',
}

export default function UnavailableDatesManager({
  isOpen,
  onClose,
  unavailableDates = [],
  onAddUnavailable,
  onRemoveUnavailable,
  onAdd,
  onRemove,
  loading = false,
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const handleAddAction = onAddUnavailable || onAdd
  const handleRemoveAction = onRemoveUnavailable || onRemove

  // Get unavailable dates as a Set for quick lookup
  const unavailableSet = new Set(
    unavailableDates.map(d => {
      const date = d.date instanceof Date ? d.date : parseISO(d.date)
      return format(date, 'yyyy-MM-dd')
    })
  )

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    
    // Add padding for first week
    const firstDayOfWeek = start.getDay()
    const paddingDays = Array(firstDayOfWeek).fill(null)
    
    return [...paddingDays, ...days]
  }, [currentMonth])

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1))
  }

  const handleDateClick = (date) => {
    if (!date) return
    
    const dateStr = format(date, 'yyyy-MM-dd')
    const isUnavailable = unavailableSet.has(dateStr)
    const isHoliday = DEFAULT_HOLIDAYS.includes(dateStr)
    const isSundayDay = isSunday(date)
    const isPastDate = isPast(date) && !isToday(date)

    // Can't toggle holidays or past dates
    if (isHoliday || isPastDate) return

    if (isUnavailable) {
      // Find the unavailable date entry
      const unavailableEntry = unavailableDates.find(d => 
        format(parseISO(d.date), 'yyyy-MM-dd') === dateStr
      )
      if (unavailableEntry) {
        setSelectedDate(date)
        setReason(unavailableEntry.reason || '')
        setShowAddModal(true)
      }
    } else {
      setSelectedDate(date)
      setReason('')
      setShowAddModal(true)
    }
  }

  const handleAddUnavailable = async () => {
    if (!selectedDate) return
    setActionLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      await handleAddAction?.(dateStr, reason)
      setShowAddModal(false)
      setSelectedDate(null)
      setReason('')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveUnavailable = async () => {
    if (!selectedDate) return
    setActionLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const entry = unavailableDates.find(d => 
        format(parseISO(d.date), 'yyyy-MM-dd') === dateStr
      )
      if (entry?.id) {
        await handleRemoveAction?.(entry.id)
      }
      setShowAddModal(false)
      setSelectedDate(null)
      setReason('')
    } finally {
      setActionLoading(false)
    }
  }

  const getDateStatus = (date) => {
    if (!date) return { type: 'empty' }
    
    const dateStr = format(date, 'yyyy-MM-dd')
    const isHoliday = DEFAULT_HOLIDAYS.includes(dateStr)
    const isUnavailable = unavailableSet.has(dateStr)
    const isSundayDay = isSunday(date)
    const isPastDate = isPast(date) && !isToday(date)
    const isCurrentMonth = isSameMonth(date, currentMonth)

    if (isHoliday) {
      return { type: 'holiday', label: HOLIDAY_LABELS[dateStr] || 'Holiday', disabled: true }
    }
    if (isSundayDay) {
      return { type: 'sunday', label: 'Sunday Closed', disabled: true }
    }
    if (isPastDate) {
      return { type: 'past', label: 'Past', disabled: true }
    }
    if (isUnavailable) {
      return { type: 'unavailable', label: 'Unavailable', disabled: false }
    }
    return { type: 'available', label: 'Available', disabled: false }
  }

  if (!isOpen) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[460px] max-h-[92vh] overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-dark)] px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[31px] leading-none font-semibold text-[var(--text-light)] sm:text-[32px]">Unavailable Dates</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Manage dates when appointments cannot be booked
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-2.5 text-[var(--text-muted)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--text-light)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 space-y-5">
            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-[var(--text-muted)]">Available</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="text-[var(--text-muted)]">Unavailable</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-400/10 border border-slate-400/20 px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-[var(--text-muted)]">Holiday</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]/40" />
                <span className="text-[var(--text-muted)]">Sunday</span>
              </div>
            </div>

            {/* Calendar */}
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-primary)] p-4 sm:p-5">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={handlePrevMonth}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--text-light)]"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-semibold text-[var(--text-light)]">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <button
                  onClick={handleNextMonth}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--text-light)]"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-2 text-center text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="h-10" />
                  }

                  const status = getDateStatus(date)
                  const isSelected = selectedDate && isSameDay(date, selectedDate)

                  const cellClasses = isSelected
                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/15'
                    : status.type === 'holiday'
                      ? 'border-slate-400/30 bg-slate-400/10'
                      : status.type === 'sunday'
                        ? 'border-slate-500/25 bg-slate-700/25'
                        : status.type === 'past'
                          ? 'border-slate-600/25 bg-slate-700/20 opacity-70'
                          : status.type === 'unavailable'
                            ? 'border-red-500/30 bg-red-500/10'
                            : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--gold-primary)]'

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => handleDateClick(date)}
                      disabled={status.disabled}
                      className={`h-10 rounded-lg border text-sm font-medium transition-all ${cellClasses} ${
                        status.disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--surface-dark)]'
                      } ${status.type === 'holiday' || status.type === 'sunday' || status.type === 'past' ? 'text-[var(--text-muted)]' : 'text-[var(--text-light)]'}`}
                    >
                      {format(date, 'd')}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Unavailable Dates List */}
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-primary)] p-5">
              <h3 className="mb-4 text-lg font-semibold text-[var(--text-light)]">Marked Unavailable</h3>
              {unavailableDates.length === 0 ? (
                <p className="py-10 text-center text-[var(--text-muted)]">
                  No dates have been marked as unavailable.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {unavailableDates.map((date, index) => {
                    const dateObj = date.date instanceof Date ? date.date : parseISO(date.date)
                    return (
                      <div
                        key={date.id || index}
                        className="flex items-center justify-between p-3 rounded-xl border border-red-500/20 bg-red-500/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-red-400" />
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-light)]">
                              {format(dateObj, 'MMMM d, yyyy')}
                            </p>
                            {date.reason && (
                              <p className="text-sm text-[var(--text-muted)]">{date.reason}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedDate(dateObj)
                            setShowAddModal(true)
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-xl font-semibold text-[var(--text-light)]">
                {unavailableSet.has(format(selectedDate, 'yyyy-MM-dd')) 
                  ? 'Remove Unavailable Date' 
                  : 'Mark Date as Unavailable'}
              </h3>
              <p className="text-[var(--text-muted)] mb-4">
                {format(selectedDate, 'MMMM d, yyyy')}
              </p>

              {!unavailableSet.has(format(selectedDate, 'yyyy-MM-dd')) && (
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Reason (optional)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none"
                    placeholder="e.g., Staff training, Maintenance"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
                >
                  Cancel
                </button>
                {unavailableSet.has(format(selectedDate, 'yyyy-MM-dd')) ? (
                  <button
                    onClick={handleRemoveUnavailable}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={handleAddUnavailable}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black font-medium hover:bg-[var(--gold-primary)]/90 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Mark Unavailable
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
