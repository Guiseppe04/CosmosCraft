import { useRef, useState } from 'react'
import RefundProgress from './RefundProgress'
import RefundImageInput from './RefundImageInput'
import PrivateRefundFile from './PrivateRefundFile'
import { adminApi } from '../../utils/adminApi'
import { formatCurrency } from '../../utils/formatCurrency'
import { adminRefundTextError, REFUND_MESSAGE_PRESETS, refundMethodLabel } from '../../utils/refundWorkflow'
import { CheckCircle, Clock, XCircle } from 'lucide-react'
import AdminOrderRefundReview from './AdminOrderRefundReview'
import DispatchPhotoGallery from '../DispatchPhotoGallery'

export default function AdminRefundWorkflow(props) {
  return <>{props.refund.order_id && <DispatchPhotoGallery orderId={props.refund.order_id} allowAdd={props.refund.can_manage} />}{props.refund.original_payment_method ? <AdminOrderRefundReview {...props} /> : <LegacyAdminRefundWorkflow {...props} />}</>
}

function LegacyAdminRefundWorkflow({ refund, onUpdated }) {
  const [notes, setNotes] = useState(refund.admin_notes || '')
  const [noteChoice,setNoteChoice] = useState(refund.admin_notes ? REFUND_MESSAGE_PRESETS.adminNotes.includes(refund.admin_notes) ? refund.admin_notes : 'other' : '')
  const [customNotes,setCustomNotes] = useState(REFUND_MESSAGE_PRESETS.adminNotes.includes(refund.admin_notes) ? '' : refund.admin_notes || '')
  const [amount, setAmount] = useState(refund.approved_amount ?? refund.amount_requested ?? '')
  const [reference, setReference] = useState(''), [proof, setProof] = useState(undefined)
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [error, setError] = useState('')
  const [confirmed,setConfirmed] = useState(false)
  const lock = useRef(false), notesField = useRef(null)
  const destination = refund.payment_destination
  const next = { pending: ['under_review'], under_review: ['approved','rejected'], approved: ['processing'], processing: ['refund_sent'], refund_sent: ['completed'] }[refund.status] || []
  const labels = { under_review: 'Start review', approved: 'Approve refund', rejected: 'Reject refund', processing: 'Start payment processing', refund_sent: 'Mark refund sent', completed: 'Mark completed' }
  async function update(status) {
    if (lock.current) return
    if (status==='rejected' && adminRefundTextError(notes,'Rejection reason')) {setError(adminRefundTextError(notes,'Rejection reason'));notesField.current?.focus();return}
    if (status==='completed' && !confirmed) {setError('Confirm that the actual payment succeeded.');return}
    lock.current=true;setBusy(true);setError('')
    try {
      await adminApi.updateRefundStatus(refund.refund_request_id, status, { adminNotes: notes,
        ...(status==='completed'?{paymentConfirmed:confirmed}:{}),
        ...(status === 'approved' ? { approvedAmount: Number(amount) } : {}),
        ...(status === 'refund_sent' ? { proofImage: proof, refundReference: reference } : {}) })
      await onUpdated?.()
    } catch (err) { setError(err.message) } finally { lock.current=false;setBusy(false) }
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
      {!['approved','processing','refund_sent','completed','refunded'].includes(refund.status) && <label className="block text-sm text-[var(--text-light)]">Notes to customer / rejection reason
        <select aria-label="Suggested rejection reason" value={noteChoice} ref={node=>{if(noteChoice!=='other')notesField.current=node}} aria-invalid={noteChoice!=='other' && error.startsWith('Rejection reason')}
          onChange={e=>{const choice=e.target.value;setNoteChoice(choice);setNotes(choice==='other'?customNotes:choice);setError('')}} className="mt-2 w-full rounded-lg bg-[var(--bg-primary)] p-2"><option value="">Choose a suggested message</option>{REFUND_MESSAGE_PRESETS.adminNotes.map(message=><option key={message}>{message}</option>)}<option value="other">Other (Please specify)</option></select>
        {noteChoice==='other' && <textarea aria-label="Notes to customer / rejection reason" aria-invalid={Boolean(error.startsWith('Rejection reason'))} ref={notesField} rows={3} maxLength={1000} value={notes} autoFocus onChange={e => {setNotes(e.target.value);setCustomNotes(e.target.value)}}
          className={`mt-2 w-full rounded-lg border bg-[var(--bg-primary)] p-3 ${error.startsWith('Rejection reason')?'border-red-500 ring-1 ring-red-500':'border-[var(--border)]'}`} />}
        {error.startsWith('Rejection reason') && <p role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{error}</p>}
      </label>}
      {refund.status === 'under_review' && <label className="block text-sm text-[var(--text-light)]">Approved refund amount (PHP)
        <input type="number" min="0.01" max={refund.amount_requested} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3" />
        <span className="text-xs text-[var(--text-muted)]">Remarks are optional when approving or adjusting the amount.</span>
      </label>}
      {refund.status === 'processing' && <div className="space-y-4 border-t border-[var(--border)] pt-4">
        <h3 className="font-semibold text-[var(--text-light)]">Admin payment confirmation</h3>
        <p className="text-sm text-[var(--text-muted)]">Send {formatCurrency(refund.approved_amount)} to the customer's selected destination, then attach the successful transaction evidence.</p>
        <p className="text-sm text-[var(--text-muted)]">This records a payment already sent. It does not transfer money.</p>
        <label className="block text-sm text-[var(--text-light)]">Transaction / reference number (optional)
          <input maxLength={255} value={reference} onChange={e => setReference(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3" />
        </label>
        <RefundImageInput label="Proof of refund payment (required)" value={proof} onChange={setProof} onBusyChange={setReading} disabled={busy} />
      </div>}
      {refund.status==='refund_sent' && <label className="flex gap-2 text-sm text-[var(--text-light)]"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />I have verified that the actual refund payment succeeded.</label>}
      <div className="flex flex-wrap gap-3">{next.map(status => <button type="button" key={status} onClick={() => update(status)}
        disabled={busy || reading}
        className={`rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] ${status === 'rejected' ? 'bg-red-600 text-white' : ['approved','completed'].includes(status) ? 'bg-green-600 text-white' : status==='processing' ? 'bg-amber-600 text-white' : 'bg-slate-600 text-white'}`}>
        {busy ? 'Updating…' : labels[status]}</button>)}</div>
    </fieldset>}
    {error && !error.startsWith('Rejection reason') && <p role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{error}</p>}
  </section>
}
