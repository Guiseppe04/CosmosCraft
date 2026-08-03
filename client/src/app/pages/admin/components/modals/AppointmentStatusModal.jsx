import { CheckCircle, AlertCircle } from 'lucide-react'
import { ModalHeader } from '../shared/ModalHeader'
import { ModalFooter } from '../shared/ModalFooter'

export function AppointmentStatusModal({ modal, form, setForm, closeModal, isSaving, saveAppointment }) {
  if (!modal.data) return null

  const APPOINTMENT_STATUSES = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' },
  ]
  const currentStatus = form.status || modal.data.status || 'pending'

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
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-3">Status</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {APPOINTMENT_STATUSES.map((stat) => {
              const isSelected = currentStatus === stat.value
              return (
                <button
                  type="button"
                  key={stat.value}
                  onClick={() => setForm({ ...form, status: stat.value })}
                  className={`p-4 text-left rounded-xl border flex flex-col gap-1 transition-all ${
                    isSelected
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white'
                      : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/40 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold">{stat.label.split(' (')[0]}</span>
                    {isSelected && <CheckCircle className="w-4 h-4 text-[var(--gold-primary)]" />}
                  </div>
                  <span className={`text-xs ${isSelected ? 'text-[var(--gold-primary)]/80' : 'text-[var(--text-muted)]'}`}>
                    {stat.label.includes('(') ? stat.label.split('(')[1].replace(')', '') : ''}
                  </span>
                </button>
              )
            })}
          </div>
          {currentStatus === 'cancelled' && (
            <p className="mt-4 text-xs flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Warning: This will cancel the customer's appointment.
            </p>
          )}
        </div>
      </div>
      <ModalFooter onCancel={closeModal} onSave={saveAppointment} isSaving={isSaving} saveText="Update Status" />
    </>
  )
}
