import AppointmentRefund from './AppointmentRefund'
import React, { useState } from 'react'
import {
  Calendar,
  Clock,
  MapPin,
  Wrench,
  Guitar,
  CreditCard,
  Printer,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency.js'

/**
 * Format payment method for display
 */
export function formatPaymentMethod(method) {
  if (!method) return 'Not Specified'
  const m = String(method).toLowerCase()
  if (m === 'gcash') return 'GCash'
  if (m === 'cash') return 'Cash'
  if (m === 'bank_transfer' || m === 'bank') return 'Bank Transfer'
  if (m === 'e_wallet') return 'E-Wallet'
  if (m === 'e_bank') return 'E-Bank'
  return String(method)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Get payment status badge configuration
 */
export function getPaymentStatusInfo(status) {
  const norm = String(status || 'pending').toLowerCase()
  if (['verified', 'approved', 'paid', 'confirmed'].includes(norm)) {
    return {
      label: '✓ Confirmed',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      isConfirmed: true,
    }
  }
  if (['proof_submitted', 'awaiting_approval', 'for_verification'].includes(norm)) {
    return {
      label: 'Verification Pending',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      isConfirmed: false,
    }
  }
  if (['rejected', 'failed'].includes(norm)) {
    return {
      label: norm === 'rejected' ? 'Rejected' : 'Failed',
      className: 'bg-red-500/10 text-red-400 border-red-500/30',
      isConfirmed: false,
    }
  }
  if (norm === 'refunded') {
    return {
      label: 'Refunded',
      className: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      isConfirmed: false,
    }
  }
  return {
    label: 'Pending',
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    isConfirmed: false,
  }
}

/**
 * Calculate the total amount for an appointment
 */
export function getAppointmentAmount(apt) {
  if (Array.isArray(apt?.service_details) && apt.service_details.length > 0) {
    const sum = apt.service_details.reduce(
      (acc, s) => acc + (Number(s.price) || 0),
      0
    )
    if (sum > 0) return sum
  }
  if (Number.isFinite(Number(apt?.total_amount))) return Number(apt.total_amount)
  if (Number.isFinite(Number(apt?.amount_paid))) return Number(apt.amount_paid)
  if (Number.isFinite(Number(apt?.amount))) return Number(apt.amount)
  if (Number.isFinite(Number(apt?.total))) return Number(apt.total)
  return null
}

/**
 * Format service type
 */
export function formatAppointmentServiceType(type) {
  if (!type) return '—'
  if (type === 'service_home') return 'Home Service'
  if (type === 'service_in_shop') return 'In-store Service'
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * "Guitar reference image:" / "Service reference image : " markers the wizard writes
 * next to the uploaded photo URL. On their own they are not customer notes.
 */
const isReferenceImageLabel = (text) =>
  /^(?:guitar|service)\s+reference\s+image\s*:?\s*$/i.test(String(text || '').trim())

/** Values legacy records use to mean "no notes". */
const isPlaceholderNote = (text) => {
  const normalized = String(text || '').trim().toLowerCase()
  return ['n/a', 'na', 'none', 'nil', 'null', '-', '--', '---', '.', '...'].includes(normalized)
}

/**
 * Extract guitar label from appointment
 */
export function getSelectedGuitarLabel(apt) {
  let details = apt?.guitar_details
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details)
    } catch (_) {
      details = null
    }
  }
  if (!details) return null
  const brand = details.brand || ''
  const model = details.model || ''
  const type = details.type || ''
  if (brand || model) {
    const parts = [brand, model].filter(Boolean)
    return type
      ? `${parts.join(' ')} (${type.charAt(0).toUpperCase() + type.slice(1)})`
      : parts.join(' ')
  }
  if (Array.isArray(details.guitars) && details.guitars.length > 0) {
    const g = details.guitars[0]
    const parts = [g.brand, g.model].filter(Boolean)
    const t = g.type || ''
    if (parts.length > 0) {
      return t
        ? `${parts.join(' ')} (${t.charAt(0).toUpperCase() + t.slice(1)})`
        : parts.join(' ')
    }
  }
  return null
}

/**
 * Customer appointment card with complete details, dedicated payment section,
 * collapsible notes/attachments, and contextual actions (including Print Receipt).
 */
export default function AppointmentCard({
  apt,
  isRescheduling = false,
  rescheduleDate = '',
  rescheduleTime = '',
  setRescheduleDate,
  setRescheduleTime,
  onCancelReschedule,
  onSubmitReschedule,
  onPrintReceipt,
  onCancel,
  onRescheduleNavigate,
}) {
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)

  const apptDate = apt.scheduled_at || apt.date
  const isPast = apptDate && new Date(apptDate) < new Date()
  const isTerminalStatus = ['completed', 'cancelled', 'rejected', 'no_show', 'rescheduled_by_customer'].includes(
    String(apt.status || '').toLowerCase()
  )
  const needsReschedule = isPast && !isTerminalStatus
  const cancellationBlocked = String(apt.status || '').toLowerCase() === 'ready_for_pickup'
    || Boolean(apt.related_pickup_ready)
    || ['approved', 'paid', 'verified', 'confirmed', 'refunded'].includes(String(apt.payment_status || '').toLowerCase())

  const selectedGuitar = getSelectedGuitarLabel(apt)
  const addressLabel = apt.customer_address || apt.address || ''
  const appointmentNotes = apt.notes || ''
  const isCancelledApt = String(apt.status || '').toLowerCase() === 'cancelled'

  // Extract clean cancellation reason
  let cancellationReason = apt.reason || ''
  if (!cancellationReason && appointmentNotes) {
    const cancelMatch = appointmentNotes.match(
      /^\s*(?:Cancelled|Status changed):\s*(.*)$/im
    )
    if (cancelMatch) {
      cancellationReason = cancelMatch[1].trim()
      cancellationReason = cancellationReason
        .replace(/^Cancelled by customer:\s*/i, '')
        .trim()
    }
  }

  // Clean customer notes by stripping cancellation metadata
  const displayNotes = appointmentNotes
    .replace(/^\s*(?:Cancelled|Status changed):[^\n]*\n?/gim, '')
    .trim()

  // Parse notes and reference images
  const textParts = []
  const imageParts = []
  if (displayNotes) {
    const lines = displayNotes.split('\n')
    lines.forEach((line) => {
      const imageMatch = line.match(
        /(https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp|\.bmp)[^\s]*)/i
      )
      if (imageMatch) {
        const before = line.replace(imageMatch[0], '').trim()
        if (before && !isReferenceImageLabel(before)) textParts.push(before)
        imageParts.push(imageMatch[1])
      } else {
        const trimmed = line.trim()
        if (trimmed && !isReferenceImageLabel(trimmed) && !isPlaceholderNote(trimmed)) {
          textParts.push(trimmed)
        }
      }
    })
  }

  // The section is pointless without customer notes or an actual reference photo.
  const hasNotesOrImages = textParts.length > 0 || imageParts.length > 0

  // Payment information
  const paymentInfo = getPaymentStatusInfo(apt.payment_status)
  const isPaymentConfirmedStatus = paymentInfo.isConfirmed
  const appointmentAmount = getAppointmentAmount(apt)
  const paymentMethodLabel = formatPaymentMethod(apt.payment_method)
  const paymentRefNumber =
    apt.payment_reference ||
    apt.reference_no ||
    (apt.payment_proof_url ? 'Proof uploaded' : '—')

  // Status Badge Styling
  const statusLower = String(apt.status || 'pending').toLowerCase()
  const statusBadgeClass =
    statusLower === 'confirmed'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : statusLower === 'in_progress'
      ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
      : statusLower === 'ready_for_pickup'
      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
      : statusLower === 'completed'
      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      : statusLower === 'cancelled'
      ? 'bg-red-500/10 text-red-500 border-red-500/30'
      : statusLower === 'no_show'
      ? 'bg-gray-500/10 text-gray-400 border-gray-500/30'
      : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'

  return (
    <div className="appt-card p-5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl transition-all hover:border-white/20">
      {/* Header: Title, Reference Code, Services, Status */}
      <div className="appt-header flex items-start justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-bold text-white text-base sm:text-lg">
              Appointment
            </h3>
            {apt.reference_code && (
              <span className="text-xs font-mono font-semibold text-[var(--gold-primary)] bg-[var(--gold-primary)]/10 px-2.5 py-0.5 rounded-full border border-[var(--gold-primary)]/20">
                {apt.reference_code}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 capitalize">
            {apt.service_name ||
              (Array.isArray(apt.services)
                ? apt.services.map((s) => String(s).replace(/-/g, ' ')).join(', ')
                : 'Consultation')}
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold capitalize border whitespace-nowrap ${statusBadgeClass}`}
        >
          {apt.status ? apt.status.replace(/_/g, ' ') : 'Pending'}
        </span>
      </div>

      {/* Reschedule Form (Inline) */}
      {isRescheduling ? (
        <div className="mt-4 pt-4 border-t border-[var(--border)] bg-[var(--bg-primary)] p-4 rounded-xl">
          <p className="text-white font-semibold mb-3 text-sm">
            Select New Schedule
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
                New Date
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:border-[var(--gold-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
                New Time
              </label>
              <input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:border-[var(--gold-primary)] outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancelReschedule}
              className="px-3.5 py-1.5 rounded-lg text-[var(--text-muted)] text-xs font-semibold hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmitReschedule(apt.appointment_id || apt.id)}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--gold-primary)] text-black text-xs font-semibold hover:bg-[var(--gold-secondary)] transition"
            >
              Confirm Reschedule
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Appointment Information Grid */}
          <div className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <span className="block text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                Date &amp; Time
              </span>
              <span className="text-white font-medium text-xs sm:text-sm">
                {apptDate ? (
                  <>
                    {new Date(apptDate).toLocaleDateString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {' at '}
                    {apt.time ||
                      new Date(apptDate).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                Branch / Location
              </span>
              <span className="text-white font-medium text-xs sm:text-sm capitalize truncate block">
                {addressLabel ||
                  (apt.location_id
                    ? apt.location_id.replace(/-/g, ' ')
                    : 'Balagtas Main Branch')}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                Service Type
              </span>
              <span className="text-white font-medium text-xs sm:text-sm">
                {formatAppointmentServiceType(apt.appointment_type)}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
                <Guitar className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                Selected Guitar
              </span>
              <span className="text-white font-medium text-xs sm:text-sm truncate block">
                {selectedGuitar || '—'}
              </span>
            </div>
          </div>

          {/* Collapsible Payment Details Section */}
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setIsPaymentOpen((prev) => !prev)}
              className="flex items-center justify-between w-full py-1 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
              aria-expanded={isPaymentOpen}
            >
              <span className="flex items-center gap-2 font-medium flex-wrap">
                <CreditCard className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                <span className="font-semibold text-white/90">Payment Details</span>
                <span className="text-[11px] text-[var(--text-muted)]">•</span>
                <span className="text-[11px] text-white/80">{paymentMethodLabel}</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${paymentInfo.className}`}
                >
                  {paymentInfo.label}
                </span>
                {appointmentAmount !== null && (
                  <span className="font-bold text-[var(--gold-primary)] text-xs ml-1">
                    {formatCurrency(appointmentAmount)}
                  </span>
                )}
              </span>
              {isPaymentOpen ? (
                <ChevronUp className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
              )}
            </button>

            {isPaymentOpen && (
              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border)] text-xs">
                <div>
                  <span className="text-[var(--text-muted)] block mb-0.5">Method</span>
                  <span className="font-semibold text-white">
                    {paymentMethodLabel}
                  </span>
                </div>

                <div>
                  <span className="text-[var(--text-muted)] block mb-0.5">Status</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${paymentInfo.className}`}
                  >
                    {paymentInfo.label}
                  </span>
                </div>

                <div>
                  <span className="text-[var(--text-muted)] block mb-0.5">
                    Amount Paid
                  </span>
                  <span className="font-bold text-[var(--gold-primary)] text-xs sm:text-sm">
                    {appointmentAmount !== null
                      ? formatCurrency(appointmentAmount)
                      : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-[var(--text-muted)] block mb-0.5">
                    Reference No.
                  </span>
                  <span className="font-mono text-white/90 truncate block">
                    {paymentRefNumber}
                  </span>
                  {apt.payment_proof_url && (
                    <a
                      href={apt.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--gold-primary)] hover:underline inline-flex items-center gap-1 mt-0.5"
                    >
                      <span>View Proof</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Customer Notes & Reference Images */}
          {hasNotesOrImages && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsNotesOpen((prev) => !prev)}
                className="flex items-center justify-between w-full py-1 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
                aria-expanded={isNotesOpen}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <ImageIcon className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                  <span>Notes & Reference Details</span>
                  {imageParts.length > 0 && (
                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white">
                      {imageParts.length} photo{imageParts.length > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
                {isNotesOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {isNotesOpen && (
                <div className="mt-2 space-y-2.5 bg-white p-3 rounded-xl border border-[var(--border)]">
                  {textParts.length > 0 && (
                    <p className="text-black text-xs leading-relaxed whitespace-pre-line">
                      {textParts.join('\n')}
                    </p>
                  )}
                  {imageParts.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-black/10">
                      {imageParts.map((url, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-black/10 bg-white p-1.5 overflow-hidden"
                        >
                          <img
                            src={url}
                            alt={`Reference image ${i + 1}`}
                            className="h-28 w-full rounded-md object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cancellation Reason (Clean extraction without metadata) */}
          {isCancelledApt && cancellationReason && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 mt-3">
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-red-400 mb-1">
                Cancellation Reason
              </span>
              <p className="text-xs text-red-300 leading-relaxed">
                {cancellationReason}
              </p>
            </div>
          )}

          {apt.status === 'rescheduled_by_customer' && <p className="mt-3 text-amber-300">Rescheduled by Customer ? historical schedule</p>}
          {['no_show', 'cancelled'].includes(String(apt.status || '').toLowerCase()) && <AppointmentRefund apt={apt} />}
          {/* Past-Due Reschedule Notice */}
          {needsReschedule && (
            <div className="mt-3 flex items-center justify-between bg-orange-500/10 p-3.5 rounded-xl border border-orange-500/20 gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
                <div>
                  <p className="text-orange-400 font-semibold text-xs">
                    Action Required
                  </p>
                  <p className="text-orange-400/80 text-[11px] mt-0.5">
                    This appointment is past due. Please reschedule it.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRescheduleNavigate(apt)}
                className="px-3.5 py-1.5 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition shrink-0"
              >
                Reschedule
              </button>
            </div>
          )}

          {/* Contextual Actions Bar */}
          {(isPaymentConfirmedStatus || (!isTerminalStatus && !needsReschedule)) && (
            <div className="flex flex-wrap items-center justify-end gap-2.5 mt-4 pt-3.5 border-t border-[var(--border)]">
              {isPaymentConfirmedStatus && (
                <button
                  type="button"
                  onClick={() => onPrintReceipt(apt)}
                  className="px-3.5 py-2 rounded-xl border border-[var(--border)] bg-white/5 text-white font-semibold hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-all text-xs inline-flex items-center justify-center gap-2"
                  title="Print official appointment receipt"
                >
                  <Printer className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                  <span>Print Receipt</span>
                </button>
              )}

              {/* A past-due appointment can only be rescheduled, never cancelled. */}
              {!isTerminalStatus && !needsReschedule && !cancellationBlocked && (
                <button
                  type="button"
                  onClick={() => onCancel(apt)}
                  className="px-3.5 py-2 rounded-xl border border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/15 transition-colors text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Appointment</span>
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
