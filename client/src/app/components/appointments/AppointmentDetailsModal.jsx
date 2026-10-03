import AppointmentPaymentReview from './AppointmentPaymentReview'
import React, { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import {
  X, Calendar, Clock, Phone, Mail, MapPin, Store, Home,
  CheckCircle, XCircle, AlertCircle, Loader2, Eye, ExternalLink,
  CreditCard, Package, Receipt, Printer, FileText
} from 'lucide-react'
import { formatPaymentMethod } from '../../utils/paymentMethodUtils'
import { getPaymentStatusConfig } from '../../utils/orderPaymentStatus'
import { printAppointmentReceipt, generatePlainTextReceipt } from '../../utils/appointmentReceipt'

const EMPTY_LABEL = 'N/A'

// Status badge styling configurations
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' },
  in_progress: { label: 'In Progress', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/30' },
  ready_for_pickup: { label: 'Ready for Pickup', color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-400 border border-green-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-400 border border-red-500/30' },
  rescheduled_by_customer: { label: 'Rescheduled by Customer', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/30' },
  no_show: { label: 'No Show', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/30' },
}

const SYSTEM_NOTE_PREFIXES = ['Cancelled:', 'Status changed:', 'Rescheduled:', 'Cancelled on', 'Guitar ']

function cleanCustomerNotes(rawNotes) {
  if (!rawNotes) return ''
  const lines = String(rawNotes).split('\n')
  const kept = []
  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    if (/(https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp|\.bmp)[^\s]*)/i.test(trimmed)) return
    const isSystemLine = SYSTEM_NOTE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
    if (isSystemLine) return
    kept.push(trimmed)
  })
  return kept.join('\n')
}

function parseServices(services, fallbackName) {
  if (!services) {
    return fallbackName ? [fallbackName] : []
  }
  if (Array.isArray(services)) {
    const parsed = services
      .map((service) => {
        if (typeof service === 'string') return service
        if (typeof service === 'number') return String(service)
        if (service?.name) return service
        if (service?.service_name) return service
        if (service?.label) return service
        return ''
      })
      .filter(Boolean)

    if (parsed.length > 0) return parsed
    return fallbackName ? [fallbackName] : []
  }
  if (typeof services === 'string') {
    try {
      const parsed = JSON.parse(services)
      return Array.isArray(parsed) ? parseServices(parsed, fallbackName) : [services]
    } catch (_) {
      return [services]
    }
  }
  return fallbackName ? [fallbackName] : []
}

function getServiceLabel(service, index) {
  if (typeof service === 'string') return service.replace(/-/g, ' ')
  if (service?.name) return String(service.name)
  if (service?.label) return String(service.label)
  if (service?.service_name) return String(service.service_name)
  return `Service ${index + 1}`
}

function getServiceAmount(service) {
  const raw = service?.price ?? service?.amount ?? service?.cost ?? null
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : null
}

function formatDuration(startStr, endStr) {
  if (!startStr || !endStr) return null
  const start = new Date(startStr).getTime()
  const end = new Date(endStr).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  const diffMinutes = Math.round((end - start) / (1000 * 60))
  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

function formatGuitarInfo(guitarDetails) {
  if (!guitarDetails) return null
  let details = guitarDetails
  if (typeof details === 'string') {
    try { details = JSON.parse(details); } catch (_) { return null }
  }
  const first = Array.isArray(details?.guitars) ? details.guitars[0] : details
  if (!first) return null
  const brand = first.brand || first.name || ''
  const model = first.model || first.variant || ''
  const parts = [brand, model].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

export default function AppointmentDetailsModal({
  show,
  isOpen,
  onClose,
  appointment,
  onEdit,
  onCancel,
  onComplete,
  onStatusChange,
  onPaymentStatusUpdate,
}) {
  const isVisible = show ?? isOpen
  const [showLightbox, setShowLightbox] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Derived appointment information
  const derived = useMemo(() => {
    if (!appointment) return null

    const reference = appointment.reference_code || appointment.referenceNumber || appointment.appointment_id || ''
    const appointmentType = appointment.appointment_type || 'service_in_shop'
    const isHomeService = appointmentType === 'service_home'

    const status = String(appointment.status || 'pending').toLowerCase()
    const statusConfig = STATUS_CONFIG[status] || {
      label: status.replace(/_/g, ' '),
      color: 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
    }

    const customerName = appointment.customer_name || appointment.user_name || appointment.customerName || 'Guest'
    const customerEmail = appointment.customer_email || appointment.user_email || appointment.customerEmail || ''
    const customerPhone = appointment.customer_phone || appointment.user_phone || appointment.customerPhone || ''
    const isExistingUser = Boolean(appointment.user_id)

    const scheduledAt = appointment.scheduled_at || appointment.date
    const estimatedEndAt = appointment.estimated_end_at
    const duration = formatDuration(scheduledAt, estimatedEndAt)

    // Service Breakdown
    let serviceRows = []
    if (Array.isArray(appointment.service_details) && appointment.service_details.length > 0) {
      serviceRows = appointment.service_details.map((s, idx) => ({
        label: s.name || `Service ${idx + 1}`,
        amount: Number.isFinite(Number(s.price)) ? Number(s.price) : null,
      }))
    } else {
      const parsed = parseServices(
        appointment.services,
        appointment.service_name || (Array.isArray(appointment.service_names) ? appointment.service_names.join(', ') : '')
      )
      serviceRows = parsed.map((service, idx) => ({
        label: getServiceLabel(service, idx),
        amount: getServiceAmount(service),
      }))
    }

    const hasAnyAmounts = serviceRows.some((row) => Number.isFinite(row.amount))
    const totalAmount = hasAnyAmounts
      ? serviceRows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0)
      : (Number.isFinite(Number(appointment.total_amount ?? appointment.total))
          ? Number(appointment.total_amount ?? appointment.total)
          : null)

    const paymentMethod = appointment.payment_method
    const rawPaymentStatus = appointment.payment_status || 'pending'
    const paymentStatusConfig = getPaymentStatusConfig(rawPaymentStatus)
    const paymentProofUrl = appointment.payment_proof_url

    const customerAddress = appointment.customer_address || appointment.address || ''
    const locationId = appointment.location_id
    const guitarInfo = formatGuitarInfo(appointment.guitar_details)
    const cleanedNotes = cleanCustomerNotes(appointment.notes)
    const reason = appointment.reason

    return {
      reference,
      appointmentType,
      isHomeService,
      status,
      statusConfig,
      customerName,
      customerEmail,
      customerPhone,
      isExistingUser,
      scheduledAt,
      estimatedEndAt,
      duration,
      serviceRows,
      totalAmount,
      paymentMethod,
      rawPaymentStatus,
      paymentStatusConfig,
      paymentProofUrl,
      customerAddress,
      locationId,
      guitarInfo,
      cleanedNotes,
      reason,
    }
  }, [appointment])

  // Keyboard navigation: Escape key closes lightbox first, then modal
  useEffect(() => {
    if (!isVisible) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showLightbox) {
          setShowLightbox(false)
        } else {
          onClose?.()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, showLightbox, onClose])

  if (!isVisible || !appointment || !derived) return null

  // Determine primary lifecycle action according to business rules:
  // In-Shop: pending -> confirmed -> in_progress -> ready_for_pickup -> completed
  // Home:    pending -> confirmed -> in_progress -> completed
  let primaryAction = null
  if (derived.status === 'pending') {
    primaryAction = {
      label: 'Confirm Appointment',
      nextStatus: 'confirmed',
      variant: 'primary',
    }
  } else if (derived.status === 'confirmed') {
    primaryAction = {
      label: 'Start Service',
      nextStatus: 'in_progress',
      variant: 'primary',
    }
  } else if (derived.status === 'in_progress') {
    if (derived.isHomeService) {
      primaryAction = {
        label: 'Complete Service',
        nextStatus: 'completed',
        variant: 'success',
      }
    } else {
      primaryAction = {
        label: 'Mark Ready for Pickup',
        nextStatus: 'ready_for_pickup',
        variant: 'primary',
      }
    }
  } else if (derived.status === 'ready_for_pickup') {
    primaryAction = {
      label: 'Complete Appointment',
      nextStatus: 'completed',
      variant: 'success',
    }
  }

  const showCancel = ['pending', 'confirmed', 'in_progress'].includes(derived.status) && Boolean(onCancel || onStatusChange)

  // Action handlers
  const handleStatusAction = async (nextStatus) => {
    try {
      setActionLoading(nextStatus)
      if (onStatusChange) {
        await onStatusChange(nextStatus)
      } else if (nextStatus === 'completed' && onComplete) {
        await onComplete()
      }
    } catch (err) {
      console.error('Failed to update appointment status:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelAction = async () => {
    try {
      setActionLoading('cancelled')
      if (onCancel) {
        await onCancel(cancelReason)
      } else if (onStatusChange) {
        await onStatusChange('cancelled', cancelReason)
      }
      setShowCancelModal(false)
      onClose?.()
    } catch (err) {
      console.error('Failed to cancel appointment:', err)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-2xl my-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 sm:px-7 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Appointment {derived.reference ? `#${derived.reference}` : ''}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {derived.isHomeService ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Home className="w-3 h-3" />
                  Home Service
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Store className="w-3 h-3" />
                  In-Shop Service
                </span>
              )}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${derived.statusConfig.color}`}>
                {derived.statusConfig.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-primary)] transition-colors"
            aria-label="Close appointment details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Clean plain rows, no individual bordered boxes */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 sm:px-7 sm:py-6 space-y-6">
          {/* Client Details */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Client
              </h3>
              <span className="text-xs font-medium text-emerald-400">
                {derived.isExistingUser ? 'Existing Customer' : 'Guest'}
              </span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm py-0.5">
                <span className="text-[var(--text-muted)]">Client Name</span>
                <span className="font-medium text-white">{derived.customerName}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-0.5">
                <span className="text-[var(--text-muted)]">Phone Number</span>
                <span className="font-medium text-white">{derived.customerPhone || EMPTY_LABEL}</span>
              </div>
              <div className="flex items-center justify-between text-sm py-0.5">
                <span className="text-[var(--text-muted)]">Email Address</span>
                <span className="font-medium text-white">{derived.customerEmail || EMPTY_LABEL}</span>
              </div>
              {derived.guitarInfo && (
                <div className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-[var(--text-muted)]">Guitar</span>
                  <span className="font-medium text-white">{derived.guitarInfo}</span>
                </div>
              )}
            </div>
          </section>

          {/* Services Breakdown */}
          <section className="pt-5 border-t border-[var(--border)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Services
            </h3>
            <div className="space-y-2.5">
              {derived.serviceRows.length === 0 ? (
                <div className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-white">Consultation</span>
                  <span className="font-medium text-[var(--text-muted)]">{EMPTY_LABEL}</span>
                </div>
              ) : (
                derived.serviceRows.map((row, idx) => (
                  <div key={`${row.label}-${idx}`} className="flex items-center justify-between text-sm py-0.5">
                    <span className="text-white capitalize">{row.label}</span>
                    <span className="font-medium text-white">
                      {Number.isFinite(row.amount)
                        ? `₱${row.amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
                        : EMPTY_LABEL}
                    </span>
                  </div>
                ))
              )}
              <div className="pt-3 mt-3 border-t border-[var(--border)]/60 flex items-center justify-between text-sm">
                <span className="font-semibold text-white">Total</span>
                <span className="text-base font-bold text-[var(--gold-primary)]">
                  {Number.isFinite(derived.totalAmount)
                    ? `₱${derived.totalAmount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
                    : EMPTY_LABEL}
                </span>
              </div>
            </div>
          </section>

          {/* Schedule */}
          <section className="pt-5 border-t border-[var(--border)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Schedule
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm py-0.5">
                <span className="text-[var(--text-muted)]">Date</span>
                <span className="font-medium text-white">
                  {derived.scheduledAt ? format(new Date(derived.scheduledAt), 'MMMM d, yyyy') : EMPTY_LABEL}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-0.5">
                <span className="text-[var(--text-muted)]">Time</span>
                <span className="font-medium text-white">
                  {derived.scheduledAt ? format(new Date(derived.scheduledAt), 'h:mm a') : EMPTY_LABEL}
                </span>
              </div>
              {derived.estimatedEndAt && (
                <div className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-[var(--text-muted)]">Estimated End</span>
                  <span className="font-medium text-white">
                    {format(new Date(derived.estimatedEndAt), 'h:mm a')}
                  </span>
                </div>
              )}
              {derived.duration && (
                <div className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-[var(--text-muted)]">Estimated Duration</span>
                  <span className="font-medium text-white">{derived.duration}</span>
                </div>
              )}
            </div>
          </section>

          {/* Contact / Service Location */}
          <section className="pt-5 border-t border-[var(--border)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              {derived.isHomeService ? 'Service Location' : 'Location'}
            </h3>
            <div className="space-y-2.5">
              {derived.isHomeService ? (
                <div className="flex items-start justify-between text-sm gap-4 py-0.5">
                  <span className="text-[var(--text-muted)] shrink-0">Service Address</span>
                  <span className="font-medium text-white text-right">
                    {derived.customerAddress || EMPTY_LABEL}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-[var(--text-muted)]">Shop Branch</span>
                  <span className="font-medium text-white capitalize">
                    {derived.locationId || 'Main Workshop'}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Payment */}
          <section className="pt-5 border-t border-[var(--border)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Payment
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm py-0.5">
                <span className="text-[var(--text-muted)]">Payment Method</span>
                <span className="font-medium text-white capitalize">
                  {formatPaymentMethod(derived.paymentMethod)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-0.5">
                <span className="text-[var(--text-muted)]">Payment Status</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${derived.paymentStatusConfig.bgColor} ${derived.paymentStatusConfig.textColor} border ${derived.paymentStatusConfig.borderColor}`}>
                  {derived.paymentStatusConfig.label}
                </span>
              </div>

              {/* Payment Proof Preview */}
              {derived.paymentProofUrl && (
                <div className="pt-3">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Payment Proof
                  </span>
                  <div className="relative rounded-2xl border border-[var(--border)] bg-black/40 p-2 overflow-hidden flex flex-col items-center">
                    <img
                      src={derived.paymentProofUrl}
                      alt="Customer payment proof receipt"
                      onClick={() => setShowLightbox(true)}
                      className="max-h-56 w-full cursor-pointer rounded-xl object-contain hover:opacity-95 transition-opacity"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLightbox(true)}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--gold-primary)] hover:text-[#ffe270] transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Full Image</span>
                    </button>
                  </div>
                </div>
              )}

              <AppointmentPaymentReview appointment={appointment} onUpdate={onPaymentStatusUpdate} />
            </div>
          </section>

          {/* Customer Notes */}
          {(derived.cleanedNotes || appointment?.notes) && (
            <section className="pt-5 border-t border-[var(--border)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                Customer Notes
              </h3>
              <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap bg-[var(--surface-dark)]/50 p-3.5 rounded-xl border border-[var(--border)]/60">
                {derived.cleanedNotes || appointment?.notes}
              </p>
            </section>
          )}

          {/* Reason / Note */}
          {derived.reason && (
            <section className="pt-5 border-t border-[var(--border)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Reason / Note
              </h3>
              <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap bg-[var(--surface-dark)]/50 p-3.5 rounded-xl border border-[var(--border)]/60">
                {derived.reason}
              </p>
            </section>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4 sm:px-7 bg-[var(--surface-dark)] shrink-0">
          <button
            type="button"
            onClick={() => printAppointmentReceipt(appointment)}
            className="px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white font-semibold hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-all text-sm inline-flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4 text-[var(--gold-primary)]" />
            <span>Print Receipt</span>
          </button>

          {showCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              disabled={actionLoading !== null}
              className="px-5 py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/20 transition-all text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {actionLoading === 'cancelled' && <Loader2 className="w-4 h-4 animate-spin" />}
              <XCircle className="w-4 h-4" />
              <span>Cancel / Reject Appointment</span>
            </button>
          )}

          {primaryAction && (
            <button
              type="button"
              onClick={() => handleStatusAction(primaryAction.nextStatus)}
              disabled={actionLoading !== null}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 ${
                primaryAction.variant === 'success'
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400 font-bold shadow-lg shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-bold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]'
              }`}
            >
              {actionLoading === primaryAction.nextStatus && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{primaryAction.label}</span>
            </button>
          )}
        </div>
      </div>

      {/* Cancel / Reject Confirmation Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setShowCancelModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-3xl border border-red-500/30 bg-[var(--bg-primary)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-white mb-2">Cancel / Reject Appointment</h3>
            <p className="text-[var(--text-muted)] text-sm mb-4 leading-relaxed">
              Are you sure you want to cancel or reject this appointment? This action cannot be undone.
            </p>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white placeholder-[var(--text-muted)] focus:border-red-500/50 focus:outline-none resize-none text-sm"
                placeholder="Enter reason for cancellation or rejection..."
              />
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors text-sm font-semibold"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                onClick={handleCancelAction}
                disabled={actionLoading !== null}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 text-sm"
              >
                {actionLoading === 'cancelled' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span>Confirm Cancel / Reject</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Proof Lightbox Modal */}
      {showLightbox && derived.paymentProofUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setShowLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Payment Proof Image Viewer"
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowLightbox(false)}
              aria-label="Close image preview"
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={derived.paymentProofUrl}
              alt="Payment Proof Receipt"
              className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl border border-[var(--border)] bg-black/50"
            />
            <div className="mt-3 flex items-center gap-4">
              <a
                href={derived.paymentProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--gold-primary)] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open original in new tab</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
