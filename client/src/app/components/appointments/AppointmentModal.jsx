import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X, Calendar, Clock, User, Mail, Phone, FileText, CreditCard,
  CheckCircle, XCircle, AlertCircle, Loader2, ChevronDown,
  Image, ExternalLink, RotateCcw, Trash2, Save
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

// Status configuration
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Approved', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  in_progress: { label: 'In Progress', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const PAYMENT_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  paid: { label: 'Paid', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  failed: { label: 'Failed', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'awaiting_approval', label: 'Awaiting Approval' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
]

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
  onPaymentStatusChange,
  onReschedule,
  onCancel,
  onDelete,
  loading = false,
}) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Reset form state when appointment changes
  useEffect(() => {
    if (appointment) {
      const scheduledAt = new Date(appointment.scheduled_at)
      setRescheduleDate(format(scheduledAt, 'yyyy-MM-dd'))
      setRescheduleTime(format(scheduledAt, 'HH:mm'))
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

  const handlePaymentStatusChange = async (newStatus) => {
    setShowPaymentDropdown(false)
    setActionLoading(true)
    try {
      await onPaymentStatusChange?.(appointment.appointment_id, newStatus)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) return
    setActionLoading(true)
    try {
      const newScheduledAt = `${rescheduleDate}T${rescheduleTime}:00`
      await onReschedule?.(appointment.appointment_id, newScheduledAt)
      setShowRescheduleModal(false)
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
    if (!appointment.services) return 'N/A'
    if (Array.isArray(appointment.services)) {
      return appointment.services.map(s => s.replace(/-/g, ' ')).join(', ')
    }
    return appointment.services
  }

  const getAppointmentGuitars = () => {
    const details = appointment.guitar_details
    if (!details) return []

    if (Array.isArray(details?.guitars) && details.guitars.length > 0) {
      return details.guitars
    }

    if (details.brand || details.model || details.type || details.serial) {
      return [details]
    }

    return []
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
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-[var(--bg-primary)] border-l border-[var(--border)] shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Appointment Details</h2>
              <p className="text-[var(--text-muted)] text-sm mt-1">
                ID: {appointment.appointment_id?.slice(0, 8)}...
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
        <div className="p-6 space-y-6">
          {/* Status Section */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Status</h3>
            <div className="flex flex-wrap gap-3">
              {/* Appointment Status */}
              <div className="relative">
                <button
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
                          key={option.value}
                          onClick={() => handleStatusChange(option.value)}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-[var(--surface-dark)] transition-colors ${
                            appointment.status === option.value ? 'bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' : 'text-white'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Payment Status */}
              {appointment.payment_status && (
                <div className="relative">
                  <button
                    onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-white hover:border-[var(--gold-primary)] transition-colors disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4 text-[var(--text-muted)]" />
                    <StatusBadge status={appointment.payment_status} config={PAYMENT_STATUS_CONFIG} />
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                  <AnimatePresence>
                    {showPaymentDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full mt-2 left-0 w-56 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl z-20 overflow-hidden"
                      >
                        {PAYMENT_STATUS_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            onClick={() => handlePaymentStatusChange(option.value)}
                            className={`w-full px-4 py-3 text-left text-sm hover:bg-[var(--surface-dark)] transition-colors ${
                              appointment.payment_status === option.value ? 'bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' : 'text-white'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
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
            <h3 className="text-lg font-semibold text-white mb-4">Service</h3>
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
                        Type: <span className="text-white capitalize">{guitar?.type || 'N/A'}</span>
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

          {/* Notes Section */}
          {appointment.notes && (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Notes</h3>
              <p className="text-[var(--text-muted)] whitespace-pre-wrap">{appointment.notes}</p>
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
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Time</label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={actionLoading || !rescheduleDate || !rescheduleTime}
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
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
                >
                  Keep Appointment
                </button>
                <button
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
