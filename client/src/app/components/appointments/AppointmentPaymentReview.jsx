import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { formatPaymentMethod } from '../../utils/paymentMethodUtils'

const OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const STATUS_LABEL = OPTIONS.reduce((labels, option) => ({ ...labels, [option.value]: option.label }), {})

const labelForStatus = (value) => STATUS_LABEL[value] || String(value || '').replace(/_/g, ' ')

function PaymentConfirmation({ appointment, current, status, saving, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  const label = value => labelForStatus(value)

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [paymentDecision, setPaymentDecision] = useState(null)
  useEffect(() => {
    setError('')
    setSaved(false)
    setPaymentDecision(null)
  }, [appointment.appointment_id, appointment.id, appointment.payment_status])

  if (!onUpdate) return null
  if (appointment.status === 'rescheduled_by_customer' || appointment.payment_status === 'refunded') {
    return <p className="mt-3 text-xs text-[var(--text-muted)]">Payment updates are locked for historical or refunded appointments.</p>
  }
  const current = appointment.payment_status || 'pending'
  const isCashPayment = String(appointment.payment_method || '').toLowerCase() === 'cash'

  const decidePayment = async (nextStatus) => {
    if (saving) return
    // Already in that state: nothing to write, except re-approving to backfill a
    // missing approved amount, which the server only accepts as an approval.
    const backfillingAmount = nextStatus === 'approved' && current === 'approved' && !Number(appointment.approved_payment_amount)
    if (nextStatus === current && !backfillingAmount) {
      setPaymentDecision(null)
      return
    }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await onUpdate(appointment.appointment_id || appointment.id, nextStatus)
      setPaymentDecision(null)
      setSaved(true)
    } catch (err) { setError(err.message || 'Failed to update payment status') }
    finally { setSaving(false) }
  }

  const isApproved = current === 'approved'
  const isRejected = current === 'rejected'
  const decisionOpen = Boolean(paymentDecision)
  // Re-approving stays available only to backfill a missing approved amount,
  // which is the one case the server would otherwise reject.
  const canApprove = !isApproved || !Number(appointment.approved_payment_amount)

  return <div className="pt-4 mt-3 border-t border-[var(--border)]">
    <p className="text-sm font-semibold text-white mb-2">{formatPaymentMethod(appointment.payment_method)} Payment</p>
    {!isCashPayment && <p className="text-xs text-[var(--text-muted)] mb-3">Review the payment details and proof before approving the payment.</p>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => { setError(''); setSaved(false); setPaymentDecision('approved') }} disabled={saving || decisionOpen || !canApprove}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold transition hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed">
        {saving && paymentDecision === 'approved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {isApproved ? 'Approved' : 'Approve'}
      </button>
      <button type="button" onClick={() => { setError(''); setSaved(false); setPaymentDecision('rejected') }} disabled={saving || decisionOpen || isRejected}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/40 bg-transparent text-red-400 text-xs font-semibold transition hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed">
        {saving && paymentDecision === 'rejected' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
        {isRejected ? 'Rejected' : 'Reject'}
      </button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    {saved && <p role="status" className="mt-2 text-xs text-emerald-400">Payment status saved.</p>}
    {paymentDecision && <PaymentConfirmation appointment={appointment} current={current} status={paymentDecision}
      saving={saving} error={error} onCancel={() => setPaymentDecision(null)} onConfirm={() => decidePayment(paymentDecision)} />}
  </div>
}
