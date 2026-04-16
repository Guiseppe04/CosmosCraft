import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, X } from 'lucide-react'
import { format, setHours, setMinutes } from 'date-fns'

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
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Completed' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Cancelled' },
  approved: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Approved' },
}

function toISODate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
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

function generateTimeSlots(date, startHour = TIME_SLOT_CONFIG.startHour, endHour = TIME_SLOT_CONFIG.endHour, intervalMinutes = TIME_SLOT_CONFIG.intervalMinutes) {
  const slots = []
  const numSlots = ((endHour - startHour) * 60) / intervalMinutes
  
  for (let i = 0; i < numSlots; i++) {
    const minutes = startHour * 60 + i * intervalMinutes
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    const slotTime = setMinutes(setHours(new Date(date), hours), mins)
    const endTime = new Date(slotTime.getTime() + intervalMinutes * 60000)
    
    slots.push({
      id: format(slotTime, 'HH:mm'),
      startTime: slotTime,
      endTime,
      label: format(slotTime, 'hh:mm a'),
      endLabel: format(endTime, 'hh:mm a'),
      hour: hours,
    })
  }
  
  return slots
}

function getAppointmentForSlot(appointments, slotStart) {
  if (!appointments || appointments.length === 0) return null
  
  for (const apt of appointments) {
    if (!apt.scheduled_at) continue
    
    const aptDate = new Date(apt.scheduled_at)
    const aptHour = aptDate.getHours()
    const aptMinutes = aptDate.getMinutes()
    const slotHour = slotStart.getHours()
    const slotMinutes = slotStart.getMinutes()
    
    if (aptHour === slotHour && aptMinutes === slotMinutes) {
      return apt
    }
  }
  
  return null
}

function TimeGrid({ date, appointments = [], onSlotClick, onAppointmentClick, isAdminMode = false }) {
  const timeSlots = useMemo(() => generateTimeSlots(date), [date])
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-[var(--gold-primary)]" />
        <h4 className="text-white font-semibold">Time Slots</h4>
        <span className="text-[var(--text-muted)] text-sm">({TIME_SLOT_CONFIG.startHour}:00 - {TIME_SLOT_CONFIG.endHour}:00)</span>
      </div>
      
      <div className="grid gap-2">
        {timeSlots.map((slot) => {
          const appointment = getAppointmentForSlot(appointments, slot.startTime)
          const isBooked = !!appointment
          const statusConfig = appointment ? STATUS_COLORS[appointment.status] || STATUS_COLORS.pending : null
          
          return (
            <motion.button
              key={slot.id}
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                if (isBooked) {
                  onAppointmentClick?.(appointment)
                } else {
                  onSlotClick?.(slot)
                }
              }}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                isBooked
                  ? `border-[var(--border)] bg-[var(--surface-dark)] hover:border-[var(--gold-primary)]`
                  : 'border-green-500/30 bg-green-500/10 hover:border-green-400 hover:bg-green-500/20 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-white font-medium">{slot.label}</span>
                  <span className="text-[var(--text-muted)] text-sm">- {slot.endLabel}</span>
                </div>
                
                {isBooked && (
                  <div className="flex items-center gap-2">
                    <span className="text-white">{appointment.customer_name || appointment.user?.name || appointment.client_name || 'Guest'}</span>
                    <span className="text-[var(--text-muted)]">•</span>
                    <span className="text-[var(--gold-primary)]">
                      {appointment.service_name || appointment.title || 'Service'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {isBooked ? (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                    {statusConfig.label}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 text-green-400 text-sm">
                    <Plus className="w-4 h-4" />
                    Available
                  </div>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

export default function AppointmentCalendar({ 
  appointments = [], 
  onAppointmentClick, 
  holidays = [], 
  unavailableDates = [], 
  onToggleDate, 
  isAdminMode = false,
  onCreateAppointment,
}) {
  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])

  const holidaySet = useMemo(() => {
    const source = holidays.length ? holidays : DEFAULT_HOLIDAYS
    return new Set(source.map(toISODate).filter(Boolean))
  }, [holidays])

  const unavailableSet = useMemo(() => {
    return new Set(unavailableDates.map(toISODate).filter(Boolean))
  }, [unavailableDates])

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

  const getDateStatus = (dateKey) => {
    const date = parseLocalDateFromISO(dateKey)
    const dayOfWeek = date.getDay()
    const isSunday = dayOfWeek === 0
    const isHoliday = holidaySet.has(dateKey)
    const isPast = date < today
    const isUnavailable = unavailableSet.has(dateKey)
    const isDisabled = isSunday || isHoliday || isPast || (isAdminMode ? false : isUnavailable)
    const status = isHoliday
      ? HOLIDAY_LABELS[dateKey] || 'Holiday'
      : isSunday
        ? 'Sunday Closed'
        : isPast
          ? 'Past'
          : isUnavailable && isAdminMode
            ? 'Marked Unavailable'
            : 'Available'
    return { isSunday, isHoliday, isPast, isDisabled, isUnavailable, status }
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
            className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 text-[var(--text-muted)] uppercase tracking-[0.3em] text-xs">
                  <Calendar className="w-4 h-4" />
                  <span>Calendar</span>
                </div>
                <h2 className="mt-2 text-3xl font-semibold text-white">Available / Booked Dates</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)] max-w-2xl">
                  Booking is enabled Monday through Saturday. Sundays and listed holidays are automatically disabled.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                <p className="text-lg font-semibold text-white">{format(new Date(currentYear, currentMonth, 1), 'MMMM yyyy')}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const prev = new Date(currentYear, currentMonth - 1, 1)
                      setCurrentYear(prev.getFullYear())
                      setCurrentMonth(prev.getMonth())
                    }}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Date(currentYear, currentMonth + 1, 1)
                      setCurrentYear(next.getFullYear())
                      setCurrentMonth(next.getMonth())
                    }}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-sm text-[var(--text-muted)] mb-3 font-semibold tracking-widest">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center py-3">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-3">
              {monthMatrix.map((week, weekIndex) =>
                week.map((day, dayIndex) => {
                  if (!day.inCurrentMonth) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className="h-20 rounded-3xl bg-[var(--surface-dark)]" />
                  }

                  const dateKey = day.id
                  const bookingCount = appointmentsByDate.get(dateKey)?.length || 0
                  const { isSunday, isHoliday, isPast, isDisabled, isUnavailable, status } = getDateStatus(dateKey)
                  const isSelected = dateKey && selectedDateId === dateKey
                  const isHolidayCell = isDisabled && isHoliday
                  const isSundayClosed = isDisabled && isSunday
                  const isPastDate = isDisabled && isPast
                  const isUnavailableCell = isAdminMode && isUnavailable

                  const cellClasses = isSelected
                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/15 text-white shadow-lg shadow-[var(--gold-primary)]/10'
                    : isHolidayCell
                      ? 'border-[#758A93]/30 bg-[#758A93]/10 text-[#c9d2db] cursor-not-allowed'
                      : isSundayClosed || isPastDate
                        ? 'border-[#444] bg-[#121518] text-[#f8fafc] cursor-not-allowed'
                        : isUnavailableCell
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200 cursor-pointer hover:border-amber-400 hover:bg-amber-500/20'
                          : bookingCount
                            ? 'border-red-500/10 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/15'
                            : 'border-[var(--border)] bg-[var(--surface-dark)] text-white hover:border-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'

                  const badgeClasses = isHolidayCell
                    ? 'bg-[#758A93]/15 text-[#c9d2db] border border-[#758A93]/20'
                    : isSundayClosed || isPastDate
                      ? 'bg-[#23272e] text-[#e2e8f0] border border-[#39404c]'
                      : isUnavailableCell
                        ? 'bg-amber-500/15 text-amber-200 border border-amber-500/20'
                        : bookingCount
                          ? 'bg-red-500/15 text-red-200 border border-red-500/20'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'

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
                          <span className="rounded-full bg-[#272a30] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            Past
                          </span>
                        )}
                      </div>

                      <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${badgeClasses}`}>
                        {isUnavailableCell ? 'Unavailable' : isDisabled ? status : bookingCount ? `${bookingCount} booked` : 'Available'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-4 text-sm text-[var(--text-muted)]">
              <div className="flex items-center gap-2 rounded-3xl border border-green-500/20 bg-green-500/10 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Available
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
          </motion.div>
        )}
      </AnimatePresence>

      {!showTimeGrid && (
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

          {selectedDateLabel && selectedAppointments.length === 0 && (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 text-center text-[var(--text-muted)]">
              No appointments are scheduled for the selected date.
            </div>
          )}

          {selectedAppointments.length > 0 && (
            <div className="grid gap-4">
              {selectedAppointments.map((appointment) => {
                const scheduledAt = appointment.scheduled_at ? new Date(appointment.scheduled_at) : null
                const formattedTime = scheduledAt ? format(scheduledAt, 'hh:mm a') : appointment.time || 'TBD'
                const title = appointment.title || appointment.service_name || 'Appointment'
                const customerName = appointment.customer_name || appointment.user?.name || appointment.client_name || 'Guest'
                const requestedService = appointment.service_name || (Array.isArray(appointment.services) ? appointment.services.map((s) => s.replace(/-/g, ' ')).join(', ') : appointment.title || 'Consultation')
                const statusConfig = STATUS_COLORS[appointment.status] || STATUS_COLORS.pending

                return (
                  <motion.button
                    key={appointment.appointment_id || appointment.id || `${selectedDateId}-${formattedTime}-${title}`}
                    type="button"
                    whileHover={{ y: -2 }}
                    className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5 text-left transition-all hover:border-[var(--gold-primary)] hover:bg-[var(--bg-primary)]"
                    onClick={() => onAppointmentClick?.(appointment)}
                    onMouseEnter={() => setHoveredAppointment(appointment.appointment_id || appointment.id)}
                    onMouseLeave={() => setHoveredAppointment(null)}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Scheduled</p>
                        <h4 className="mt-2 text-lg font-semibold text-white">{title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-3xl bg-[var(--border)] px-3 py-2 text-[var(--text-muted)] text-xs uppercase tracking-[0.2em]">
                          {formattedTime}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[var(--text-muted)] text-[11px] uppercase tracking-[0.3em]">Customer</p>
                        <p className="mt-2 text-sm font-semibold text-white">{customerName}</p>
                      </div>
                      <div>
                        <p className="text-[var(--text-muted)] text-[11px] uppercase tracking-[0.3em]">Requested Service</p>
                        <p className="mt-2 text-sm font-semibold text-white capitalize">{requestedService}</p>
                      </div>
                      <div>
                        <p className="text-[var(--text-muted)] text-[11px] uppercase tracking-[0.3em]">Status</p>
                        <p className="mt-2 text-sm font-semibold text-white capitalize">{appointment.status || 'Pending'}</p>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}