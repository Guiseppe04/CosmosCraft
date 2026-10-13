import { useState, useEffect, useCallback, useRef } from 'react'
import CustomerRefundProgress from './CustomerRefundProgress'
import CustomerRefundImages from './CustomerRefundImages'
import CustomerRefundReview from './CustomerRefundReview'
import { useRefundRealtime } from '../../hooks/useRefundRealtime'
import { formatPaymentMethod } from '../../utils/paymentMethodUtils'
import PrivateRefundFile from './PrivateRefundFile'
import { adminApi } from '../../utils/adminApi'
import { formatCurrency } from '../../utils/formatCurrency'
import { refundMethodLabel, refundStatusLabel } from '../../utils/refundWorkflow'

export default function CustomerRefundTracking({ order, onRefresh }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  const [details, setDetails] = useState(null)
  const [images, setImages] = useState([]), [reading, setReading] = useState(false)
  const [method, setMethod] = useState('courier'), [reference, setReference] = useState(''), [notes, setNotes] = useState('')
  const [evidence, setEvidence] = useState([])
  const actionLock = useRef(false)
  const refresh = useCallback(async () => {
    try {
      const result = await adminApi.getCustomerRefundTracking(order.refund_request_id)
      setDetails(result.data)
      const files = await Promise.all(result.data.files.map(async kind => ({kind, image:(await adminApi.getCustomerRefundEvidence(order.refund_request_id,kind)).data.image})))
      setEvidence(files)
    } catch (err) { setError(err.message) }
  }, [order.refund_request_id])
  useEffect(() => { refresh() }, [refresh,order.refund_request_status])
  useEffect(() => {if(details?.review?.shipping?.arrangement==='seller_pickup')setMethod('pickup')},[details?.review?.shipping?.arrangement])
  useRefundRealtime(refresh)
  const refund = details || { status:order.refund_request_status,preferred_method:order.refund_preferred_method }
  async function submitReturn() {
    if (actionLock.current || reading) return
    if (!images.length || (method === 'courier' && !reference.trim())) { setError('Upload return evidence and provide the courier tracking or receipt reference.'); return }
    actionLock.current = true; setBusy(true); setError('')
    try {
      await adminApi.submitCustomerReturn(order.refund_request_id,{images,returnMethod:method,returnReference:reference.trim(),notes:notes.trim()})
      setImages([]); setSuccess('Return evidence submitted. Awaiting receipt and inspection.'); await refresh(); await onRefresh?.()
    } catch (err) { setError(err.message) } finally { actionLock.current = false; setBusy(false) }
  }
  const sent = ['refund_sent', 'completed'].includes(refund.status)
  return <section aria-label="Refund tracking" className="mt-4 space-y-4 rounded-xl border border-[var(--border)] p-4">
    <h3 className="text-sm font-semibold text-[var(--text-light)]">Refund tracking</h3>
    <CustomerRefundProgress refund={refund} />
    {details && <CustomerRefundReview refund={details} onUpdated={async()=>{await refresh();await onRefresh?.()}} />}
    <p className="text-sm text-[var(--text-muted)]">Original payment method: {details?.original_payment_method ? formatPaymentMethod(details.original_payment_method) : refundMethodLabel(order.refund_preferred_method)}</p>
    {details && <div className="space-y-2 text-sm text-[var(--text-muted)]">
      <p>Reason: {details.reason}</p><p className="whitespace-pre-wrap break-words">{details.customer_notes}</p>
      <p>Requested amount: {formatCurrency(details.amount_requested)}</p>
      {details.approved_amount != null && <p>Approved amount: {formatCurrency(details.approved_amount)}</p>}
      {details.admin_notes && <p className="whitespace-pre-wrap break-words">Admin remarks: {details.admin_notes}</p>}
      {details.rejection_reason && <p className="text-red-400 whitespace-pre-wrap break-words">{details.rejection_reason}</p>}
      {details.return_instructions && <p className="whitespace-pre-wrap break-words">Return instructions: {details.return_instructions}</p>}
      {details.no_return_reason && <p className="whitespace-pre-wrap break-words">Return Not Required: {details.no_return_reason}</p>}
      {details.inspection_notes && <p className="whitespace-pre-wrap break-words">Inspection notes: {details.inspection_notes}</p>}
      {details.return_reference && <p className="break-all">Return reference: {details.return_reference}</p>}
      {details.item_received_at && <p>Item received: {new Date(details.item_received_at).toLocaleString('en-PH')}</p>}
      {details.return_confirmed_at && <p>Item received: {new Date(details.return_confirmed_at).toLocaleString('en-PH')}</p>}
    </div>}
    {evidence.length > 0 && <details className="text-sm text-[var(--text-muted)]"><summary>View supporting and return images</summary>
      <div className="mt-3 grid grid-cols-2 gap-3">{evidence.map(file => <figure key={file.kind}>
        <img src={file.image} alt={file.kind.startsWith('return') ? 'Return evidence' : 'Refund evidence'} className="max-h-48 max-w-full rounded-lg object-contain" />
        <figcaption>{file.kind.startsWith('return') ? 'Return evidence' : ''}</figcaption>
      </figure>)}</div>
    </details>}
    {details?.return_status === 'return_pending' && details.return_instructions?.trim() && ['return_required','approved','return_pending'].includes(details.status) && <fieldset disabled={busy || reading} className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <legend className="text-sm text-[var(--text-light)]">Submit item return</legend>
      <label className="block text-sm">Return method <span style={{ color: '#ef4444' }} className="text-red-400">*</span>
        <select value={method} onChange={e => setMethod(e.target.value)} className="mt-1 w-full rounded-lg bg-[var(--bg-primary)] p-2"><option value="courier">Courier</option><option value="pickup">Pickup / drop-off</option></select>
      </label>
      <label className="block text-sm">Shipping / receipt reference {method === 'courier' && <span style={{ color: '#ef4444' }} className="text-red-400">*</span>}
        <input value={reference} maxLength={255} onChange={e => setReference(e.target.value)} className="mt-1 w-full rounded-lg bg-[var(--bg-primary)] p-2" />
      </label>
      <label className="block text-sm">Return notes<textarea value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} className="mt-1 w-full rounded-lg bg-[var(--bg-primary)] p-2" /></label>
      <CustomerRefundImages images={images} onChange={setImages} disabled={busy || reading} onBusyChange={setReading} />
      <p className="text-xs text-[var(--text-muted)]">Include the packaged item and shipping receipt. Follow the provided return instructions.</p>
      <button type="button" disabled={busy || reading} onClick={submitReturn} className="rounded-lg bg-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Submitting...' : 'Submit return evidence'}</button>
    </fieldset>}
    {sent && <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--text-light)]">Admin payment confirmation</h4>
      <dl className="grid grid-cols-1 gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-2">
        <div><dt>Refund amount</dt><dd className="text-[var(--text-light)]">{formatCurrency(order.refund_refunded_amount)}</dd></div>
        <div><dt>Refund method</dt><dd>{details?.original_payment_method ? formatPaymentMethod(details.original_payment_method) : refundMethodLabel(order.refund_preferred_method)}</dd></div>
        <div><dt>Sent</dt><dd>{order.refund_sent_at ? new Date(order.refund_sent_at).toLocaleString('en-PH') : '—'}</dd></div>
        <div><dt>Transaction reference</dt><dd className="break-all">{order.refund_reference || 'Not provided'}</dd></div>
      </dl>
      <PrivateRefundFile refundId={order.refund_request_id} kind="proof" label="Proof of refund payment" />
      {order.refund_completed_at && <p className="text-sm text-green-400">Completed {new Date(order.refund_completed_at).toLocaleString('en-PH')}</p>}
    </div>}
    {details?.history?.length > 0 && <details className="text-sm text-[var(--text-muted)]"><summary>Refund activity</summary><ol className="mt-2 space-y-2">{details.history.map((entry,index) => <li key={index}>{entry.action === 'refund_return_not_required' ? 'Return Not Required' : refundStatusLabel(entry.new_status)} ? {new Date(entry.created_at).toLocaleString('en-PH')}</li>)}</ol></details>}
    {error && <p role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{error}</p>}
    {success && <p role="status" className="text-sm text-green-400">{success}</p>}
  </section>
}
