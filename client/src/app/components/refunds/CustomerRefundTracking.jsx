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
import { Truck, Camera, Send, ClipboardList } from 'lucide-react'

const returnFieldClass = 'mt-2 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/30 focus:border-[var(--gold-primary)]'

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
      {details.return_instructions && <div className="rounded-lg border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/5 p-3"><p className="mb-1 flex items-center gap-2 font-semibold text-[var(--text-light)]"><ClipboardList className="h-4 w-4" aria-hidden="true" />Return instructions</p><p className="whitespace-pre-wrap break-words">{details.return_instructions}</p></div>}
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
    {details?.return_status === 'return_pending' && details.return_instructions?.trim() && ['return_required','approved','return_pending'].includes(details.status) && <fieldset disabled={busy || reading} className="min-w-0 space-y-4 rounded-xl border border-[var(--border)] p-4">
      <legend className="px-2 text-base font-semibold text-[var(--text-light)]">Submit item return</legend>
      <p className="text-sm text-[var(--text-muted)]">Follow the return instructions above, then provide your return details and photos for the store to review. Fields marked <span style={{ color: '#ef4444' }}>*</span> are required.</p>
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-light)]"><Truck className="h-4 w-4 text-[var(--gold-primary)]" aria-hidden="true" />1. Return details</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm text-[var(--text-light)]">Return method <span style={{ color: '#ef4444' }}>*</span>
            <select value={method} onChange={e => setMethod(e.target.value)} className={returnFieldClass}><option value="courier">Courier</option><option value="pickup">Pickup / drop-off</option></select>
          </label>
          <label className="block text-sm text-[var(--text-light)]">Shipping / receipt reference {method === 'courier' ? <span style={{ color: '#ef4444' }}>*</span> : <span className="text-xs text-[var(--text-muted)]">(optional)</span>}
            <input value={reference} maxLength={255} onChange={e => setReference(e.target.value)} placeholder={method === 'courier' ? 'Enter tracking or receipt number' : 'Enter a receipt number, if available'} className={returnFieldClass} />
          </label>
        </div>
        <p className="text-xs text-[var(--text-muted)]">{method === 'courier' ? 'Use the tracking number or reference shown on your courier receipt.' : 'For pickup or drop-off, provide a receipt reference if you have one.'}</p>
        <label className="block text-sm text-[var(--text-light)]">Return notes <span className="text-xs text-[var(--text-muted)]">(optional)</span><textarea value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add details that may help the store review your return." className={returnFieldClass} /></label>
      </div>
      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-light)]"><Camera className="h-4 w-4 text-[var(--gold-primary)]" aria-hidden="true" />2. Attach return photos</h4>
        <p className="text-xs text-[var(--text-muted)]">Include the packaged item and shipping receipt. Follow the provided return instructions.</p>
        <CustomerRefundImages label="Return photos" images={images} onChange={setImages} disabled={busy || reading} onBusyChange={setReading} />
      </div>
      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-light)]"><Send className="h-4 w-4 text-[var(--gold-primary)]" aria-hidden="true" />3. Review and submit</h4>
        <p className="text-xs text-[var(--text-muted)]">Check your return method, reference and selected photos before submitting.</p>
        <button type="button" disabled={busy || reading} onClick={submitReturn} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--gold-primary)] px-4 py-3 text-sm font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] disabled:opacity-50 sm:w-auto"><Send className="h-4 w-4" aria-hidden="true" />{busy ? 'Submitting...' : 'Submit return evidence'}</button>
      </div>
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
