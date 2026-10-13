import { useRef, useState } from 'react'
import { adminApi } from '../../utils/adminApi'
import { formatCurrency } from '../../utils/formatCurrency'
export default function CustomerRefundReview({refund,onUpdated}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const lock=useRef(false),review=refund.review || {},shipping=review.shipping,offers=review.repairOffers || []
  async function respond(offerId,response) {
    if(lock.current)return;lock.current=true;setBusy(true);setError('')
    try{await adminApi.respondRefundRepair(refund.refund_request_id,{offerId,response});await onUpdated?.()}
    catch(err){setError(err.message)}finally{lock.current=false;setBusy(false)}
  }
  if(!shipping && !offers.length && !review.policy)return null
  return <section aria-label="Return arrangements and repair offers" className="space-y-3 text-sm text-[var(--text-muted)]">
    {review.policy && <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
      <p>Submission window: 14 days from receipt for regular products; three calendar months for customized guitars. Your request is assessed using its submission date and does not expire during review.</p>
      {review.policy.items.some(item=>item.outcome==='manual_review') && <p>Receipt confirmation requires admin review. Your request has not been automatically denied.</p>}
      <p>Estimated refund payment completion: {review.timeline?.minDays===7?'1–2 calendar weeks':'1–3 calendar days'} after required evidence, return receipt and inspection are complete, or a documented no-return exception. This estimate is separate from the submission window.</p>
      {review.timeline?.startedAt && <p>Estimated completion: {new Date(review.timeline.estimatedEarliestAt).toLocaleDateString('en-PH')}–{new Date(review.timeline.estimatedLatestAt).toLocaleDateString('en-PH')}{review.timeline.completedAt?'. Payment completion confirmed.':'. The store will follow up on any delay.'}</p>}
    </div>}
    {shipping && <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
      <h4 className="font-semibold text-[var(--text-light)]">Return shipping arrangements</h4>
      <p>Shipping payer: {({seller:'Seller-paid for this request',customer:'Customer-paid for this request'})[shipping.payer] || 'Not yet decided'}</p>
      <p>Arrangement: {({customer_shipping:'Customer-arranged shipping',seller_pickup:'Seller-arranged pickup'})[shipping.arrangement] || 'Not yet decided'}</p>
      {shipping.courier && <p>Return courier: {shipping.courier}</p>}
      {shipping.reference && <p className="break-all">Arrangement tracking / reference: {shipping.reference}</p>}
      {shipping.cost!=null && <p>Recorded return shipping cost: {formatCurrency(shipping.cost)}</p>}
      {shipping.deadline && <p>Return shipping deadline: {new Date(shipping.deadline+'T12:00:00').toLocaleDateString('en-PH')}</p>}
      {review.overdue && <p className="text-amber-400">The return shipping deadline has passed. The store will review your case; this does not automatically reject your refund.</p>}
      <p>Shipping reimbursement: {({pending:'Awaiting reimbursement',recorded:'Reimbursement recorded',not_applicable:'Not applicable'})[shipping.reimbursement] || 'Not recorded'}</p>
      {shipping.reimbursementAmount!=null && <p>Recorded reimbursement amount: {formatCurrency(shipping.reimbursementAmount)}</p>}
      {shipping.reimbursementReference && <p className="break-all">Reimbursement payment / receipt reference: {shipping.reimbursementReference}</p>}
      <p className="text-xs">Follow the store's return instructions. Shipping records are separate from your approved product refund amount.</p>
    </div>}
    {offers.length>0 && <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <h4 className="font-semibold text-[var(--text-light)]">Repair / rework offers</h4>
      {offers.map((offer,index)=><div key={offer.id} className="space-y-2">
        <p>{offer.type==='repair'?'Repair':'Rework'} offer — {offer.response}</p>
        <p className="whitespace-pre-wrap break-words">{offer.description}</p>
        <p className="text-xs">Offered {new Date(offer.offeredAt).toLocaleString('en-PH')}{offer.respondedAt?`; responded ${new Date(offer.respondedAt).toLocaleString('en-PH')}`:''}</p>
        {index===offers.length-1 && offer.response==='pending' && !['processing','refund_sent','completed','refunded','rejected','withdrawn'].includes(refund.status) && <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={()=>respond(offer.id,'accepted')} className="rounded-lg bg-green-600 px-3 py-2 text-white disabled:opacity-50">Accept repair / rework offer</button>
          <button type="button" disabled={busy} onClick={()=>respond(offer.id,'declined')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--text-light)] disabled:opacity-50">Decline repair / rework offer</button>
        </div>}
      </div>)}
      <p className="text-xs">Your response records your choice for the store to review. It does not book an appointment, send a payment, or automatically complete or reject your refund.</p>
    </div>}
    {error && <p role="alert" style={{ color: '#ef4444' }}>{error}</p>}
  </section>
}
