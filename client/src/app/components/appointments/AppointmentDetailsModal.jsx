import React, { useMemo } from 'react'
import { format } from 'date-fns'
import { Calendar, Clock3, Mail, MapPin, Phone, UserCircle2, X } from 'lucide-react'

const EMPTY_LABEL = 'N/A'

function parseServices(services) {
  if (!services) return []
  if (Array.isArray(services)) return services
  if (typeof services === 'string') {
    try {
      const parsed = JSON.parse(services)
      return Array.isArray(parsed) ? parsed : []
    } catch (_) {
      return [services]
    }
  }
  return []
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

function formatAmount(value) {
  if (!Number.isFinite(value)) return EMPTY_LABEL
  return `PHP ${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
}

const AppointmentDetailsModal = ({ show, onClose, appointment, onEdit, onCancel, onComplete }) => {
  const services = useMemo(() => parseServices(appointment?.services), [appointment?.services])

  if (!show || !appointment) return null

  const customerName = appointment.customer_name || appointment.user_name || appointment.customerName || 'Guest'
  const customerEmail = appointment.customer_email || appointment.user_email || appointment.customerEmail || ''
  const customerPhone = appointment.customer_phone || appointment.user_phone || appointment.customerPhone || ''
  const customerAddress = appointment.customer_address || appointment.address || ''
  const scheduledAt = appointment.scheduled_at || appointment.date
  const status = String(appointment.status || '').toLowerCase()
  const reference = appointment.referenceNumber || appointment.appointment_id || ''
  const clientType = appointment.user_id ? 'Existing' : 'Guest'

  const serviceRows = services.map((service, index) => ({
    label: getServiceLabel(service, index),
    amount: getServiceAmount(service),
  }))

  const knownAmounts = serviceRows.map((row) => row.amount).filter((value) => Number.isFinite(value))
  const totalAmount = knownAmounts.length > 0
    ? knownAmounts.reduce((sum, value) => sum + value, 0)
    : Number(appointment.total_amount ?? appointment.total ?? NaN)

  const statusClass = status === 'completed'
    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    : status === 'cancelled'
      ? 'text-red-500 bg-red-500/10 border-red-500/20'
      : 'text-amber-500 bg-amber-500/10 border-amber-500/20'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 sm:px-7">
          <h2 className="text-xl font-semibold text-white">
            Appointment Details {reference ? `#${reference}` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-2 text-[var(--text-muted)] transition-colors hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5 sm:px-7 sm:py-6">
          <div className="space-y-5">
            <section>
              <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Client Details</p>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <UserCircle2 className="h-10 w-10 text-[var(--gold-primary)]" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Client Name</p>
                      <p className="text-base font-semibold text-white">{customerName}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    {clientType}
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Notes</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/90">
                    {appointment.notes || EMPTY_LABEL}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Service Breakdown</p>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                <div className="space-y-2">
                  {serviceRows.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">{EMPTY_LABEL}</p>
                  ) : (
                    serviceRows.map((row, idx) => (
                      <div key={`${row.label}-${idx}`} className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-white/90">{row.label}</span>
                        <span className="font-medium text-white">{formatAmount(row.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
                  <span className="text-sm font-medium text-[var(--text-muted)]">Total</span>
                  <span className="text-base font-semibold text-white">{formatAmount(totalAmount)}</span>
                </div>
              </div>
            </section>

            <section>
              <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Contact Details</p>
              <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)]">Phone Number</span>
                  <span className="ml-auto text-white">{customerPhone || EMPTY_LABEL}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)]">Email Address</span>
                  <span className="ml-auto text-white">{customerEmail || EMPTY_LABEL}</span>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)]">Address</span>
                  <span className="ml-auto max-w-[70%] text-right text-white">{customerAddress || EMPTY_LABEL}</span>
                </div>
              </div>
            </section>

            <section>
              <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Booking Information</p>
              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)]">Date</span>
                  <span className="ml-auto text-white">
                    {scheduledAt ? format(new Date(scheduledAt), 'MMMM dd, yyyy') : EMPTY_LABEL}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock3 className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)]">Time</span>
                  <span className="ml-auto text-white">
                    {scheduledAt ? format(new Date(scheduledAt), 'hh:mm a') : EMPTY_LABEL}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Status</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass}`}>
                    {status || 'pending'}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-6 py-4 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-[var(--gold-primary)]/60"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-[var(--gold-primary)]/60"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  )
}

export default AppointmentDetailsModal
