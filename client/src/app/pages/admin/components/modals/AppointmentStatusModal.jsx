import { CheckCircle, AlertCircle } from 'lucide-react'
import { ModalHeader } from '../shared/ModalHeader'
import { ModalFooter } from '../shared/ModalFooter'

/** Maps each current status → allowed next statuses (type-aware) */
function getAllowedNextStatuses(currentStatus, appointmentType) {
  const isInShop = appointmentType === 'service_in_shop'
  const isHome = appointmentType === 'service_home'

  const transitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled', 'no_show'],
    in_progress: isHome
      ? ['completed', 'cancelled']
      : ['ready_for_pickup', 'cancelled'],
    ready_for_pickup: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    no_show: [],
  }

  return transitions[currentStatus] || []
}

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

export function AppointmentStatusModal({ modal, form, setForm, closeModal, isSaving, saveAppointment }) {
  if (!modal.data) return null

  const currentStatus = modal.data.status || 'pending'
  const appointmentType = modal.data.appointment_type || 'service_in_shop'
  const selectedStatus = form.status || currentStatus

  // The selected value must be either the current status (no-op shown) or an allowed transition
  const allowedNext = getAllowedNextStatuses(currentStatus, appointmentType)
  // Show current status as pre-selected (greyed out) + all valid next statuses
  const displayStatuses = Array.from(new Set([currentStatus, ...allowedNext]))

  return (
    <>
      <ModalHeader title="Update Appointment Status" onClose={closeModal} />
      <div className="mt-6 space-y-6">
        <div className="p-4 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl">
          <p className="text-white text-lg font-bold mb-1">
            {Array.isArray(modal.data?.guitar_details?.guitars) && modal.data.guitar_details.guitars.length > 0
              ? `${modal.data.guitar_details.guitars[0]?.brand || ''} ${modal.data.guitar_details.guitars[0]?.model || ''}`.trim()
              : (modal.data.guitar_details ? `${modal.data.guitar_details.brand} ${modal.data.guitar_details.model}` : (modal.data.title || modal.data.service_name || 'Appointment'))}
          </p>
          <p className="text-[var(--text-muted)] text-sm">Customer: <span className="font-medium text-white">{modal.data.customer_name || modal.data.user_name || '—'}</span></p>
          <p className="text-[var(--text-muted)] text-sm">Date: <span className="font-medium text-white">{modal.data.scheduled_at ? new Date(modal.data.scheduled_at).toLocaleDateString() : '—'}</span></p>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Type: <span className="font-medium text-white capitalize">{(modal.data.appointment_type || 'service_in_shop').replace(/_/g, ' ')}</span>
          </p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-3">Status</label>

          {allowedNext.length === 0 ? (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)] text-sm">
              This appointment is in a terminal state (<span className="font-semibold text-white capitalize">{currentStatus.replace(/_/g, ' ')}</span>) and cannot be transitioned further.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayStatuses.map((statusValue) => {
                const isCurrentStatus = statusValue === currentStatus
                const isSelected = selectedStatus === statusValue
                const isDisabled = isCurrentStatus && allowedNext.length > 0
                return (
                  <button
                    type="button"
                    key={statusValue}
                    disabled={isDisabled}
                    onClick={() => !isDisabled && setForm({ ...form, status: statusValue })}
                    className={`p-4 text-left rounded-xl border flex flex-col gap-1 transition-all ${
                      isSelected && !isCurrentStatus
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white'
                        : isCurrentStatus
                          ? 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] opacity-60 cursor-default'
                          : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/40 hover:text-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold">
                        {STATUS_LABELS[statusValue] || statusValue}
                        {isCurrentStatus && <span className="ml-2 text-xs opacity-60">(current)</span>}
                      </span>
                      {isSelected && !isCurrentStatus && <CheckCircle className="w-4 h-4 text-[var(--gold-primary)]" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {selectedStatus === 'cancelled' && selectedStatus !== currentStatus && (
            <p className="mt-4 text-xs flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Warning: This will cancel the customer's appointment.
            </p>
          )}
        </div>
      </div>
      <ModalFooter
        onCancel={closeModal}
        onSave={saveAppointment}
        isSaving={isSaving}
        saveText="Update Status"
        disabled={selectedStatus === currentStatus || allowedNext.length === 0}
      />
    </>
  )
}
