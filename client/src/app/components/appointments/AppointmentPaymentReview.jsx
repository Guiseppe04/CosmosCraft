import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'

const OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export default function AppointmentPaymentReview({ appointment, onUpdate }) {
  const [status, setStatus] = useState(appointment.payment_status || 'pending')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setStatus(appointment.payment_status || 'pending')
    setError('')
    setSaved(false)
  }, [appointment.appointment_id, appointment.payment_status])

  if (!onUpdate) return null
  if (appointment.status === 'rescheduled_by_customer' || appointment.payment_status === 'refunded') {
    return <p className="mt-3 text-xs text-[var(--text-muted)]">Payment updates are locked for historical or refunded appointments.</p>
  }
  const current = appointment.payment_status || 'pending'
  const options = OPTIONS.some(option => option.value === current)
    ? OPTIONS : [{ value: current, label: current.replace(/_/g, ' ') }, ...OPTIONS]

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await onUpdate(appointment.appointment_id || appointment.id, status)
      setSaved(true)
    } catch (err) { setError(err.message || 'Failed to update payment status') }
    finally { setSaving(false) }
  }

  return <div className="pt-4 mt-3 border-t border-[var(--border)]">
    <p className="text-sm font-semibold text-white mb-2">Update Payment Status</p>
    <p className="text-xs text-[var(--text-muted)] mb-3">Review the payment details and proof before marking the payment Approved. For cash payments, confirm the amount was received.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex-1 min-w-40 text-xs text-[var(--text-muted)]">Payment status
        <select value={status} disabled={saving} onChange={event => { setStatus(event.target.value); setSaved(false) }}
          className="block w-full mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-2.5 text-white">
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button type="button" onClick={save} disabled={saving || (status === current && !(status === 'approved' && !Number(appointment.approved_payment_amount)))}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-semibold disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Saving...' : 'Save Payment Status'}
      </button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    {saved && <p role="status" className="mt-2 text-xs text-emerald-400">Payment status saved.</p>}
  </div>
}
