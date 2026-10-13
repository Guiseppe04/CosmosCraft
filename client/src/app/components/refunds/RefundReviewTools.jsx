import { useEffect, useRef, useState } from 'react'
import { adminApi } from '../../utils/adminApi'
import { formatCurrency } from '../../utils/formatCurrency'

const inputClass='mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-2 text-sm text-[var(--text-light)]'
const buttonClass='rounded-lg border border-[var(--gold-primary)] px-4 py-2 text-sm text-[var(--gold-primary)] disabled:opacity-50'
const number = value => value==='' || value==null ? null : Number(value)
function initial(review={}) {
  return {version:review.version || 0,
    receipt:{status:'unverified',confirmedDate:null,evidence:'',...review.receipt},
    shipping:{payer:'undecided',arrangement:'undecided',courier:'',reference:'',cost:null,reimbursement:'not_recorded',reimbursementAmount:null,reimbursementReference:'',deadline:null,...review.shipping},
    financial:{materialValue:null,incurredLabor:null,evidence:'',verified:false,...review.financial},evidenceComplete:Boolean(review.evidenceComplete)}
}
export default function RefundReviewTools({refund,onUpdated}) {
  const [data,setData]=useState(()=>initial(refund.review_data)),[dirty,setDirty]=useState(false)
  const [type,setType]=useState('repair'),[description,setDescription]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
  const lock=useRef(false)
  useEffect(()=>{if(!dirty)setData(initial(refund.review_data))},[refund.review_data,dirty])
  const closed=['completed','refunded','rejected','withdrawn'].includes(refund.status),context=refund.review_context || {}
  const isCustom = context.calculation?.custom ?? context.containsCustomItems
    ?? (Boolean(refund.project_id) || Boolean(refund.review_data?.policy?.items?.some(item=>item.custom)))
  const stale=(refund.review_data?.version || 0)!==data.version
  const offers=refund.review_data?.repairOffers || []
  const change=(group,key,value)=>{setDirty(true);setData(previous=>({...previous,[group]:{...previous[group],[key]:value}}));setMessage('')}
  const field=(group,key,label,{kind='text',options,nullable=false}={})=><label className="block text-sm">{label}
    {options?<select value={data[group][key]} onChange={e=>change(group,key,e.target.value)} className={inputClass}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select>
      :kind==='textarea'?<textarea rows={2} maxLength={1000} value={data[group][key] || ''} onChange={e=>change(group,key,e.target.value)} className={inputClass} />
      :<input type={kind} min={kind==='number'?0:undefined} step={kind==='number'?'0.01':undefined} maxLength={kind==='text'?255:undefined} value={data[group][key] ?? ''}
        onChange={e=>change(group,key,kind==='number'?number(e.target.value):nullable?(e.target.value || null):e.target.value)} className={inputClass} />}
  </label>
  async function run(action) {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('')
    try {
      if(action==='save')await adminApi.updateRefundReview(refund.refund_request_id,data)
      else await adminApi.offerRefundRepair(refund.refund_request_id,{version:data.version,type,description})
      const fresh=await adminApi.getRefundRequest(refund.refund_request_id)
      setData(initial(fresh.data.review_data));setDirty(false);if(action==='offer')setDescription('')
      await onUpdated?.();setMessage(action==='save'?'Review details saved. Refund status and amount are unchanged.':'Offer sent. The customer can accept or decline it; refund status and amount are unchanged.')
    }catch(err){setError(err.message)}finally{lock.current=false;setBusy(false)}
  }
  if(!refund.can_manage)return null
  return <section aria-label="Refund review tools" className="space-y-4 rounded-xl border border-[var(--border)] p-4 text-[var(--text-light)]">
    <h3 className="font-semibold">Review details and return arrangements</h3>
    <div aria-label="Fixed refund policy" className="rounded-lg border border-[var(--border)] p-3 text-sm space-y-1">
      {isCustom ? <>
        <p>Customized guitar warranty: 3 calendar months from receipt.</p>
        <p>Customized guitar refund: the lower of verified material/base value and remaining actual payment minus verified incurred labor, capped at the requested amount and subject to admin review.</p>
        <p>Estimated custom processing: 7-14 calendar days (1-2 weeks).</p>
      </> : <>
        <p>Regular-product request window: 14 days from receipt.</p>
        <p>Regular-product refund: default 50%, subject to admin review and adjustment.</p>
        <p>Estimated regular processing: 1-3 calendar days.</p>
      </>}
      <p className="text-xs text-[var(--text-muted)]">Processing estimates begin after required evidence, return receipt and inspection, or a documented no-return exception, are complete.</p>
    </div>
    <p className="text-sm">Timely requests remain eligible during review.</p>
    {refund.review_data?.policy?.items?.map(item=><p key={item.orderItemId} className="text-xs">Item {item.orderItemId}: {item.outcome==='manual_review'?'Receipt verification required':`Submitted within window; deadline ${new Date(item.expiresAt).toLocaleString('en-PH')}`}</p>)}
    <p className="text-sm text-[var(--text-muted)]">Record case-specific facts and arrangements. These tools do not approve, reject, or pay a refund.</p>
    <p className="text-sm">Product type: {isCustom?'Customized guitar':'Regular products'}</p>
    {context.receiptNeedsReview && <p role="status" className="text-sm text-amber-400">Receipt date requires manual review. Missing or disputed confirmation does not automatically deny eligibility.</p>}
    {context.overdue && <p role="status" className="text-sm text-amber-400">Return shipping deadline has passed. Flagged for manual review; the request has not been automatically rejected.</p>}
    {stale && <p role="alert" style={{ color: '#ef4444' }} className="text-sm">Review details changed while you were editing. Refresh before saving. Your draft is still visible.</p>}
    <fieldset disabled={busy || closed} className="space-y-4">
      <details open className="space-y-3"><summary className="cursor-pointer font-semibold">Receipt verification</summary>
        <p className="text-xs text-[var(--text-muted)]">Recorded customer receipt: {context.receivedAt?new Date(context.receivedAt).toLocaleString('en-PH'):'Not recorded'}. Recorded delivery: {context.deliveredAt?new Date(context.deliveredAt).toLocaleString('en-PH'):'Not recorded'}. Review records do not replace the original order dates.</p>
        {isCustom && (context.projectDeliveredAt || context.projectPickedUpAt) && <p className="text-xs text-[var(--text-muted)]">Project delivery: {context.projectDeliveredAt?new Date(context.projectDeliveredAt).toLocaleString('en-PH'):'Not recorded'}. Project pickup: {context.projectPickedUpAt?new Date(context.projectPickedUpAt).toLocaleString('en-PH'):'Not recorded'}.</p>}
        {field('receipt','status','Receipt review outcome',{options:[['unverified','Not yet verified'],['verified','Verified'],['disputed','Disputed — manual review']]})}
        {field('receipt','confirmedDate','Confirmed actual receipt date',{kind:'date',nullable:true})}
        {field('receipt','evidence','Receipt verification evidence / dispute explanation',{kind:'textarea'})}
      </details>
      <details className="space-y-3"><summary className="cursor-pointer font-semibold">Return shipping and reimbursement</summary>
        {field('shipping','payer','Return shipping payer',{options:[['undecided','Not decided'],['seller','Seller-paid for this request'],['customer','Customer-paid for this request']]})}
        {field('shipping','arrangement','Return shipping arrangement',{options:[['undecided','Not decided'],['customer_shipping','Customer-arranged shipping'],['seller_pickup','Seller-arranged pickup']]})}
        <div className="grid gap-3 sm:grid-cols-2">{field('shipping','courier','Return courier')}{field('shipping','reference','Return arrangement tracking / reference')}
          {field('shipping','cost','Recorded return shipping cost (PHP)',{kind:'number'})}{field('shipping','deadline','Return shipping deadline (optional)',{kind:'date',nullable:true})}</div>
        {field('shipping','reimbursement','Shipping reimbursement record',{options:[['not_recorded','Not recorded'],['pending','Awaiting reimbursement'],['recorded','Reimbursement recorded'],['not_applicable','Not applicable']]})}
        {field('shipping','reimbursementAmount','Recorded reimbursement amount (PHP)',{kind:'number'})}{field('shipping','reimbursementReference','Reimbursement payment / receipt reference')}
        <p className="text-xs text-[var(--text-muted)]">Recording a cost or reimbursement does not transfer money or add it to the approved product refund. Deadlines flag cases for review only. Use the existing return instructions for packing and pickup directions.</p>
      </details>
      {isCustom && <><details className="space-y-3"><summary className="cursor-pointer font-semibold">Financial review inputs</summary>
        <p className="text-sm">Recorded payment total (verified/refunded): {context.verifiedPaymentTotal==null?'Not recorded':formatCurrency(context.verifiedPaymentTotal)}. Order discount: {context.discountAmount==null?'Not recorded':formatCurrency(context.discountAmount)}. Outbound shipping: {context.outboundShippingCost==null?'Not recorded':formatCurrency(context.outboundShippingCost)}.</p>
        {field('financial','materialValue','Verified material / base value (PHP)',{kind:'number'})}{field('financial','incurredLabor','Verified incurred labor (PHP)',{kind:'number'})}
        {field('financial','evidence','Financial source / supporting evidence',{kind:'textarea'})}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={data.financial.verified} onChange={e=>change('financial','verified',e.target.checked)} />I verified these financial inputs from supporting records.</label>
        <p className="text-xs text-[var(--text-muted)]">Leave unknown values blank. For customized guitars, the refund limit is the lower of verified material/base value and remaining actual payment minus verified incurred labor, capped at the requested amount. Saving facts does not approve a refund. Verify values for the selected items only.</p>
        {context.calculation?.custom && <p className="text-sm">{context.calculation.requiresVerifiedCosts?'Verified costs are required before refund approval.':`Verified refund limit: ${formatCurrency(context.calculation.maximum)}`}</p>}
      </details>
      <details className="space-y-3"><summary className="cursor-pointer font-semibold">Processing milestones</summary>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={data.evidenceComplete} onChange={e=>{setDirty(true);setData(previous=>({...previous,evidenceComplete:e.target.checked}))}} />Required evidence complete</label>
        <ul className="space-y-1 text-sm">{[['Evidence marked complete',refund.review_data?.evidenceCompletedAt],['Return received',refund.item_received_at],['Inspection recorded',refund.inspected_at],['Refund approved',refund.approved_at],['Payment processing started',refund.processing_at],['Refund completed',refund.completed_at]].map(([label,value])=><li key={label}>{label}: {value?new Date(value).toLocaleString('en-PH'):'Not recorded'}</li>)}</ul>
        <p className="text-xs text-[var(--text-muted)]">Estimated payment completion: 1–2 calendar weeks for customized guitars, after required evidence, return receipt and inspection are complete (or a documented no-return exception). These are estimates, separate from submission eligibility. Delays require follow-up, not automatic rejection.</p>
        <p className="text-sm">{context.timeline?.startedAt?`Estimate started ${new Date(context.timeline.startedAt).toLocaleString('en-PH')}; estimated completion ${new Date(context.timeline.estimatedEarliestAt).toLocaleDateString('en-PH')}–${new Date(context.timeline.estimatedLatestAt).toLocaleDateString('en-PH')}.`:'Estimate has not started; complete the required milestones.'}</p>
      </details></>}
      <button type="button" onClick={()=>run('save')} disabled={busy || stale} className={buttonClass}>{busy?'Saving...':'Save review details'}</button>
      {stale && <button type="button" onClick={()=>{setData(initial(refund.review_data));setDirty(false);setError('')}} className={buttonClass}>Reload latest review details</button>}
    </fieldset>
    {isCustom && <details open={offers.length>0} className="space-y-3"><summary className="cursor-pointer font-semibold">Repair / rework offers</summary>
      {offers.map(offer=><div key={offer.id} className="rounded-lg border border-[var(--border)] p-3 text-sm"><p className="font-semibold">{offer.type==='repair'?'Repair':'Rework'} — {offer.response}</p><p className="whitespace-pre-wrap break-words">{offer.description}</p><p className="text-xs text-[var(--text-muted)]">Offered {new Date(offer.offeredAt).toLocaleString('en-PH')}{offer.respondedAt?`; responded ${new Date(offer.respondedAt).toLocaleString('en-PH')}`:''}</p></div>)}
      {!closed && !['processing','refund_sent'].includes(refund.status) && <fieldset disabled={busy || dirty || stale || offers.at(-1)?.response==='pending'} className="space-y-3">
        <label className="block text-sm">Offer type<select value={type} onChange={e=>setType(e.target.value)} className={inputClass}><option value="repair">Repair</option><option value="rework">Rework</option></select></label>
        <label className="block text-sm">Repair / rework offer details<textarea rows={3} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} className={inputClass} /></label>
        <button type="button" onClick={()=>run('offer')} className={buttonClass}>Send repair / rework offer</button>
      </fieldset>}
      {dirty && <p className="text-xs text-[var(--text-muted)]">Save review details before sending an offer.</p>}
      <p className="text-xs text-[var(--text-muted)]">Acceptance records the customer's choice only. Arrange service separately; no appointment is created and the refund is not marked paid or completed. Review any accepted offer before making the next refund decision.</p>
    </details>}
    {error && <p role="alert" style={{ color: '#ef4444' }} className="text-sm">{error}</p>}
    {message && <p role="status" className="text-sm text-green-400">{message}</p>}
  </section>
}
