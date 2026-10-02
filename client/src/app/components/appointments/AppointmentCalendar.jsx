import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { addDays, addWeeks, format, startOfWeek, subDays, subMonths, subYears } from 'date-fns'

const DEFAULT_HOLIDAYS = [
  '2026-01-01',
  '2026-02-17',
  '2026-04-02',
  '2026-04-03',
  '2026-04-04',
  '2026-04-09',
  '2026-05-01',
  '2026-06-12',
  '2026-08-21',
  '2026-08-31',
  '2026-11-01',
  '2026-11-02',
  '2026-11-30',
  '2026-12-08',
  '2026-12-24',
  '2026-12-25',
  '2026-12-30',
  '2026-12-31',
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
  '2026-11-01': 'All Saints Day',
  '2026-11-02': 'All Souls Day',
  '2026-11-30': 'Bonifacio Day',
  '2026-12-08': 'Feast of the Immaculate Conception',
  '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day',
  '2026-12-30': 'Rizal Day',
  '2026-12-31': 'Last Day of the Year',
}

const TIME_SLOT_CONFIG = {
  startHour: 9,
  endHour: 18,
  intervalMinutes: 60,
}

const STATUS_COLORS = {
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Pending' },
  confirmed: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Confirmed' },
  in_progress: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', label: 'In Progress' },
  ready_for_pickup: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', label: 'Ready for Pickup' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Completed' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Cancelled' },
  no_show: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', label: 'No Show' },
  approved: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Approved' },
}

function toISODate(value) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return formatLocalISO(date)
}

function parseLocalDateFromISO(dateKey) {
  if (!dateKey) return null
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatLocalISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildMonthMatrix(year, month) {
  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const weeks = []
  let currentDay = 1 - firstWeekday

  while (currentDay <= daysInMonth) {
    const week = []
    for (let i = 0; i < 7; i++, currentDay++) {
      const date = new Date(year, month, currentDay)
      const inCurrentMonth = currentDay >= 1 && currentDay <= daysInMonth
      week.push({
        id: inCurrentMonth ? formatLocalISO(date) : null,
        dayNumber: inCurrentMonth ? date.getDate() : null,
        inCurrentMonth,
      })
    }
    weeks.push(week)
  }

  return weeks
}

function buildTimeSlots() {
  const slots = []

  for (let hour = TIME_SLOT_CONFIG.startHour; hour < TIME_SLOT_CONFIG.endHour; hour++) {
    const slotDate = new Date(2000, 0, 1, hour, 0, 0, 0)
    slots.push(format(slotDate, 'hh:mm a'))
  }

  return slots
}

function getAppointmentSlotLabel(appointment) {
  const scheduledAt = appointment?.scheduled_at ? new Date(appointment.scheduled_at) : null

  if (scheduledAt && !Number.isNaN(scheduledAt.getTime())) {
    return format(scheduledAt, 'hh:mm a')
  }

  return appointment?.time || null
}

function TimeGrid({ date, appointments = [], onSlotClick, onAppointmentClick, isAdminMode = false }) {
  const slotLabels = useMemo(() => buildTimeSlots(), [])

  return (
    <div className="grid gap-3">
      {slotLabels.map((slot) => {
        const bookedAppointment = appointments.find((appointment) => getAppointmentSlotLabel(appointment) === slot)

        if (bookedAppointment) {
          const colors = STATUS_COLORS[bookedAppointment.status] || STATUS_COLORS.pending
          const customerName = bookedAppointment.customer_name || bookedAppointment.user?.name || bookedAppointment.client_name || 'Guest'
          const requestedService = bookedAppointment.service_name
            || (Array.isArray(bookedAppointment.services) ? bookedAppointment.services.map((service) => service.replace(/-/g, ' ')).join(', ') : null)
            || bookedAppointment.title
            || 'Consultation'

          return (
            <button
              key={slot}
              type="button"
              onClick={() => onAppointmentClick?.(bookedAppointment)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition hover:brightness-110 ${colors.bg} ${colors.border}`}
            >
              <div>
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Clock className="w-4 h-4" />
                  <span>{slot}</span>
                </div>
                <div className="mt-2 pl-6">
                  <div className="font-semibold text-white">{customerName}</div>
                  <div className="text-sm text-[var(--text-muted)]">{requestedService}</div>
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${colors.bg} ${colors.text} ${colors.border}`}>
                {colors.label}
              </span>
            </button>
          )
        }

        return (
          <button
            key={slot}
            type="button"
            onClick={() => onSlotClick?.(slot)}
            disabled={!isAdminMode && !onSlotClick}
            className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-4 text-left transition hover:border-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] disabled:cursor-default disabled:hover:border-[var(--border)] disabled:hover:bg-[var(--surface-dark)]"
          >
            <span className="flex items-center gap-2 text-base font-semibold text-white">
              <Clock className="w-4 h-4" />
              {slot}
            </span>
            <span className="rounded-full bg-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
              Available
            </span>
          </button>
        )
      })}
    </div>
  )
}

const WEEK_STATUS_STYLES = {
  pending: 'border-amber-400/60 bg-amber-500/20 text-amber-100',
  confirmed: 'border-sky-400/60 bg-sky-500/20 text-sky-100',
  approved: 'border-sky-400/60 bg-sky-500/20 text-sky-100',
  in_progress: 'border-violet-400/60 bg-violet-500/20 text-violet-100',
  ready_for_pickup: 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100',
  completed: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100',
  cancelled: 'border-rose-400/60 bg-rose-500/20 text-rose-100',
  no_show: 'border-orange-400/60 bg-orange-500/20 text-orange-100',
}

function getAssignedStaff(appointment) {
  return appointment.staff_name
    || appointment.assigned_staff_name
    || appointment.staff?.name
    || appointment.assigned_staff?.name
    || ''
}

function layoutOverlappingAppointments(appointments) {
  const intervals = appointments
    .map((appointment) => {
      const scheduledAt = new Date(appointment.scheduled_at || appointment.date)
      const startMinutes = (scheduledAt.getHours() - 9) * 60 + scheduledAt.getMinutes()
      const requestedDuration = Number(appointment.duration_minutes || appointment.service_duration_minutes || 60)

      if (Number.isNaN(scheduledAt.getTime()) || startMinutes < 0 || startMinutes >= 540) return null

      return {
        appointment,
        startMinutes,
        endMinutes: Math.min(540, startMinutes + Math.max(30, Number.isFinite(requestedDuration) ? requestedDuration : 60)),
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes)

  const layoutGroup = (group) => {
    const laneEnds = []
    group.forEach((entry) => {
      let column = laneEnds.findIndex((endMinutes) => endMinutes <= entry.startMinutes)
      if (column === -1) column = laneEnds.length
      laneEnds[column] = entry.endMinutes
      entry.column = column
    })
    group.forEach((entry) => { entry.columnCount = laneEnds.length })
  }

  let group = []
  let groupEndMinutes = -1
  intervals.forEach((entry) => {
    if (group.length > 0 && entry.startMinutes >= groupEndMinutes) {
      layoutGroup(group)
      group = []
      groupEndMinutes = -1
    }
    group.push(entry)
    groupEndMinutes = Math.max(groupEndMinutes, entry.endMinutes)
  })
  if (group.length > 0) layoutGroup(group)

  return intervals
}

function AdminWeekCalendar({ appointments, unavailableDates = [], onAppointmentClick, onMonthView }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [staffFilter, setStaffFilter] = useState('all')
  const [summaryRange, setSummaryRange] = useState('week')
  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 6 }, (_, index) => addDays(weekStart, index))
  const staffNames = [...new Set(appointments.map(getAssignedStaff).filter(Boolean))].sort()
  const unavailableSet = new Set(unavailableDates.map((entry) => toISODate(entry?.date || entry)).filter(Boolean))
  const now = new Date()
  const summaryStart = {
    week: subDays(now, 6),
    month: subMonths(now, 1),
    year: subYears(now, 1),
  }[summaryRange]
  summaryStart.setHours(0, 0, 0, 0)
  const summaryRangeLabel = { week: 'last 7 days', month: 'last month', year: 'last year' }[summaryRange]
  const recentAppointments = appointments.filter((appointment) => {
    const date = new Date(appointment.scheduled_at || appointment.date)
    return !Number.isNaN(date.getTime()) && date >= summaryStart && date <= now
  })
  const completedCount = recentAppointments.filter((appointment) => appointment.status === 'completed').length
  const noShowCount = recentAppointments.filter((appointment) => appointment.status === 'no_show').length

  const appointmentsForDay = (date) => appointments
    .filter((appointment) => {
      const dateKey = toISODate(appointment.scheduled_at || appointment.date)
      const isMatchingDay = dateKey === formatLocalISO(date)
      const staffName = getAssignedStaff(appointment)
      const isMatchingStaff = staffFilter === 'all' || staffName === staffFilter
      return isMatchingDay && isMatchingStaff
    })
    .sort((left, right) => new Date(left.scheduled_at || left.date) - new Date(right.scheduled_at || right.date))

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-light)]">Appointment schedule</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{format(weekStart, 'MMMM d')} - {format(weekDays[5], 'MMMM d, yyyy')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setWeekOffset(0)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-light)] transition hover:border-[var(--gold-primary)]">Today</button>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
            <button type="button" aria-label="Previous week" onClick={() => setWeekOffset((offset) => offset - 1)} className="p-2.5 text-[var(--text-light)] transition hover:bg-[var(--surface-elevated)]"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Next week" onClick={() => setWeekOffset((offset) => offset + 1)} className="border-l border-[var(--border)] p-2.5 text-[var(--text-light)] transition hover:bg-[var(--surface-elevated)]"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border)] p-1 text-sm">
            <span className="rounded-md bg-[var(--gold-primary)] px-3 py-1.5 font-semibold text-[var(--text-dark)]">Week</span>
            <button type="button" onClick={onMonthView} className="px-3 py-1.5 text-[var(--text-muted)] transition hover:text-[var(--text-light)]">Month</button>
          </div>
        </div>
      </header>

      <div className="border-b border-[var(--border)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[var(--text-muted)]">Appointment insights</span>
          <select aria-label="Summary date range" value={summaryRange} onChange={(event) => setSummaryRange(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-[var(--text-light)]">
            <option value="week">Last 7 days</option>
            <option value="month">Last month</option>
            <option value="year">Last year</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
          <p className="text-xs font-medium text-[var(--text-muted)]">Total appointments · {summaryRangeLabel}</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-light)]">{recentAppointments.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
          <p className="text-xs font-medium text-[var(--text-muted)]">Completed · {summaryRangeLabel}</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
          <p className="text-xs font-medium text-[var(--text-muted)]">No-shows · {summaryRangeLabel}</p>
          <p className="mt-2 text-2xl font-semibold text-amber-200">{noShowCount}</p>
        </div>
        </div>
      </div>

      {staffNames.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[var(--border)] px-4 py-3">
          <select aria-label="Filter by staff" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-[var(--text-light)]">
            <option value="all">All staff</option>
            {staffNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-[64px_repeat(6,minmax(0,1fr))] border-b border-[var(--border)]">
            <div className="border-r border-[var(--border)] p-3 text-[10px] text-[var(--text-muted)]">GMT+8</div>
            {weekDays.map((date) => {
              const dateKey = formatLocalISO(date)
              const isUnavailable = unavailableSet.has(dateKey)
              return (
              <div key={dateKey} className={`border-r border-[var(--border)] px-2 py-3 text-center last:border-r-0 ${isUnavailable ? 'bg-amber-500/10' : dateKey === formatLocalISO(new Date()) ? 'bg-[var(--gold-primary)]/10' : ''}`}>
                <div className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">{format(date, 'EEE')}</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-light)]">{format(date, 'd')}</div>
                {isUnavailable && <span className="mt-1 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">Unavailable</span>}
              </div>
              )
            })}
          </div>
          <div className="grid grid-cols-[64px_repeat(6,minmax(0,1fr))]">
            <div className="relative border-r border-[var(--border)]">
              {Array.from({ length: 9 }, (_, index) => (
                <div key={index} className="h-[72px] border-b border-[var(--border)] px-2 pt-1 text-[10px] text-[var(--text-muted)]">
                  {format(new Date(2000, 0, 1, 9 + index), 'h:mm a')}
                </div>
              ))}
            </div>
            {weekDays.map((date) => {
              const dayAppointments = appointmentsForDay(date)
              const appointmentLayouts = layoutOverlappingAppointments(dayAppointments)
              return (
                <div key={formatLocalISO(date)} className="relative border-r border-[var(--border)] last:border-r-0">
                  {Array.from({ length: 9 }, (_, index) => <div key={index} className={`h-[72px] border-b border-[var(--border)] ${unavailableSet.has(formatLocalISO(date)) ? 'bg-amber-500/[0.04]' : ''}`} />)}
                  {appointmentLayouts.map(({ appointment, startMinutes, endMinutes, column, columnCount }) => {
                    const scheduledAt = new Date(appointment.scheduled_at || appointment.date)
                    const top = (startMinutes / 60) * 72
                    const height = Math.max(38, ((endMinutes - startMinutes) / 60) * 72)
                    const left = (column / columnCount) * 100
                    const width = 100 / columnCount
                    const customerName = appointment.customer_name || appointment.user?.name || appointment.client_name || 'Guest'
                    const serviceName = appointment.service_name
                      || (Array.isArray(appointment.services) ? appointment.services.map((service) => service.replace(/-/g, ' ')).join(', ') : null)
                      || appointment.title
                      || 'Consultation'
                    const statusClass = WEEK_STATUS_STYLES[appointment.status] || WEEK_STATUS_STYLES.pending
                    return (
                      <button
                        key={appointment.id || `${appointment.scheduled_at}-${customerName}`}
                        type="button"
                        onClick={() => onAppointmentClick?.(appointment)}
                        title={`${format(scheduledAt, 'h:mm a')} · ${customerName} · ${serviceName}`}
                        className={`absolute z-10 box-border overflow-hidden rounded-md border-l-2 px-1 py-1 text-left shadow-sm transition hover:z-20 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)] sm:px-2 ${statusClass}`}
                        style={{ top: `${top}px`, height: `${height}px`, left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)` }}
                      >
                        <span className="block truncate text-[10px] font-semibold">{format(scheduledAt, 'h:mm a')} {customerName}</span>
                        <span className="block truncate text-[10px] opacity-80">{serviceName}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function AppointmentCalendar({
  appointments = [],
  onAppointmentClick,
  holidays = [],
  unavailableDates = [],
  availableDates = [],
  isAdminMode = false,
  onCreateAppointment,
  onToggleDate,
}) {
  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])
  const timeSlots = useMemo(() => buildTimeSlots(), [])

  const holidaySet = useMemo(() => {
    const source = holidays.length ? holidays : DEFAULT_HOLIDAYS
    return new Set(source.map(toISODate).filter(Boolean))
  }, [holidays])

const unavailableSet = useMemo(() => {
     return new Set(unavailableDates.map(toISODate).filter(Boolean))
   }, [unavailableDates])

   const availableSet = useMemo(() => {
     return new Set(availableDates.map(toISODate).filter(Boolean))
   }, [availableDates])

   const appointmentsByDate = useMemo(() => {
    const map = new Map()
    appointments.forEach((appointment) => {
      const dateKey = toISODate(appointment.scheduled_at || appointment.date)
      if (!dateKey) return
      const entry = map.get(dateKey) || []
      entry.push(appointment)
      map.set(dateKey, entry)
    })
    return map
  }, [appointments])

  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDateId, setSelectedDateId] = useState('')
  const [showTimeGrid, setShowTimeGrid] = useState(false)
  const [hoveredAppointment, setHoveredAppointment] = useState(null)
  const [adminWeekView, setAdminWeekView] = useState(true)
  const [summaryRange, setSummaryRange] = useState('week')
  const [monthStaffFilter, setMonthStaffFilter] = useState('all')

  const now = new Date()
  const summaryStart = {
    week: subDays(now, 6),
    month: subMonths(now, 1),
    year: subYears(now, 1),
  }[summaryRange]
  summaryStart.setHours(0, 0, 0, 0)
  const summaryRangeLabel = { week: 'last 7 days', month: 'last month', year: 'last year' }[summaryRange]
  const recentAppointments = appointments.filter((appointment) => {
    const date = new Date(appointment.scheduled_at || appointment.date)
    return !Number.isNaN(date.getTime()) && date >= summaryStart && date <= now
  })
  const completedCount = recentAppointments.filter((appointment) => appointment.status === 'completed').length
  const noShowCount = recentAppointments.filter((appointment) => appointment.status === 'no_show').length
  const monthStaffNames = [...new Set(appointments.map(getAssignedStaff).filter(Boolean))].sort()

  useEffect(() => {
    if (!selectedDateId && appointments.length > 0) {
      const firstDate = Array.from(appointmentsByDate.keys()).sort()[0]
      if (firstDate) setSelectedDateId(firstDate)
    }
  }, [appointmentsByDate, appointments.length, selectedDateId])

  const monthMatrix = useMemo(() => buildMonthMatrix(currentYear, currentMonth), [currentYear, currentMonth])
  const selectedAppointments = selectedDateId ? appointmentsByDate.get(selectedDateId) || [] : []
  const selectedDate = selectedDateId ? parseLocalDateFromISO(selectedDateId) : null
  const selectedDateLabel = selectedDateId ? format(selectedDate, 'MMMM d, yyyy') : null

  if (isAdminMode && adminWeekView) {
    return <AdminWeekCalendar appointments={appointments} unavailableDates={unavailableDates} onAppointmentClick={onAppointmentClick} onMonthView={() => setAdminWeekView(false)} />
  }

const getDateStatus = (dateKey) => {
     const date = parseLocalDateFromISO(dateKey)
     const dayOfWeek = date.getDay()
     const isSunday = dayOfWeek === 0
     const isHoliday = holidaySet.has(dateKey)
     const isPast = date < today
     const isUnavailable = unavailableSet.has(dateKey)
     const isAvailable = availableSet.has(dateKey)
     const isDisabled = isSunday || isHoliday || isPast || (isAdminMode ? false : isUnavailable)
     const status = isHoliday
       ? HOLIDAY_LABELS[dateKey] || 'Holiday'
       : isSunday
         ? 'Sunday Closed'
         : isPast
           ? 'Past'
           : isUnavailable
             ? 'Marked Unavailable'
             : isAvailable
               ? 'Has Availability'
               : 'Available'
     return { isSunday, isHoliday, isPast, isDisabled, isUnavailable, isAvailable, status }
   }

  const handleDateSelect = (dateKey, isUnavailableCell) => {
    if (isAdminMode && isUnavailableCell) {
      onToggleDate?.(dateKey)
    } else {
      setSelectedDateId(dateKey)
      setShowTimeGrid(true)
    }
  }

  const handleSlotClick = (slot) => {
    if (isAdminMode || onCreateAppointment) {
      onCreateAppointment?.(slot, selectedDateId)
    }
  }

  const handleBackToMonth = () => {
    setShowTimeGrid(false)
  }

  return (
    <div className="space-y-8">
      <AnimatePresence mode="wait">
        {showTimeGrid && selectedDate ? (
          <motion.div
            key="time-grid"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleBackToMonth}
                  className="p-2 hover:bg-[var(--gold-primary)]/20 rounded-xl transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-[var(--gold-primary)]" />
                </button>
                <div>
                  <div className="flex items-center gap-2 text-[var(--text-muted)] uppercase tracking-[0.3em] text-xs">
                    <Clock className="w-4 h-4" />
                    <span>Day View</span>
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedDateLabel}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400">
                  {selectedAppointments.filter(a => a.status !== 'cancelled').length} booked
                </span>
                <span className="px-3 py-1 rounded-full bg-[var(--surface-dark)] text-[var(--text-muted)]">
                  {TIME_SLOT_CONFIG.endHour - TIME_SLOT_CONFIG.startHour} hours available
                </span>
              </div>
            </div>

            <TimeGrid
              date={selectedDate}
              appointments={selectedAppointments}
              onSlotClick={handleSlotClick}
              onAppointmentClick={onAppointmentClick}
              isAdminMode={isAdminMode}
            />

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[var(--text-muted)]">
              <div className="flex items-center gap-2 rounded-3xl border border-green-500/20 bg-green-500/10 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Available (Click to book)
              </div>
              <div className="flex items-center gap-2 rounded-3xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Pending
              </div>
              <div className="flex items-center gap-2 rounded-3xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                Confirmed
              </div>
              <div className="flex items-center gap-2 rounded-3xl border border-purple-500/20 bg-purple-500/10 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                In Progress
              </div>
              <div className="flex items-center gap-2 rounded-3xl border border-green-500/20 bg-green-500/10 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                Completed
              </div>
              <div className="flex items-center gap-2 rounded-3xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                Cancelled
              </div>
            </div>

            {isAdminMode && (
              <p className="mt-4 text-xs text-[var(--text-muted)] text-center">
                Click on an available time slot to create a new appointment. Click on a booked slot to view or edit details.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="month-view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl"
          >
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-light)]">Appointment schedule</h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{format(new Date(currentYear, currentMonth, 1), 'MMMM yyyy')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const present = new Date()
                    setCurrentYear(present.getFullYear())
                    setCurrentMonth(present.getMonth())
                  }}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-light)] transition hover:border-[var(--gold-primary)]"
                >
                  Today
                </button>
                <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => {
                      const prev = new Date(currentYear, currentMonth - 1, 1)
                      setCurrentYear(prev.getFullYear())
                      setCurrentMonth(prev.getMonth())
                    }}
                    className="p-2.5 text-[var(--text-light)] transition hover:bg-[var(--surface-elevated)]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => {
                      const next = new Date(currentYear, currentMonth + 1, 1)
                      setCurrentYear(next.getFullYear())
                      setCurrentMonth(next.getMonth())
                    }}
                    className="border-l border-[var(--border)] p-2.5 text-[var(--text-light)] transition hover:bg-[var(--surface-elevated)]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {isAdminMode && (
                  <div className="flex overflow-hidden rounded-lg border border-[var(--border)] p-1 text-sm">
                    <button
                      type="button"
                      onClick={() => setAdminWeekView(true)}
                      className="px-3 py-1.5 text-[var(--text-muted)] transition hover:text-[var(--text-light)]"
                    >
                      Week
                    </button>
                    <span className="rounded-md bg-[var(--gold-primary)] px-3 py-1.5 font-semibold text-[var(--text-dark)]">
                      Month
                    </span>
                  </div>
                )}
              </div>
            </header>

            <div className="border-b border-[var(--border)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--text-muted)]">Appointment insights</span>
                <select
                  aria-label="Summary date range"
                  value={summaryRange}
                  onChange={(event) => setSummaryRange(event.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-[var(--text-light)]"
                >
                  <option value="week">Last 7 days</option>
                  <option value="month">Last month</option>
                  <option value="year">Last year</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Total appointments · {summaryRangeLabel}</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-light)]">{recentAppointments.length}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Completed · {summaryRangeLabel}</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-300">{completedCount}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                  <p className="text-xs font-medium text-[var(--text-muted)]">No-shows · {summaryRangeLabel}</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-200">{noShowCount}</p>
                </div>
              </div>
            </div>

            {isAdminMode && monthStaffNames.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[var(--border)] px-4 py-3">
                <select
                  aria-label="Filter appointments by staff"
                  value={monthStaffFilter}
                  onChange={(event) => setMonthStaffFilter(event.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-[var(--text-light)]"
                >
                  <option value="all">All staff</option>
                  {monthStaffNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            )}

            <div className="p-4 sm:p-6">
              <div className="overflow-x-auto">
                <div className={isAdminMode ? 'min-w-[820px]' : undefined}>
              <div className="grid grid-cols-7 gap-2 text-sm text-[var(--text-muted)] mb-3 font-semibold tracking-widest">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center py-3">
                    {day}
                  </div>
                ))}
              </div>

            <div className="grid grid-cols-7 gap-2">
              {monthMatrix.map((week, weekIndex) =>
                week.map((day, dayIndex) => {
                  if (!day.inCurrentMonth) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className={`${isAdminMode ? 'min-h-[132px]' : 'h-20'} rounded-xl bg-[var(--surface-dark)]`} />
                  }

const dateKey = day.id
                   const bookingCount = appointmentsByDate.get(dateKey)?.length || 0
                   const { isSunday, isHoliday, isPast, isDisabled, isUnavailable, isAvailable, status } = getDateStatus(dateKey)
                   const isSelected = dateKey && selectedDateId === dateKey
                   const isHolidayCell = isDisabled && isHoliday
                   const isSundayClosed = isDisabled && isSunday
                   const isPastDate = isDisabled && isPast
                   const isUnavailableCell = isUnavailable
                   const isAvailableCell = isAvailable && !isUnavailable && !isHoliday && !isSunday && !isPast
                   const dayAppointments = (appointmentsByDate.get(dateKey) || [])
                     .filter((appointment) => monthStaffFilter === 'all' || getAssignedStaff(appointment) === monthStaffFilter)
                     .sort((left, right) => new Date(left.scheduled_at || left.date) - new Date(right.scheduled_at || right.date))
                   const displayedBookingCount = isAdminMode ? dayAppointments.length : bookingCount

                    const cellClasses = isSelected
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/15 text-white shadow-lg shadow-[var(--gold-primary)]/10'
                      : isHolidayCell
                        ? 'border-[#758A93]/30 bg-[#758A93]/10 text-[#c9d2db] cursor-not-allowed'
                        : isSundayClosed || isPastDate
                          ? 'border-slate-500/35 bg-slate-700/30 text-slate-100 cursor-not-allowed'
                          : isUnavailableCell
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200 cursor-pointer hover:border-amber-400 hover:bg-amber-500/20'
                            : displayedBookingCount
                              ? 'border-red-500/10 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/15'
                              : isAvailableCell
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 cursor-pointer hover:border-emerald-400 hover:bg-emerald-500/20'
                                : 'border-[var(--border)] bg-[var(--surface-dark)] text-white hover:border-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'

                    const badgeClasses = isHolidayCell
                      ? 'bg-[#758A93]/15 text-[#c9d2db] border border-[#758A93]/20'
                      : isSundayClosed || isPastDate
                        ? 'bg-slate-600/35 text-slate-100 border border-slate-400/35'
                        : isUnavailableCell
                          ? 'bg-amber-500/15 text-amber-200 border border-amber-500/20'
                          : displayedBookingCount
                            ? 'bg-red-500/15 text-red-200 border border-red-500/20'
                            : isAvailableCell
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'

                    if (isAdminMode) {
                      return (
                        <div key={dateKey} className={`min-h-[132px] overflow-hidden rounded-xl border p-2 ${cellClasses}`}>
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => handleDateSelect(dateKey, isUnavailableCell)}
                              title={status}
                              disabled={isSunday || isHoliday}
                              className="rounded-md px-1.5 py-0.5 text-sm font-semibold transition hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)] disabled:cursor-not-allowed"
                            >
                              {day.dayNumber}
                            </button>
                            <span className={`max-w-[75%] truncate rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase ${badgeClasses}`}>
                              {displayedBookingCount ? `${displayedBookingCount} booked` : status}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1">
                            {dayAppointments.slice(0, 3).map((appointment) => {
                              const scheduledAt = new Date(appointment.scheduled_at || appointment.date)
                              const customerName = appointment.customer_name || appointment.user?.name || appointment.client_name || 'Guest'
                              const serviceName = appointment.service_name
                                || (Array.isArray(appointment.services) ? appointment.services.map((service) => service.replace(/-/g, ' ')).join(', ') : null)
                                || appointment.title
                                || 'Consultation'
                              const eventClass = WEEK_STATUS_STYLES[appointment.status] || WEEK_STATUS_STYLES.pending
                              return (
                                <button
                                  key={appointment.appointment_id || appointment.id || `${dateKey}-${scheduledAt.getTime()}-${customerName}`}
                                  type="button"
                                  onClick={() => onAppointmentClick?.(appointment)}
                                  title={`${format(scheduledAt, 'h:mm a')} · ${customerName} · ${serviceName}`}
                                  className={`flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left text-[10px] leading-tight transition hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)] ${eventClass}`}
                                >
                                  <span className="shrink-0 font-semibold">{format(scheduledAt, 'h:mm a')}</span>
                                  <span className="truncate">{customerName}</span>
                                </button>
                              )
                            })}
                            {dayAppointments.length > 3 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDateId(dateKey)
                                  setShowTimeGrid(true)
                                }}
                                className="px-1.5 text-[10px] font-semibold text-[var(--gold-primary)] hover:underline"
                              >
                                +{dayAppointments.length - 3} more
                              </button>
                            )}
                            {dayAppointments.length === 0 && bookingCount > 0 && (
                              <span className="px-1.5 text-[10px] text-[var(--text-muted)]">No matching appointments</span>
                            )}
                          </div>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => handleDateSelect(dateKey, isUnavailableCell)}
                        title={status}
                        disabled={isSunday || isHoliday || (isPast && !isAdminMode && !isUnavailableCell)}
                        className={`flex h-20 flex-col items-center justify-between rounded-3xl border px-3 py-3 text-sm transition-all ${cellClasses}`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-lg font-semibold">{day.dayNumber}</span>
                          {isPast && (
                            <span className="rounded-full border border-slate-400/30 bg-slate-700/35 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-200">
                              Past
                            </span>
                          )}
                        </div>

                        <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClasses}`}>
                          {isUnavailableCell ? 'Unavailable' : isDisabled ? status : bookingCount ? `${bookingCount} booked` : (isAvailableCell ? 'Available' : 'Available')}
                        </span>
                    </button>
                  )
                })
              )}
            </div>
                </div>
              </div>

<div className="mt-6 grid gap-2 sm:grid-cols-5 text-sm text-[var(--text-muted)]">
               <div className="flex items-center gap-2 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                 <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                 Has Availability
               </div>
               <div className="flex items-center gap-2 rounded-3xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                 <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                 Booked
               </div>
               <div className="flex items-center gap-2 rounded-3xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                 <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                 Marked Unavailable
               </div>
               <div className="flex items-center gap-2 rounded-3xl border border-[#758A93]/20 bg-[#758A93]/10 px-3 py-2">
                 <span className="h-2.5 w-2.5 rounded-full bg-[#758A93]" />
                 Holiday / Sunday Closed
               </div>
             </div>
            {isAdminMode && (
              <p className="mt-4 text-xs text-[var(--text-muted)] text-center">
                Click on any available date (Mon-Sat) to view time slots. Click on marked unavailable dates to toggle availability.
              </p>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* {!showTimeGrid && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.14)]">
          <div className="flex flex-col gap-1 mb-5">
            <h3 className="text-lg font-semibold text-white">
              {selectedDateLabel ? `Appointments on ${selectedDateLabel}` : 'Select a day to see details'}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {selectedDateLabel
                ? selectedAppointments.length > 0
                  ? 'Tap an appointment to view details or click the date to see time slots.'
                  : 'No appointments are scheduled for the selected date.'
                : 'Sunday is always disabled. Holidays are automatically marked as not available.'}
            </p>
          </div>

        {selectedDateLabel && (
          <div className="grid gap-2">
            {timeSlots.map((slot) => {
              const booked = selectedAppointments.find(a => {
                return getAppointmentSlotLabel(a) === slot;
              });
              if (booked) {
                const customerName = booked.customer_name || booked.user?.name || booked.client_name || 'Guest';
                const requestedService = booked.service_name || (Array.isArray(booked.services) ? booked.services.map((s) => s.replace(/-/g, ' ')).join(', ') : booked.title || 'Consultation');
                return (
                  <div key={slot} className="flex items-center justify-between rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 mb-1">
                    <div>
                      <span className="font-semibold text-base text-black flex items-center gap-2"><Clock className="inline w-4 h-4" /> {slot}</span>
                      <div className="ml-7">
                        <div className="font-semibold text-black">{customerName}</div>
                        <div className="text-[var(--text-muted)] text-sm">{requestedService}</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-green-200 text-green-800 px-3 py-1 text-xs font-semibold">Booked</span>
                  </div>
                );
              } else {
                return (
                  <div key={slot} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 mb-1">
                    <span className="font-semibold text-base text-white flex items-center gap-2"><Clock className="inline w-4 h-4" /> {slot}</span>
                    <span className="rounded-full bg-[var(--border)] text-[var(--text-muted)] px-3 py-1 text-xs font-semibold">Available</span>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    )} */}
    </div>
  )
}
