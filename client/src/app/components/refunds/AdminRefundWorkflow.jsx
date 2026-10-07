import { useState } from 'react'
import RefundProgress from './RefundProgress'
import RefundImageInput from './RefundImageInput'
import PrivateRefundFile from './PrivateRefundFile'
import { adminApi } from '../../utils/adminApi'
import { formatCurrency } from '../../utils/formatCurrency'
import { refundMethodLabel } from '../../utils/refundWorkflow'

export default function AdminRefundWorkflow({ refund, onUpdated }) {
  const [notes, setNotes] = useState(refund.admin_notes || '')
  const [amount, setAmount] = useState(refund.approved_amount ?? refund.amount_requested ?? '')
  const [reference, setReference] = useState(''), [proof, setProof] = useState(undefined)
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [error, setError] = useState('')
  const destination = refund.payment_destination
  const next = { pending: ['under_review'], under_review: ['approved','rejected'], approved: ['processing'], processing: ['refund_sent'], refund_sent: ['completed'] }[refund.status] || []
  const labels = { under_review: 'Start review', approved: 'Approve refund', rejected: 'Reject refund', processing: 'Start payment processing', refund_sent: 'Mark refund sent', completed: 'Mark completed' }
  async function update(status) {
    setBusy(true); setError('')
    try {
      await adminApi.updateRefundStatus(refund.refund_request_id, status, { adminNotes: notes,
        ...(status === 'approved' ? { approvedAmount: Number(amount) } : {}),
        ...(status === 'refund_sent' ? { proofImage: proof, refundReference: reference } : {}) })
      await onUpdated?.()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <section aria-label="Admin refund review" className="space-y-4 rounded-xl border border-[var(--border)] p-4">
    <RefundProgress status={refund.status} />
    <h3 className="font-semibold text-[var(--text-light)]">Customer refund request information</h3>
    <dl className="grid grid-cols-1 gap-3 text-sm text-[var(--text-muted)] sm:grid-cols-2">
      <div><dt>Customer</dt><dd>{refund.first_name} {refund.last_name}</dd></div>
      <div><dt>Order / transaction</dt><dd className="break-all">{refund.order_number || refund.order_id}</dd></div>
      <div><dt>Requested amount</dt><dd>{formatCurrency(refund.amount_requested)}</dd></div>
      <div><dt>Request date</dt><dd>{new Date(refund.created_at).toLocaleString('en-PH')}</dd></div>
      <div><dt>Reason</dt><dd className="whitespace-pre-wrap break-words">{refund.reason}</dd></div>
      <div><dt>Preferred refund method</dt><dd>{refundMethodLabel(refund.preferred_method)}</dd></div>
      {destination && <>
        <div><dt>Wallet / bank</dt><dd>{destination.provider || 'Provided via QR code'}</dd></div>
        <div><dt>Account name</dt><dd className="break-words">{destination.accountName || 'Provided via QR code'}</dd></div>
        <div><dt>Account / mobile number</dt><dd className="break-all">{destination.accountNumber || 'Provided via QR code'}</dd></div>
        {destination.details && <div><dt>Other payment details</dt><dd className="whitespace-pre-wrap break-words">{destination.details}</dd></div>}
      </>}
    </dl>
    {destination && refund.has_qr && <PrivateRefundFile refundId={refund.refund_request_id} kind="qr" label="Customer E-Wallet QR code" />}
    {!destination && <p className="text-sm text-[var(--text-muted)]">Only authorized admins can view payment details and manage this refund.</p>}
    {refund.has_proof && <div className="space-y-3 border-t border-[var(--border)] pt-4">
      <h3 className="font-semibold text-[var(--text-light)]">Admin payment confirmation</h3>
      <p className="text-sm text-[var(--text-muted)]">{formatCurrency(refund.refunded_amount)} · {refundMethodLabel(refund.preferred_method)} · {new Date(refund.refund_sent_at).toLocaleString('en-PH')}</p>
      <p className="break-all text-sm text-[var(--text-muted)]">Reference: {refund.refund_reference || 'Not provided'}</p>
      {destination && <PrivateRefundFile refundId={refund.refund_request_id} kind="proof" label="Proof of refund payment" />}
    </div>}
    {destination && next.length > 0 && <fieldset disabled={busy || reading} className="space-y-4">
      <label className="block text-sm text-[var(--text-light)]">Notes to customer / rejection reason
        <textarea rows={3} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3" />
      </label>
      {refund.status === 'under_review' && <label className="block text-sm text-[var(--text-light)]">Approved refund amount (PHP)
        <input type="number" min="0.01" max={refund.amount_requested} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3" />
        <span className="text-xs text-[var(--text-muted)]">Explain any amount adjustment in the customer notes.</span>
      </label>}
      {refund.status === 'processing' && <div className="space-y-4 border-t border-[var(--border)] pt-4">
        <h3 className="font-semibold text-[var(--text-light)]">Admin payment confirmation</h3>
        <p className="text-sm text-[var(--text-muted)]">Send {formatCurrency(refund.approved_amount)} to the customer's selected destination, then attach the successful transaction evidence.</p>
        <label className="block text-sm text-[var(--text-light)]">Transaction / reference number (optional)
          <input maxLength={255} value={reference} onChange={e => setReference(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3" />
        </label>
        <RefundImageInput label="Proof of refund payment (required)" value={proof} onChange={setProof} onBusyChange={setReading} disabled={busy} />
      </div>}
      <div className="flex flex-wrap gap-3">{next.map(status => <button type="button" key={status} onClick={() => update(status)}
        disabled={busy || reading || (status === 'refund_sent' && !proof) || (status === 'rejected' && !notes.trim()) || (status === 'approved' && (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > Number(refund.amount_requested)))}
        className={`rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${status === 'rejected' ? 'bg-red-500 text-white' : 'bg-[var(--gold-primary)] text-black'}`}>
        {busy ? 'Updating…' : labels[status]}</button>)}</div>
    </fieldset>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </section>
}
