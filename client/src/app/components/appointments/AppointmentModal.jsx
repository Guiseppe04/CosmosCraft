import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { API } from '../../utils/apiConfig'
import {
  X, Calendar, Clock, User, Mail, Phone, FileText, CreditCard,
  CheckCircle, XCircle, AlertCircle, Loader2, ChevronDown,
  Image, ExternalLink, RotateCcw, Trash2, Save
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

// Status configuration
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  no_show: { label: 'No Show', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', description: 'Awaiting approval or confirmation' },
  { value: 'confirmed', label: 'Confirmed', description: 'Scheduled and locked in' },
  { value: 'completed', label: 'Completed', description: 'Finished successfully' },
  { value: 'cancelled', label: 'Cancelled', description: 'Terminated before occurrence' },
  { value: 'no_show', label: 'No Show', description: 'Participant did not arrive' },
]

const HOLIDAYS = [
  '01-01',
  '04-02',
  '04-03',
  '04-09',
  '05-01',
  '06-12',
  '08-31',
  '11-30',
  '12-25',
  '12-30',
]

const TIME_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
]

function isHoliday(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return HOLIDAYS.includes(`${month}-${day}`)
}

function inferLeadTimeDays(service = {}) {
  if (Number.isFinite(Number(service.lead_time_days))) {
    return Number(service.lead_time_days)
  }
  const description = String(service.description || '').toLowerCase()
  if (!description) return 0
  if (description.includes('same day')) return 0
  const dayRangeMatch = description.match(/(\d+)\s*-\s*(\d+)\s*days?/)
  if (dayRangeMatch) return Number(dayRangeMatch[2]) || 0
  const upToDayMatch = description.match(/up to\s*(\d+)\s*days?/)
  if (upToDayMatch) return Number(upToDayMatch[1]) || 0
  const singleDayMatch = description.match(/(\d+)\s*days?/)
  if (singleDayMatch) return Number(singleDayMatch[1]) || 0
  const weekRangeMatch = description.match(/(\d+)\s*-\s*(\d+)\s*\+?\s*weeks?/)
  if (weekRangeMatch) return (Number(weekRangeMatch[2]) || 0) * 7
  const singleWeekMatch = description.match(/(\d+)\s*\+?\s*weeks?/)
  if (singleWeekMatch) return (Number(singleWeekMatch[1]) || 0) * 7
  return 0
}

function formatLocalDateId(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseTimeLabelTo24(timeLabel = '') {
  const match = String(timeLabel).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2])
  const period = match[3].toUpperCase()
  if (hour === 12) {
    hour = period === 'AM' ? 0 : 12
  } else if (period === 'PM') {
    hour += 12
  }
  return { hour, minute }
}

function isPastTimeSlot(dateId, timeLabel) {
  const parsed = parseTimeLabelTo24(timeLabel)
  if (!parsed || !dateId) return false
  const slotDate = new Date(`${dateId}T${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}:00`)
  return slotDate < new Date()
}

// Image modal for viewing payment proof
function ImageModal({ src, onClose }) {
  if (!src) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-4xl max-h-[90vh] bg-[var(--bg-primary)] rounded-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <img
          src={src}
          alt="Payment Proof"
          className="max-w-full max-h-[85vh] object-contain"
        />
        <div className="p-4 border-t border-[var(--border)]">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[var(--gold-primary)] hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Open in new tab
          </a>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Status badge component
function StatusBadge({ status, config }) {
  const statusConfig = config[status] || { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${statusConfig.color}`}>
      {statusConfig.label}
    </span>
  )
}

// Main AppointmentModal component
export default function AppointmentModal({
  appointment,
  isOpen,
  onClose,
  onStatusChange,
  onReschedule,
  onCancel,
  onDelete,
  loading = false,
}) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [unavailableDates, setUnavailableDates] = useState(new Set())
  const [availableSlots, setAvailableSlots] = useState(new Set())
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotStatus, setSlotStatus] = useState('')
  const [dateError, setDateError] = useState('')
  const [timeError, setTimeError] = useState('')
  const [servicesList, setServicesList] = useState([])

  // Fetch unavailable dates and services on mount
  useEffect(() => {
    let isMounted = true

    const loadUnavailableDates = async () => {
      try {
        const response = await fetch(`${API}/api/appointments/unavailable-dates`, {
          credentials: 'include',
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) return
        const dates = Array.isArray(payload?.data?.unavailable_dates) ? payload.data.unavailable_dates : []
        const nextSet = new Set(
          dates
            .map((entry) => String(entry?.date || '').slice(0, 10))
            .filter(Boolean)
        )
        if (isMounted) setUnavailableDates(nextSet)
      } catch { /* ignore */ }
    }

    const loadServices = async () => {
      try {
        const response = await fetch(`${API}/api/services?is_active=true&limit=100&sort=name&order=asc`, {
          credentials: 'include',
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) return
        setServicesList(Array.isArray(payload.data) ? payload.data : [])
      } catch { /* ignore */ }
    }

    loadUnavailableDates()
    loadServices()
    return () => { isMounted = false }
  }, [])

  const getFirstServiceId = useCallback(() => {
    if (Array.isArray(appointment?.services) && appointment.services.length > 0) {
      return String(appointment.services[0])
    }
    if (typeof appointment?.services === 'string') {
      try {
        const parsed = JSON.parse(appointment.services)
        if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0])
      } catch { /* ignore */ }
    }
    return null
  }, [appointment])

  const getSelectedService = useCallback(() => {
    const serviceId = getFirstServiceId()
    if (!serviceId) return null
    return servicesList.find((s) => String(s.service_id) === serviceId) || null
  }, [servicesList, getFirstServiceId])

  // Fetch available slots when reschedule date changes
  useEffect(() => {
    let isMounted = true

    if (!rescheduleDate) {
      setAvailableSlots(new Set())
      setSlotStatus('')
      return
    }

    const serviceId = getFirstServiceId()
    if (!serviceId) {
      setAvailableSlots(new Set(TIME_SLOTS))
      setSlotStatus('open')
      return
    }

    setSlotsLoading(true)
    const fetchSlots = async () => {
      try {
        const response = await fetch(
          `${API}/api/appointments/services/${serviceId}/availability/slots?date=${rescheduleDate}&slot_duration=60`,
          { credentials: 'include' }
        )
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.message || 'Failed to load slots')

        const backendSlots = Array.isArray(payload?.data?.available_slots) ? payload.data.available_slots : []
        const availabilityStatus = String(payload?.data?.availability_status || (backendSlots.length > 0 ? 'open' : '')).toLowerCase()
        const nextSet = new Set(
          backendSlots
            .map((slot) => {
              if (slot?.formatted_start) return String(slot.formatted_start).toUpperCase()
              if (slot?.start) {
                return new Date(slot.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase()
              }
              return null
            })
            .filter(Boolean)
        )

        if (isMounted) {
          setAvailableSlots(nextSet)
          setSlotStatus(availabilityStatus)
          if (rescheduleTime && (!nextSet.has(rescheduleTime.toUpperCase()) || isPastTimeSlot(rescheduleDate, rescheduleTime))) {
            setRescheduleTime('')
          }
        }
      } catch {
        if (isMounted) {
          setAvailableSlots(new Set(TIME_SLOTS))
          setSlotStatus('')
        }
      } finally {
        if (isMounted) setSlotsLoading(false)
      }
    }

    fetchSlots()
    return () => { isMounted = false }
    }, [rescheduleDate, getFirstServiceId])

  const validateRescheduleDate = useCallback((dateId) => {
    if (!dateId) return 'Please select a date.'

    const selectedDate = new Date(`${dateId}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (selectedDate < today) return 'Cannot reschedule to a past date.'

    const dayOfWeek = selectedDate.getDay()
    if (dayOfWeek === 0) return 'Sundays are closed. Please select a different day.'

    if (isHoliday(selectedDate)) return 'Selected date is a holiday. Please choose another date.'

    if (unavailableDates.has(dateId)) return 'Selected date is unavailable. Please choose another date.'

    const service = getSelectedService()
    if (service) {
      const leadTimeDays = inferLeadTimeDays(service)
      const minDate = new Date(today)
      minDate.setDate(today.getDate() + leadTimeDays)
      if (selectedDate < minDate) {
        return `This service requires at least ${leadTimeDays} day${leadTimeDays > 1 ? 's' : ''} notice. Please select a date on or after ${format(minDate, 'MMMM d, yyyy')}.`
      }
    }

    return ''
  }, [unavailableDates, getSelectedService])

  const canConfirmReschedule = useCallback(() => {
    if (!rescheduleDate || !rescheduleTime) return false
    if (dateError) return false
    if (timeError) return false
    if (slotsLoading) return false
    return true
  }, [rescheduleDate, rescheduleTime, dateError, timeError, slotsLoading])

  // Reset form state when appointment changes
  useEffect(() => {
    if (appointment) {
      const scheduledAt = new Date(appointment.scheduled_at)
      setRescheduleDate(format(scheduledAt, 'yyyy-MM-dd'))
      setRescheduleTime(format(scheduledAt, 'HH:mm'))
      setDateError('')
      setTimeError('')
    }
  }, [appointment])

  if (!isOpen || !appointment) return null

  const handleStatusChange = async (newStatus) => {
    setShowStatusDropdown(false)
    setActionLoading(true)
    try {
      await onStatusChange?.(appointment.appointment_id, newStatus)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) return

    const dateErr = validateRescheduleDate(rescheduleDate)
    if (dateErr) {
      setDateError(dateErr)
      return
    }

    if (isPastTimeSlot(rescheduleDate, rescheduleTime)) {
      setTimeError('This time slot has already passed.')
      return
    }

    if (!availableSlots.has(rescheduleTime.toUpperCase())) {
      setTimeError('Selected time slot is no longer available.')
      return
    }

    setActionLoading(true)
    try {
      const newScheduledAt = `${rescheduleDate}T${rescheduleTime}:00`
      await onReschedule?.(appointment.appointment_id, newScheduledAt)
      setShowRescheduleModal(false)
      setDateError('')
      setTimeError('')
    } catch (err) {
      const message = err?.message || 'Failed to reschedule appointment'
      if (message.includes('fully booked') || message.includes('unavailable') || message.includes('no longer available') || message.includes('Sunday') || message.includes('holiday')) {
        setDateError(message)
      } else {
        setTimeError(message)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)
    try {
      await onCancel?.(appointment.appointment_id, cancelReason)
      setShowCancelModal(false)
      onClose()
    } finally {
      setActionLoading(false)
    }
  }

  const getCustomerName = () => {
    return appointment.user_name || appointment.customer_name || 'Guest'
  }

  const getServicesDisplay = () => {
    if (appointment.service_name) {
      return String(appointment.service_name)
    }

    if (Array.isArray(appointment.service_names) && appointment.service_names.length > 0) {
      return appointment.service_names
        .map((name) => String(name).replace(/-/g, ' '))
        .filter(Boolean)
        .join(', ')
    }

    if (Array.isArray(appointment.services)) {
      return appointment.services
        .map((service) => {
          if (typeof service === 'string') return service.replace(/-/g, ' ')
          if (typeof service === 'number') return String(service)
          if (service?.name) return String(service.name)
          if (service?.service_name) return String(service.service_name)
          return String(service || '')
        })
        .filter(Boolean)
        .join(', ')
    }

    if (typeof appointment.services === 'string') {
      try {
        const parsed = JSON.parse(appointment.services)
        if (Array.isArray(parsed)) {
          return parsed
            .map((service) => {
              if (typeof service === 'string') return service.replace(/-/g, ' ')
              if (typeof service === 'number') return String(service)
              if (service?.name) return String(service.name)
              if (service?.service_name) return String(service.service_name)
              return String(service || '')
            })
            .filter(Boolean)
            .join(', ')
        }
      } catch (err) { /* fall back to raw */ }
    }

    return appointment.services || 'N/A'
  }

  const getAppointmentGuitars = () => {
    let details = appointment.guitar_details
    if (typeof details === 'string') {
      try {
        details = JSON.parse(details)
      } catch {
        details = null
      }
    }

    const fromDetails = []
    if (details && typeof details === 'object') {
      if (Array.isArray(details.guitars) && details.guitars.length > 0) {
        fromDetails.push(...details.guitars)
      } else if (details.brand || details.model || details.type || details.serial || details.notes) {
        fromDetails.push(details)
      }
    }

    // Fallback: parse note lines like "Guitar 1: Fender Stratocaster (Electric)"
    const fromNotes = []
    if (fromDetails.length === 0 && typeof appointment.notes === 'string') {
      const lines = appointment.notes.split('\n')
      lines.forEach((line) => {
        const match = line.match(/^Guitar\s+\d+:\s*(.+?)\s+\(([^)]+)\)\s*$/i)
        if (!match) return
        const descriptor = match[1]?.trim() || ''
        const type = String(match[2] || '').trim().toLowerCase()
        const [brand, ...modelParts] = descriptor.split(' ')
        fromNotes.push({
          brand: brand || '',
          model: modelParts.join(' ') || '',
          type,
          serial: 'N/A',
          notes: '',
        })
      })
    }

    const normalized = (fromDetails.length > 0 ? fromDetails : fromNotes)
      .map((guitar) => ({
        brand: guitar?.brand || guitar?.name || '',
        model: guitar?.model || guitar?.variant || '',
        type: guitar?.type || guitar?.guitar_type || '',
        serial: guitar?.serial || guitar?.serialNumber || 'N/A',
        notes: guitar?.notes || '',
      }))
      .filter((guitar) => guitar.brand || guitar.model || guitar.type || guitar.serial || guitar.notes)

    return normalized
  }

  const appointmentGuitars = getAppointmentGuitars()

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl max-h-[92vh] rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border)] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-white">Appointment Details</h2>
              <p className="text-[var(--text-muted)] text-sm mt-1 font-mono">
                Ref: {appointment.reference_code || appointment.appointment_id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(92vh-92px)]">
          {/* Status Section */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Update Appointment Status</h3>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-white hover:border-[var(--gold-primary)] transition-colors disabled:opacity-50"
                >
                  <StatusBadge status={appointment.status} config={STATUS_CONFIG} />
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
                <AnimatePresence>
                  {showStatusDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full mt-2 left-0 w-48 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl z-20 overflow-hidden"
                    >
                      {STATUS_OPTIONS.map(option => (
                        <button
                          type="button"
                          key={option.value}
                          onClick={() => handleStatusChange(option.value)}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-[var(--surface-dark)] transition-colors ${
                            appointment.status === option.value ? 'bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' : 'text-white'
                          }`}
                        >
                          <div className="font-semibold">{option.label}</div>
                          {option.description && (
                            <div className="text-xs text-[var(--text-muted)]">{option.description}</div>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[var(--gold-primary)]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Date & Time</p>
                  <p className="text-white font-semibold mt-1">
                    {appointment.scheduled_at ? format(parseISO(appointment.scheduled_at), 'MMMM d, yyyy h:mm a') : 'N/A'}
                  </p>
                </div>
              </div>
              {appointment.estimated_end_at && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-[var(--gold-primary)]" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">End Time</p>
                    <p className="text-white font-semibold mt-1">
                      {format(parseISO(appointment.estimated_end_at), 'h:mm a')}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowRescheduleModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reschedule
              </button>
            </div>
          </div>

          {/* Customer Section */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Customer Information</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-[var(--gold-primary)]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Name</p>
                  <p className="text-white font-semibold mt-1">{getCustomerName()}</p>
                </div>
              </div>
              {(appointment.user_email || appointment.customer_email) && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-[var(--gold-primary)]" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Email</p>
                    <p className="text-white font-semibold mt-1">{appointment.user_email || appointment.customer_email}</p>
                  </div>
                </div>
              )}
              {(appointment.user_phone || appointment.customer_phone) && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-[var(--gold-primary)]" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Phone</p>
                    <p className="text-white font-semibold mt-1">{appointment.user_phone || appointment.customer_phone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Service Section */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Requested Service</h3>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[var(--gold-primary)]" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Requested Service</p>
                <p className="text-white font-semibold mt-1 capitalize">{getServicesDisplay()}</p>
              </div>
            </div>
          </div>

          {/* Guitar Section */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Guitar Information</h3>
            {appointmentGuitars.length === 0 ? (
              <p className="text-[var(--text-muted)]">No guitar details provided.</p>
            ) : (
              <div className="space-y-3">
                {appointmentGuitars.map((guitar, index) => (
                  <div
                    key={`${guitar?.brand || 'guitar'}-${guitar?.model || index}-${index}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4"
                  >
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Guitar {index + 1}</p>
                    <p className="mt-1 text-white font-semibold">
                      {(guitar?.brand || 'Unknown Brand')} {(guitar?.model || 'Unknown Model')}
                    </p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <p className="text-[var(--text-muted)]">
                        Type: <span className="text-white">{guitar?.type ? guitar.type.charAt(0).toUpperCase() + guitar.type.slice(1) : 'N/A'}</span>
                      </p>
                      <p className="text-[var(--text-muted)]">
                        Serial: <span className="text-white">{guitar?.serial || guitar?.serialNumber || 'N/A'}</span>
                      </p>
                    </div>
                    {guitar?.notes && (
                      <p className="mt-2 text-sm text-[var(--text-muted)]">
                        Notes: <span className="text-white">{guitar.notes}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reason Section */}
          {appointment.reason && (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Reason</h3>
              <p className="text-[var(--text-muted)] whitespace-pre-wrap">{appointment.reason}</p>
            </div>
          )}

          {/* Notes Section - customer-submitted only */}
          {appointment.notes && (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Notes</h3>
              <div className="space-y-3">
                {(() => {
                  const lines = appointment.notes.split('\n')
                  const textParts = []
                  const imageParts = []
                  
                  const SYSTEM_NOTE_PREFIXES = ['Cancelled:', 'Status changed:', 'Rescheduled:', 'Cancelled on', 'Guitar ']
                  lines.forEach(line => {
                    const imageMatch = line.match(/(https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp|\.bmp)[^\s]*)/i)
                    if (imageMatch) {
                      const before = line.replace(imageMatch[0], '').trim()
                      if (before) textParts.push(before)
                      imageParts.push(imageMatch[1])
                    } else {
                      const trimmed = line.trim()
                      const isSystemLine = SYSTEM_NOTE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
                      if (isSystemLine || !trimmed) return
                      textParts.push(line)
                    }
                  })
                  
                  return (
                    <>
                      {textParts.filter(Boolean).length > 0 && (
                        <p className="text-[var(--text-muted)] whitespace-pre-wrap">{textParts.filter(Boolean).join('\n')}</p>
                      )}
                      {imageParts.map((url, i) => (
                        <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-2">
                          <img
                            src={url}
                            alt={`Reference image ${i + 1}`}
                            className="h-48 w-full rounded-lg object-cover"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                          <div className="mt-2 flex justify-end">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[var(--gold-primary)] hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open full size
                            </a>
                          </div>
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Payment Section */}
          {(appointment.payment_method || appointment.payment_proof_url) && (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Payment</h3>
              <div className="space-y-4">
                {appointment.payment_method && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--gold-primary)]/20 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-[var(--gold-primary)]" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Payment Method</p>
                      <p className="text-white font-semibold mt-1 capitalize">{appointment.payment_method}</p>
                    </div>
                  </div>
                )}
                {appointment.payment_proof_url && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Payment Proof</p>
                    <button
                      type="button"
                      onClick={() => setShowImageModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
                    >
                      <Image className="w-4 h-4" />
                      View Proof
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions Section */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel Appointment
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      </motion.div>

       {/* Reschedule Modal */}
       <AnimatePresence>
         {showRescheduleModal && (
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
             onClick={() => setShowRescheduleModal(false)}
           >
             <motion.div
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-6"
               onClick={(e) => e.stopPropagation()}
             >
               <h3 className="text-xl font-semibold text-white mb-4">Reschedule Appointment</h3>
               <div className="space-y-4">
                 <div>
                   <label className="block text-sm text-[var(--text-muted)] mb-2">Date</label>
                   <input
                     type="date"
                     value={rescheduleDate}
                     onChange={(e) => {
                       const value = e.target.value
                       setRescheduleDate(value)
                       setRescheduleTime('')
                       setDateError(validateRescheduleDate(value))
                       setTimeError('')
                     }}
                     className={`w-full px-4 py-3 rounded-xl border bg-[var(--surface-dark)] text-white focus:outline-none ${
                       dateError ? 'border-red-500/50 focus:border-red-500' : 'border-[var(--border)] focus:border-[var(--gold-primary)]'
                     }`}
                   />
                   {dateError && (
                     <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                       <AlertCircle className="w-3 h-3" />
                       {dateError}
                     </p>
                   )}
                 </div>
                 <div>
                   <label className="block text-sm text-[var(--text-muted)] mb-2">Time</label>
                   {slotsLoading ? (
                     <div className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] flex items-center gap-2">
                       <Loader2 className="w-4 h-4 animate-spin" />
                       Loading available slots...
                     </div>
                   ) : availableSlots.size === 0 && rescheduleDate ? (
                     <div className="w-full px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                       No available slots for this date. It may be fully booked or unavailable.
                     </div>
                   ) : (
                     <select
                       value={rescheduleTime}
                       onChange={(e) => {
                         const value = e.target.value
                         setRescheduleTime(value)
                         if (value && isPastTimeSlot(rescheduleDate, value)) {
                           setTimeError('This time slot has already passed.')
                         } else {
                           setTimeError('')
                         }
                       }}
                       className={`w-full px-4 py-3 rounded-xl border bg-[var(--surface-dark)] text-white focus:outline-none ${
                         timeError ? 'border-red-500/50 focus:border-red-500' : 'border-[var(--border)] focus:border-[var(--gold-primary)]'
                       }`}
                     >
                       <option value="">Select a time slot</option>
                       {TIME_SLOTS.map((slot) => {
                         const isAvailable = availableSlots.has(slot.toUpperCase())
                         const isPast = isPastTimeSlot(rescheduleDate, slot)
                         const isDisabled = !isAvailable || isPast
                         return (
                           <option
                             key={slot}
                                             value={slot}
                                             disabled={isDisabled}
                                           >
                                             {slot} {isAvailable ? '' : '(Unavailable)'}
                                           </option>
                         )
                       })}
                     </select>
                   )}
                    {timeError && (
                      <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {timeError}
                      </p>
                    )}
                 </div>
               </div>
               <div className="flex justify-end gap-3 mt-6">
                 <button
                   type="button"
                   onClick={() => setShowRescheduleModal(false)}
                   className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
                 >
                   Cancel
                 </button>
                 <button
                   type="button"
                   onClick={handleReschedule}
                   disabled={actionLoading || !canConfirmReschedule()}
                   className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black font-medium hover:bg-[var(--gold-primary)]/90 transition-colors disabled:opacity-50"
                 >
                   {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                   Save Changes
                 </button>
               </div>
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-red-500/30 bg-[var(--bg-primary)] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-white mb-2">Cancel Appointment</h3>
              <p className="text-[var(--text-muted)] mb-4">
                Are you sure you want to cancel this appointment? This action cannot be undone.
              </p>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Reason (optional)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none resize-none"
                  placeholder="Enter reason for cancellation..."
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Cancel Appointment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Modal */}
      {showImageModal && appointment.payment_proof_url && (
        <ImageModal
          src={appointment.payment_proof_url}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </>
  )
}
