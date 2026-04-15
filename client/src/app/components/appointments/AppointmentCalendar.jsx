import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

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
  '2026-01-01': 'New Year’s Day',
  '2026-02-17': 'Chinese New Year',
  '2026-04-02': 'Maundy Thursday',
  '2026-04-03': 'Good Friday',
  '2026-04-04': 'Black Saturday',
  '2026-04-09': 'Araw ng Kagitingan',
  '2026-05-01': 'Labor Day',
  '2026-06-12': 'Independence Day',
  '2026-08-21': 'Ninoy Aquino Day',
  '2026-08-31': 'National Heroes Day',
  '2026-11-01': 'All Saints’ Day',
  '2026-11-02': 'All Souls’ Day',
  '2026-11-30': 'Bonifacio Day',
  '2026-12-08': 'Feast of the Immaculate Conception',
  '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day',
  '2026-12-30': 'Rizal Day',
  '2026-12-31': 'Last Day of the Year',
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

export default function AppointmentCalendar({ appointments = [], onAppointmentClick, holidays = [] }) {
  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])

  const holidaySet = useMemo(() => {
    const source = holidays.length ? holidays : DEFAULT_HOLIDAYS
    return new Set(source.map(toISODate).filter(Boolean))
  }, [holidays])

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

  useEffect(() => {
    if (!selectedDateId && appointments.length > 0) {
      const firstDate = Array.from(appointmentsByDate.keys()).sort()[0]
      if (firstDate) setSelectedDateId(firstDate)
    }
  }, [appointmentsByDate, appointments.length, selectedDateId])

  const monthMatrix = useMemo(() => buildMonthMatrix(currentYear, currentMonth), [currentYear, currentMonth])
  const selectedAppointments = selectedDateId ? appointmentsByDate.get(selectedDateId) || [] : []

  const selectedDateLabel = selectedDateId ? format(parseLocalDateFromISO(selectedDateId), 'MMMM d, yyyy') : null

  const getDateStatus = (dateKey) => {
    const date = parseLocalDateFromISO(dateKey)
    const dayOfWeek = date.getDay()
    const isSunday = dayOfWeek === 0
    const isHoliday = holidaySet.has(dateKey)
    const isPast = date < today
    const isDisabled = isSunday || isHoliday || isPast
    const status = isHoliday
      ? HOLIDAY_LABELS[dateKey] || 'Holiday'
      : isSunday
        ? 'Sunday Closed'
        : isPast
          ? 'Past'
          : 'Available'
    return { isSunday, isHoliday, isPast, isDisabled, status }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[var(--text-muted)] uppercase tracking-[0.3em] text-xs">
              <Calendar className="w-4 h-4" />
              <span>Appointment Calendar</span>
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">Available / Booked Dates</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)] max-w-2xl">
              Booking is enabled Monday through Saturday. Sundays and listed holidays are automatically disabled.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--text-muted)]">Current month</p>
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
              const { isSunday, isHoliday, isPast, isDisabled, status } = getDateStatus(dateKey)
              const isSelected = dateKey && selectedDateId === dateKey
              const isAvailable = !isDisabled && !bookingCount

              const cellClasses = isSelected
                ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/15 text-white shadow-lg shadow-[var(--gold-primary)]/10'
                : isDisabled
                  ? 'border-[#444] bg-[#121518] text-[#f8fafc] cursor-not-allowed'
                  : bookingCount
                    ? 'border-red-500/10 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/15'
                    : 'border-[var(--border)] bg-[var(--surface-dark)] text-white hover:border-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'

              const badgeClasses = isDisabled
                ? 'bg-[#23272e] text-[#e2e8f0] border border-[#39404c]'
                : bookingCount
                  ? 'bg-red-500/15 text-red-200 border border-red-500/20'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => {
                    if (!isDisabled) setSelectedDateId(dateKey)
                  }}
                  disabled={isDisabled}
                  title={status}
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
                    {isDisabled ? status : bookingCount ? `${bookingCount} booked` : 'Available'}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-3 text-sm text-[var(--text-muted)]">
          <div className="flex items-center gap-2 rounded-3xl border border-green-500/20 bg-green-500/10 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Available
          </div>
          <div className="flex items-center gap-2 rounded-3xl border border-red-500/20 bg-red-500/10 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            Booked
          </div>
          <div className="flex items-center gap-2 rounded-3xl border border-orange-500/20 bg-orange-500/10 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
            Holiday / Sunday Closed
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.14)]">
        <div className="flex flex-col gap-1 mb-5">
          <h3 className="text-lg font-semibold text-white">{selectedDateLabel ? `Appointments on ${selectedDateLabel}` : 'Select a day to see details'}</h3>
          <p className="text-sm text-[var(--text-muted)]">
            {selectedDateLabel
              ? selectedAppointments.length > 0
                ? 'Tap an appointment to view details.'
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

              return (
                <motion.button
                  key={appointment.appointment_id || appointment.id || `${selectedDateId}-${formattedTime}-${title}`}
                  type="button"
                  whileHover={{ y: -2 }}
                  className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5 text-left transition-all hover:border-[var(--gold-primary)] hover:bg-[var(--bg-primary)]"
                  onClick={() => onAppointmentClick?.(appointment)}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Scheduled</p>
                      <h4 className="mt-2 text-lg font-semibold text-white">{title}</h4>
                    </div>
                    <span className="rounded-3xl bg-[var(--border)] px-3 py-2 text-[var(--text-muted)] text-xs uppercase tracking-[0.2em]">
                      {formattedTime}
                    </span>
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
    </div>
  )
}
