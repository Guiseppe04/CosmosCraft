import { ModalHeader } from '../shared/ModalHeader'
import { ModalFooter } from '../shared/ModalFooter'
import { FormField } from '../shared/FormField'

export function AppointmentModal({ modal, form, setForm, formErrors, closeModal, isSaving, saveAppointment, labelCls, inputCls }) {
  if (!modal) return null

  return (
    <>
      <ModalHeader title={modal.data ? 'Edit Appointment' : 'Book Appointment'} onClose={closeModal} />
      <div className="space-y-4 mt-6">
        <FormField label="Title *" value={form.title || ''} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="e.g. Guitar Setup Consultation" error={formErrors.title} />
        <FormField label="Customer Name" value={form.customer_name || ''} onChange={(v) => setForm((f) => ({ ...f, customer_name: v }))} />
        <FormField label="Customer Email" value={form.customer_email || ''} onChange={(v) => setForm((f) => ({ ...f, customer_email: v }))} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date *" type="date" value={form.date || form.scheduled_at?.split('T')[0] || ''} onChange={(v) => setForm((f) => ({ ...f, date: v }))} error={formErrors.date} />
          <FormField label="Time" type="time" value={form.time || ''} onChange={(v) => setForm((f) => ({ ...f, time: v }))} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.status || 'pending'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="ready_for_pickup">Ready for Pickup</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <FormField label="Notes" value={form.notes || ''} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} textarea placeholder="Any special requirements or notes..." />
      </div>
      <ModalFooter onCancel={closeModal} onSave={saveAppointment} isSaving={isSaving} />
    </>
  )
}
