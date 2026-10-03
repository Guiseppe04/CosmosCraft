import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, Save } from 'lucide-react'

const OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function PaymentConfirmation({ appointment, current, status, saving, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  const label = value => OPTIONS.find(option => option.value === value)?.label || value.replace(/_/g, ' ')

  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId}
    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation() }}
    onCancel={event => { event.preventDefault(); if (!saving) onCancel() }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onCancel() }}
    className="w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 text-white shadow-2xl backdrop:bg-black/70">
    <h2 id={titleId} className="text-lg font-semibold">Confirm Payment Status Update</h2>
    <p className="mt-3 text-sm text-[var(--text-muted)]">Appointment {appointment.reference_code || appointment.appointment_id || appointment.id}</p>
    <p id={descriptionId} className="mt-3 text-sm">Change payment status from <strong>{label(current)}</strong> to <strong>{label(status)}</strong>?</p>
    {status === 'approved' && <p className="mt-3 text-xs text-[var(--text-muted)]">Confirm that you have reviewed the payment and received the correct amount before approving it.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" autoFocus onClick={onCancel} disabled={saving}
        className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm disabled:opacity-50">Cancel</button>
      <button type="button" onClick={onConfirm} disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-sm font-semibold disabled:opacity-50">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? 'Saving...' : 'Confirm Update'}
      </button>
    </div>
  </dialog>
}

export default function AppointmentPaymentReview({ appointment, onUpdate }) {
  const [status, setStatus] = useState(appointment.payment_status || 'pending')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  useEffect(() => {
    setStatus(appointment.payment_status || 'pending')
    setError('')
    setSaved(false)
    setConfirmOpen(false)
  }, [appointment.appointment_id, appointment.payment_status])

  if (!onUpdate) return null
  if (appointment.status === 'rescheduled_by_customer' || appointment.payment_status === 'refunded') {
    return <p className="mt-3 text-xs text-[var(--text-muted)]">Payment updates are locked for historical or refunded appointments.</p>
  }
  const current = appointment.payment_status || 'pending'
  const options = OPTIONS.some(option => option.value === current)
    ? OPTIONS : [{ value: current, label: current.replace(/_/g, ' ') }, ...OPTIONS]

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await onUpdate(appointment.appointment_id || appointment.id, status)
      setConfirmOpen(false)
      setSaved(true)
    } catch (err) { setError(err.message || 'Failed to update payment status') }
    finally { setSaving(false) }
  }

  return <div className="pt-4 mt-3 border-t border-[var(--border)]">
    <p className="text-sm font-semibold text-white mb-2">Update Payment Status</p>
    <p className="text-xs text-[var(--text-muted)] mb-3">Review the payment details and proof before marking the payment Approved. For cash payments, confirm the amount was received.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex-1 min-w-40 text-xs text-[var(--text-muted)]">Payment status
        <select value={status} disabled={saving || confirmOpen} onChange={event => { setStatus(event.target.value); setSaved(false) }}
          className="block w-full mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-2.5 text-white">
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => { setError(''); setSaved(false); setConfirmOpen(true) }} disabled={saving || confirmOpen || (status === current && !(status === 'approved' && !Number(appointment.approved_payment_amount)))}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-semibold disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Saving...' : 'Save Payment Status'}
      </button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    {saved && <p role="status" className="mt-2 text-xs text-emerald-400">Payment status saved.</p>}
    {confirmOpen && <PaymentConfirmation appointment={appointment} current={current} status={status}
      saving={saving} error={error} onCancel={() => setConfirmOpen(false)} onConfirm={save} />}
  </div>
}
