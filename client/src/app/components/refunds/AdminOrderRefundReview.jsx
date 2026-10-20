import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ConfirmModal } from '../ui/ConfirmModal'
import CustomerRefundProgress from './CustomerRefundProgress'
import PrivateRefundFile from './PrivateRefundFile'
import RefundImageInput from './RefundImageInput'
import { adminApi } from '../../utils/adminApi'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatPaymentMethod } from '../../utils/paymentMethodUtils'
import { adminRefundTextError, REFUND_MESSAGE_PRESETS } from '../../utils/refundWorkflow'
import { useBranchSettings } from '../../hooks/useBranchSettings'
import ImageZoomModal from '../../pages/admin/components/shared/ImageZoomModal'
import AdminRefundSteps from './AdminRefundSteps'
import DispatchPhotoGallery from '../DispatchPhotoGallery'
import { RefundRequestItems, RefundRequestPhotos } from './RefundRequestContents'
import { CheckCircle, XCircle, Truck, Clock, Search, PackageCheck, X, ArrowRight, ShieldCheck, Loader2, Camera } from 'lucide-react'

const actions = {
  pending:['under_review','return_required','approved'],
  under_review:['return_required','approved'],
  return_required:['item_received'],return_in_transit:['item_received'],
  return_pending:['item_received'],returned:['item_received'],
  item_received:['under_inspection'],under_inspection:['approved','rejected'],
  approved:['processing'],processing:['refund_sent'],refund_sent:['completed'],
}
const labels = {mark_no_return:'Mark Return Not Required',under_review:'Start review',return_required:'Approve return',item_received:'Confirm item received',
  under_inspection:'Start inspection',approved:'Approve request',processing:'Start refund processing',
  refund_sent:'Record refund payment',completed:'Complete refund',rejected:'Reject refund'}
const fieldClass = 'mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-light)]'
const Required = () => <span style={{ color: '#ef4444' }} className="text-red-400">*</span>

export default function AdminOrderRefundReview({ refund, onUpdated }) {
  const [notes,setNotes] = useState(''), [instructions,setInstructions] = useState(refund.return_instructions || '')
  const [customNotes,setCustomNotes] = useState('')
  const [customInstructions,setCustomInstructions] = useState(refund.return_instructions || '')
  const [exception,setException] = useState(''), [inspection,setInspection] = useState(refund.inspection_notes || '')
  const [amount,setAmount] = useState(refund.approved_amount ?? refund.review_context?.calculation?.suggestedAmount ?? refund.amount_requested)
  const savedInspection=refund.review_data?.inspection
  const [suitable,setSuitable] = useState(savedInspection ? savedInspection.items.some(item=>item.resaleSuitable) ? 'yes' : 'no' : refund.resale_suitable == null ? '' : refund.resale_suitable ? 'yes' : 'no')
  const [claim,setClaim] = useState(refund.claim_verified == null ? '' : refund.claim_verified ? 'yes' : 'no')
  const inspectionItems = (refund.items || []).map(item=>{
    const saved=savedInspection?.items.find(result=>String(result.orderItemId)===String(item.order_item_id))
    return {orderItemId:Number(item.order_item_id),acceptedQuantity:saved?.acceptedQuantity ?? (suitable==='yes'?Number(item.quantity):0),resaleSuitable:saved ? saved.resaleSuitable : suitable==='yes'}
  })
  const [resaleOpen,setResaleOpen]=useState(false), [resaleProof,setResaleProof]=useState(undefined), [resaleConfirmed,setResaleConfirmed]=useState(false)
  const [rejectionOpen,setRejectionOpen]=useState(false), [rejectionConfirm,setRejectionConfirm]=useState(false)
  const [reference,setReference] = useState(''), [proof,setProof] = useState(undefined), [confirmed,setConfirmed] = useState(false)
  const [busy,setBusy] = useState(false), [reading,setReading] = useState(false), [error,setError] = useState('')
  const lock = useRef(false)
  const fields = useRef({})
  const [errors,setErrors] = useState({}), [presets,setPresets] = useState({})
  const [mode,setMode] = useState('return')
  const [showOriginalProof,setShowOriginalProof] = useState(false)
  const branches = useBranchSettings()
  const review = ['pending','under_review'].includes(refund.status)
  const refundApproved = refund.approved_amount != null || ['approved','processing','refund_sent','completed','refunded'].includes(refund.status)
  const inspect = refund.status === 'under_inspection'
  const noReturnRecorded = refund.return_status === 'not_required' && Boolean(refund.no_return_reason)
  const next = (review ? noReturnRecorded ? ['approved'] : [mode === 'no_return' ? 'mark_no_return' : 'return_required']
    : refund.status === 'approved' && ['return_pending','returned','return_in_transit'].includes(refund.return_status)
      ? ['item_received'] : actions[refund.status] || []).filter(status=>status!=='rejected' || inspect)
  const files = refund.private_files || []
  const receivedFiles = files.filter(kind => /^evidence_?[0-4]$/.test(kind))
  const returnFiles = files.filter(kind => /^return_?[0-4]$/.test(kind)).sort((a,b) => Number(a.slice(-1)) - Number(b.slice(-1)))
  const showReturnShipment = next.includes('item_received') || returnFiles.length > 0 || refund.return_method || refund.return_reference || refund.customer_return_notes
  const paymentStage = ['processing','refund_sent','completed','refunded'].includes(refund.status)
  const hasInspectionHistory = showReturnShipment || refund.admin_notes || refund.return_instructions || refund.item_received_at || refund.inspection_notes || refund.claim_verified != null || files.includes('inspection') || refund.no_return_reason || refund.rejection_reason
  const InspectionHistory = paymentStage && hasInspectionHistory ? 'details' : 'div'
  const payment = refund.payment
  const paymentProof = payment?.proof_url || payment?.payment_proof_url || payment?.proof_image_url
  const actionTitle = inspect ? 'Inspect and decide' : review ? noReturnRecorded ? 'Refund decision' : 'Return decision'
    : next.includes('item_received') ? 'Receive returned item'
    : refund.status === 'item_received' ? 'Begin inspection' : refund.status === 'approved' ? 'Begin refund processing'
    : refund.status === 'processing' ? 'Record refund payment' : refund.status === 'refund_sent' ? 'Confirm refund payment' : 'Final outcome'
  function validate(status) {
    const result = {}
    if (status === 'return_required') { const error=adminRefundTextError(instructions,'Return instructions'); if(error) result.returnInstructions=error }
    if (status === 'mark_no_return') { const error=adminRefundTextError(exception,'Return Not Required reason'); if(error) result.noReturnReason=error }
    if (status === 'rejected') { const error=adminRefundTextError(notes,'Rejection reason'); if(error) result.adminNotes=error }
    if (['approved','rejected','save_inspection'].includes(status) && inspect && !inspection.trim()) result.inspectionNotes='Inspection notes are required.'
    if (['approved','rejected','save_inspection'].includes(status) && inspect && !claim) result.claimVerified='Select whether the customer claim was verified during inspection.'
    if (['approved','rejected','save_inspection'].includes(status) && inspect) {
      if (!suitable) result.resaleSuitable='Select whether the item is suitable for resale.'
      else if (suitable==='yes' && !savedInspection) {
        if (!resaleProof) result.resaleProof='Upload photo proof showing the returned items are suitable for resale.'
        if (!resaleConfirmed) result.resaleConfirmed='Confirm the listed quantities were physically received, inspected and are suitable for resale.'
      }
    }
    if (status === 'approved' && inspect && claim==='no') result.claimVerified='The customer claim must be verified before approving the refund.'
    if (status === 'approved') {
      const calculation=refund.review_context?.calculation;
      if(calculation?.custom && calculation.requiresVerifiedCosts) result.approvedAmount='Verified material/base value, incurred labor and supporting evidence are required before approving this customized guitar refund.'
      else if(calculation?.custom && Number(amount)>calculation.maximum) result.approvedAmount=`The verified customized guitar refund limit is ${formatCurrency(calculation.maximum)}.`
      if (!Number.isFinite(Number(amount)) || Number(amount)<=0 || Number(amount)>Number(refund.amount_requested)) result.approvedAmount='Enter a positive amount up to the requested refund.'
      if (!inspect && !noReturnRecorded) result.noReturnReason='Record Return Not Required before approving this refund.'
    }
    if (status === 'refund_sent' && !proof) result.proofImage='Upload refund payment proof before recording payment.'
    if (status === 'completed' && !confirmed) result.paymentConfirmed='Confirm that the actual payment succeeded.'
    return result
  }
  function clearError(key,value) {
    if (!adminRefundTextError(value,key)) setErrors(previous=>({...previous,[key]:undefined}))
  }
  function textField(key,label,value,setter,{required=false,max=1000,options=[]}={}) {
    const choices=key==='returnInstructions' && branches.isLoaded ? [...options,...branches.branches.map(branch=>`Please securely pack the item and return it to ${branch.name}, ${branch.address}.`)] : options
    const remarks=key==='adminNotes', instructionsField=key==='returnInstructions'
    const dropdownOnly=remarks || instructionsField, showText=!dropdownOnly || presets[key]==='other'
    return <div className="space-y-2">
      <label htmlFor={`refund-${key}${showText?'':'-choice'}`} className="block text-sm text-[var(--text-light)]">{label} {required && <Required />}</label>
      {choices.length>0 && <select id={`refund-${key}-choice`} aria-label={`Suggested ${label}`} value={presets[key] || ''} className={fieldClass}
        ref={node=>{if(!showText) fields.current[key]=node}}
        aria-invalid={!showText ? Boolean(errors[key]) : undefined} aria-describedby={errors[key]?`error-${key}`:undefined}
        onChange={event=>{const choice=event.target.value;setPresets(previous=>({...previous,[key]:choice}));
          if(remarks){const updated=choice==='other'?customNotes:choice?choices[Number(choice)-1]:'';setter(updated);clearError(key,updated);return}
          if(instructionsField){const updated=choice==='other'?customInstructions:choice?choices[Number(choice)-1]:'';setter(updated);clearError(key,updated);return}
          if(choice && choice!=='other'){const suggestion=choices[Number(choice)-1];const updated=value.includes(suggestion)?value:value.trim()?`${value}\n${suggestion}`:suggestion;setter(updated);clearError(key,updated)}
          fields.current[key]?.focus()
        }}><option value="">Choose a suggested message</option>{choices.map((choice,index)=><option key={choice} value={index+1}>{choice}</option>)}<option value="other">Other (Please specify)</option></select>}
      {showText && <textarea id={`refund-${key}`} aria-label={label} ref={node=>{fields.current[key]=node}} value={value} maxLength={max} rows={3} autoFocus={remarks}
        aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?`error-${key}`:undefined}
        onChange={event=>{setter(event.target.value);if(remarks)setCustomNotes(event.target.value);if(instructionsField)setCustomInstructions(event.target.value);clearError(key,event.target.value)}} className={`${fieldClass} ${errors[key]?'border-red-500 ring-1 ring-red-500':''}`} />}
      {errors[key] && <p id={`error-${key}`} role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{errors[key]}</p>}
      {choices.length>0 && <p className="text-xs text-[var(--text-muted)]" style={{ color: '#f59e0b' }}>{dropdownOnly?'Select a message, or choose Other to enter your own text.':'Suggestions are editable and added to your existing text. Couriers are suggestions only.'}</p>}    </div>
  }
  async function update(status,confirmRejection=false) {
    if (lock.current || reading) return
    const validation=validate(status);setErrors(validation);setError('')
    if(Object.keys(validation).length){
      const focusError=()=>{const field=fields.current[Object.keys(validation)[0]];field?.focus();field?.scrollIntoView({block:'center',behavior:'smooth'})}
      if(status==='save_inspection' && validation.inspectionNotes){setResaleOpen(false);requestAnimationFrame(focusError)}
      else focusError()
      return
    }
    if(status==='rejected' && !confirmRejection){setRejectionOpen(false);setRejectionConfirm(true);return}
    lock.current=true;setBusy(true)
    try {
      await adminApi.updateRefundStatus(refund.refund_request_id,status==='save_inspection'?'under_inspection':status==='mark_no_return'?'under_review':status,{
        adminNotes:notes,
        ...(status==='save_inspection'?{action:'save_inspection'}:{}),
        ...(inspect && ['save_inspection','approved','rejected'].includes(status)?{inspectionNotes:inspection,claimVerified:claim==='yes',inspectionItems,
          ...(!savedInspection && suitable==='yes'?{resaleProofImage:resaleProof,resaleConfirmed}:{}),}:{}),
        ...(status==='mark_no_return'?{action:'mark_no_return',noReturnReason:exception}:{}),
        ...(status==='return_required'?{returnInstructions:instructions}:{}),
        ...(status==='approved'?{approvedAmount:Number(amount)}:{}),
        ...(status==='refund_sent'?{refundReference:reference,proofImage:proof}:{}),
        ...(status==='completed'?{paymentConfirmed:confirmed}:{}),
      })
      setRejectionConfirm(false);setRejectionOpen(false);setResaleOpen(false)
      await onUpdated?.()
    } catch(err){setError(err.message)} finally{lock.current=false;setBusy(false)}
  }
  return <section aria-label="Admin return and refund review" className="space-y-5 rounded-xl border border-[var(--border)] p-4">
    <details className="text-sm text-[var(--text-muted)]">
      <summary className="cursor-pointer">View return and refund progress</summary>
      <div className="mt-3"><CustomerRefundProgress refund={refund} showNextStep={false} /></div>
    </details>
    <AdminRefundSteps actionTitle={actionTitle} status={refund.status} disabled={busy || reading}>
    {<>
    <h3 className="font-semibold text-[var(--text-light)]">Original order and payment</h3>
    <dl className="grid grid-cols-1 gap-3 text-sm text-[var(--text-muted)] sm:grid-cols-2">
      <div><dt>Customer</dt><dd>{refund.first_name} {refund.last_name}</dd></div>
      <div><dt>Order</dt><dd>{refund.order_number || refund.order_id}</dd></div>
      <div><dt>Original payment method</dt><dd>{formatPaymentMethod(refund.original_payment_method)}</dd></div>
      <div><dt>Requested refund</dt><dd>{formatCurrency(refund.amount_requested)}</dd></div>
      {payment && <>
        <div><dt>Original transaction</dt><dd className="break-all">{payment.reference_number || (refund.order_number ? `Order #${refund.order_number}` : 'Linked original payment')}</dd></div>
        <div><dt>Original payment amount</dt><dd>{formatCurrency(payment.amount)}</dd></div>
        <div><dt>Payment status</dt><dd>{payment.status}</dd></div>
      </>}
      {refund.approved_amount != null && <div><dt>Approved refund amount</dt><dd>{formatCurrency(refund.approved_amount)}</dd></div>}
    </dl>
    <RefundRequestItems refund={refund} />
    <p className="text-sm text-[var(--text-muted)]">Refund reason: {refund.reason}</p>
    {refund.customer_notes && <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-muted)]">Customer explanation: {refund.customer_notes}</p>}
    {refund.can_manage && <div className="space-y-2">
      <button type="button" onClick={()=>setShowOriginalProof(true)} className="text-sm text-[var(--gold-primary)] underline">View original payment proof</button>
      {showOriginalProof && <ImageZoomModal src={paymentProof} alt="Original customer payment proof" isOpen onClose={()=>setShowOriginalProof(false)} />}
    </div>}
    </>}
    {<>
    {refund.order_id && <DispatchPhotoGallery orderId={refund.order_id} allowAdd={refund.can_manage} />}
    <RefundRequestPhotos images={refund.images} />
    {refund.can_manage && receivedFiles.length > 0 && <details open className="text-sm text-[var(--text-muted)]">
      <summary>Customer-received product photos</summary>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{receivedFiles.map(kind =>
        <PrivateRefundFile key={kind} refundId={refund.refund_request_id} kind={kind} label={`Customer Received Photo ${Number(kind.match(/[0-4]$/)[0]) + 1}`} />)}</div>
    </details>}
    {!receivedFiles.length && <p className="text-sm text-[var(--text-muted)]">No customer-received product photos are attached to this request.</p>}
    {showReturnShipment && <p className="text-sm text-[var(--text-muted)]">Customer return photos and shipping details are shown in Step 3: {actionTitle}.</p>}
    </>}
    {<>
    <InspectionHistory className="space-y-4">
    {paymentStage && hasInspectionHistory && <summary className="cursor-pointer text-sm font-medium text-[var(--text-muted)]">Return and inspection details</summary>}
    {showReturnShipment && <section aria-label="Customer return shipment" className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
      <h3 className="font-semibold text-[var(--text-light)]">Customer return shipment</h3>
      <p className="text-xs text-[var(--text-muted)]">Compare the shipping details and customer photos with the item received before confirming receipt. Uploaded evidence does not confirm physical receipt.</p>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-[var(--text-muted)]">Return method</dt><dd className="mt-1 text-[var(--text-light)]">{refund.return_method === 'courier' ? 'Courier' : refund.return_method === 'pickup' ? 'Pickup / drop-off' : refund.return_method || 'Not provided'}</dd></div>
        <div><dt className="text-[var(--text-muted)]">Shipping / receipt reference</dt><dd className="mt-1 break-all text-[var(--text-light)]">{refund.return_reference || 'Not provided'}</dd></div>
        {refund.customer_return_notes && <div className="sm:col-span-2"><dt className="text-[var(--text-muted)]">Customer return notes</dt><dd className="mt-1 whitespace-pre-wrap break-words text-[var(--text-light)]">{refund.customer_return_notes}</dd></div>}
      </dl>
      {refund.can_manage && (returnFiles.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{returnFiles.map(kind => <PrivateRefundFile key={kind} refundId={refund.refund_request_id} kind={kind} label={`Customer return photo ${Number(kind.slice(-1)) + 1}`} />)}</div>
        : <p className="text-sm text-[var(--text-muted)]">No customer return photos have been submitted for this request.</p>)}
    </section>}
    <div className="space-y-2 text-sm text-[var(--text-muted)]">
      {!refundApproved && refund.admin_notes && <p className="whitespace-pre-wrap break-words">Admin remarks: {refund.admin_notes}</p>}
      {refund.return_instructions && <p className="whitespace-pre-wrap break-words">Return instructions: {refund.return_instructions}</p>}
      {refund.item_received_at && <p>Received: {new Date(refund.item_received_at).toLocaleString('en-PH')}</p>}
      {refund.inspection_notes && <p className="whitespace-pre-wrap break-words">Inspection: {refund.inspection_notes}</p>}
      {refund.claim_verified != null && <p>Claim verified: {refund.claim_verified?'Yes':'No'}</p>}
      {refund.can_manage && files.includes('inspection') && <PrivateRefundFile refundId={refund.refund_request_id} kind="inspection" label="Resale condition proof" />}
      {refund.no_return_reason && <p className="whitespace-pre-wrap break-words">Return Not Required: {refund.no_return_reason}</p>}
      {refund.rejection_reason && <p className="text-red-400 whitespace-pre-wrap break-words">Rejection reason: {refund.rejection_reason}</p>}
    </div>
    </InspectionHistory>
    {refund.has_proof && refund.can_manage && <div className="space-y-2">
      <p className="break-all text-sm text-[var(--text-muted)]">Refund transaction: {refund.refund_reference || 'Not provided'}</p>
      <PrivateRefundFile refundId={refund.refund_request_id} kind="proof" label="Proof of refund payment" />
      {refund.completed_at && <p className="text-sm text-green-400">Repayment confirmed {new Date(refund.completed_at).toLocaleString('en-PH')}</p>}
    </div>}
    {!refund.can_manage && <p className="text-sm text-[var(--text-muted)]">An authorized admin must manage this refund.</p>}
    {refund.can_manage && next.length > 0 && <fieldset disabled={busy || reading} className="space-y-4">
      {review && !noReturnRecorded && <label className="block text-sm text-[var(--text-light)]">Review action
        <select aria-label="Review action" value={mode} onChange={e=>{setMode(e.target.value);setErrors({})}} className={fieldClass}>
          <option value="return">Approve item return</option><option value="no_return">Return Not Required</option>
        </select>
      </label>}
      {review && !noReturnRecorded && mode==='return' && textField('returnInstructions','Return instructions',instructions,setInstructions,{required:true,max:2000,options:REFUND_MESSAGE_PRESETS.returnInstructions})}
      {review && !noReturnRecorded && mode==='no_return' && textField('noReturnReason','Return Not Required reason',exception,setException,{required:true,options:REFUND_MESSAGE_PRESETS.noReturnReason})}
      {inspect && <fieldset disabled={Boolean(savedInspection)} className="space-y-4">
        <label className="block text-sm text-[var(--text-light)]">Inspection notes <Required />
          <textarea ref={node=>{fields.current.inspectionNotes=node}} aria-invalid={Boolean(errors.inspectionNotes)} value={inspection} maxLength={1000} onChange={e=>{setInspection(e.target.value);setErrors(previous=>({...previous,inspectionNotes:undefined}))}} rows={3} className={fieldClass} />
        </label>
        <div role="group" aria-labelledby="refund-claim-label" aria-describedby={errors.claimVerified?'error-claimVerified':undefined}>
          <p id="refund-claim-label" className="text-sm text-[var(--text-light)]">Claim verified <Required /></p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Does the inspection confirm the customer's reported issue? This decision is separate from resale suitability.</p>
          <div className="mt-2 flex gap-2">{['yes','no'].map(value=><button key={value} type="button"
            ref={value==='yes'?node=>{fields.current.claimVerified=node}:undefined} aria-pressed={claim===value}
            onClick={()=>{setClaim(value);setErrors(previous=>({...previous,claimVerified:undefined}))}}
            className={`rounded-lg border px-5 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] ${claim===value?'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black':'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)]'} ${errors.claimVerified?'ring-1 ring-red-500':''}`}>
            {value==='yes'?'Yes':'No'}
          </button>)}</div>
        </div>
        <div role="group" aria-labelledby="refund-resale-label" aria-describedby={errors.resaleSuitable?'error-resaleSuitable':undefined}>
          <p id="refund-resale-label" className="text-sm text-[var(--text-light)]">Suitable for resale <Required /></p>
          <div className="mt-2 flex gap-2">{['yes','no'].map(value=><button key={value} type="button"
            ref={value==='yes'?node=>{fields.current.resaleSuitable=node}:undefined} aria-pressed={suitable===value}
            onClick={()=>{setSuitable(value);setErrors(previous=>({...previous,resaleSuitable:undefined,resaleProof:undefined,resaleConfirmed:undefined}));if(value==='yes'){setResaleConfirmed(false);setResaleOpen(true)}}}
            className={`rounded-lg border px-5 py-2 text-sm font-semibold ${suitable===value?'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black':'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)]'}`}>
            {value==='yes'?'Yes':'No'}
          </button>)}</div>
        </div>
      </fieldset>}
      {((review && noReturnRecorded) || inspect) && <label className="block text-sm text-[var(--text-light)]">Approved refund amount (PHP) <Required />
        <input type="number" min="0.01" max={refund.amount_requested} step="0.01" value={amount} ref={node=>{fields.current.approvedAmount=node}} onChange={e=>{setAmount(e.target.value);setErrors(previous=>({...previous,approvedAmount:undefined}))}} className={fieldClass} />
        {refund.review_context?.calculation?.suggestedAmount!=null && <p className="mt-2 text-sm">{refund.review_context.calculation.custom?'Verified cost-based amount':'Default 50% regular-product refund (editable; subject to approval)'}: {formatCurrency(refund.review_context.calculation.suggestedAmount)}. <button type="button" onClick={()=>setAmount(refund.review_context.calculation.suggestedAmount)} className="underline">Use suggested amount</button></p>}
      </label>}
      {refund.status === 'processing' && <>
        <p className="text-sm text-[var(--text-muted)]">Attach proof of the {formatCurrency(refund.approved_amount ?? refund.amount_requested)} refund sent via {formatPaymentMethod(refund.original_payment_method)}. This does not send money.</p>
        <label className="block text-sm text-[var(--text-light)]">Transaction reference (optional)
          <input value={reference} maxLength={255} onChange={e=>setReference(e.target.value)} className={fieldClass} />
        </label>
        <RefundImageInput label="Refund payment proof (required)" value={proof} onChange={value=>{setProof(value);setErrors(previous=>({...previous,proofImage:undefined}))}} disabled={busy} onBusyChange={setReading} />
      </>}
      {refund.status === 'refund_sent' && <label className="flex items-start gap-2 text-sm text-[var(--text-light)]">
        <input ref={node=>{fields.current.paymentConfirmed=node}} type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);setErrors(previous=>({...previous,paymentConfirmed:undefined}))}} className="mt-1" />
        I have verified that the actual refund payment succeeded through the original payment channel. <Required />
      </label>}
      {['inspectionNotes','claimVerified','resaleSuitable','resaleProof','resaleConfirmed','approvedAmount','proofImage','paymentConfirmed'].filter(key=>errors[key]).map(key=><p key={key} id={`error-${key}`} role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{errors[key]}</p>)}
      <div className="flex flex-wrap gap-2">{next.map(status=>{
        const Icon={return_required:Truck,approved:CheckCircle,rejected:XCircle,processing:Clock,completed:CheckCircle,item_received:PackageCheck,under_inspection:Search}[status] || Clock
        const color={return_required:'bg-blue-600 hover:bg-blue-500',approved:'bg-green-600 hover:bg-green-500',rejected:'bg-red-600 hover:bg-red-500',processing:'bg-amber-600 hover:bg-amber-500',completed:'bg-green-600 hover:bg-green-500'}[status] || 'bg-slate-600 hover:bg-slate-500'
        return <button key={status} type="button" disabled={busy||reading} onClick={()=>status==='rejected'?setRejectionOpen(true):update(status)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] disabled:opacity-50 ${color}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />{busy?'Updating...':labels[status]}</button>
      })}</div>
    </fieldset>}
    {error && <p role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{error}</p>}
    {next.length === 0 && <p className="text-sm text-[var(--text-muted)]">No further refund actions are available for this request.</p>}
    </>}
    </AdminRefundSteps>
    <Dialog.Root open={resaleOpen && inspect} onOpenChange={open=>{if(!lock.current && !reading){setResaleOpen(open);if(!open)setSuitable('')}}}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[301] flex max-h-[90dvh] w-[min(94vw,36rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)] shadow-2xl focus:outline-none">
          <div className="relative shrink-0 border-b border-[var(--border)] px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--gold-primary)]" />Return inspection</div>
            <button type="button" aria-label="Close resale confirmation" disabled={busy || reading} onClick={()=>{setResaleOpen(false);setSuitable('');setErrors({})}} className="absolute right-4 top-4 rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)] disabled:opacity-50"><X className="h-4 w-4" aria-hidden="true" /></button>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"><PackageCheck className="h-6 w-6" aria-hidden="true" /></span>
              <div>
                <Dialog.Title className="text-xl font-bold tracking-tight sm:text-2xl">Confirm suitable for resale</Dialog.Title>
                <Dialog.Description className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">Verify the returned items and attach a condition photo before adding them back to available stock.</Dialog.Description>
              </div>
            </div>
          </div>
          <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <section aria-label="Items to restock" className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="flex items-center justify-between gap-3 bg-[var(--bg-primary)] px-4 py-3">
                <h4 className="text-xs font-semibold text-[var(--text-muted)]">Items returning to stock</h4>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Resale ready</span>
              </div>
              <ul className="divide-y divide-[var(--border)]">{(refund.items || []).map(item=><li key={item.order_item_id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="flex min-w-0 items-center gap-3"><PackageCheck className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" /><span className="break-words text-sm font-semibold">{item.product_name}</span></span>
                <span className="shrink-0 rounded-lg bg-[var(--bg-primary)] px-3 py-1 text-xs font-bold tabular-nums">{item.quantity} {Number(item.quantity)===1?'unit':'units'}</span>
              </li>)}</ul>
            </section>
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Camera className="h-4 w-4 text-[var(--gold-primary)]" aria-hidden="true" /><h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Condition evidence</h4></div>
              <RefundImageInput label="Resale condition photo (required)" presentation="dropzone" value={resaleProof} onChange={setResaleProof} onBusyChange={setReading} disabled={busy} />
            </div>
            <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${resaleConfirmed?'border-emerald-500/30 bg-emerald-500/5':'border-[var(--border)] bg-[var(--bg-primary)]'}`}>
              <input type="checkbox" checked={resaleConfirmed} disabled={busy || reading} onChange={event=>setResaleConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded accent-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]" />
              <span className="text-sm leading-relaxed"><span className="mb-1 block font-semibold">Physical inspection complete</span><span className="text-[var(--text-muted)]">I confirm all listed quantities were received, inspected and are suitable for resale.</span></span>
            </label>
            {['resaleProof','resaleConfirmed','claimVerified'].filter(key=>errors[key]).map(key=><p key={key} role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{errors[key]}</p>)}
            {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
          </div>
          <div className="shrink-0 space-y-3 border-t border-[var(--border)] bg-[var(--bg-primary)] px-5 py-4 sm:px-7">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <button type="button" disabled={busy || reading} onClick={()=>{setResaleOpen(false);setSuitable('');setErrors({})}} className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-5 py-3 text-sm font-semibold transition-colors hover:border-[var(--gold-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={busy || reading} onClick={()=>update('save_inspection')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />:<CheckCircle className="h-4 w-4" aria-hidden="true" />}{busy?'Saving...':'Confirm suitability and restock'}{!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}</button>
            </div>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)]"><ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Photo evidence is saved with this inspection.</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root open={rejectionOpen && inspect} onOpenChange={open=>{if(!busy)setRejectionOpen(open)}}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[300] bg-black/75" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[301] w-[min(95vw,32rem)] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl bg-[var(--surface-dark)] p-6">
          <Dialog.Title>Admin remarks / rejection reason</Dialog.Title>
          <Dialog.Description>Provide the reason that will be shown to the customer.</Dialog.Description>
          {textField('adminNotes','Rejection reason',notes,setNotes,{required:true,options:REFUND_MESSAGE_PRESETS.adminNotes})}
          <button type="button" disabled={busy} onClick={()=>setRejectionOpen(false)}>Cancel</button>
          <button type="button" disabled={busy} onClick={()=>update('rejected')} className="ml-4 rounded-lg bg-red-600 px-4 py-2 text-white">Review rejection</button>
          {Object.keys(errors).some(key=>key!=='adminNotes') && <p role="alert">Complete the inspection fields before rejecting. Close this dialog to review the highlighted fields.</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <ConfirmModal open={rejectionConfirm && inspect} title="Confirm refund rejection" description={<span className="whitespace-pre-wrap break-words">{`Reject this refund with the following customer-visible reason: ${notes.trim()}`}{error && <span role="alert" className="mt-3 block text-red-400">{error}</span>}</span>} confirmLabel="Confirm rejection" isBusy={busy} onCancel={()=>{if(!lock.current){setRejectionConfirm(false);setRejectionOpen(true)}}} onConfirm={()=>update('rejected',true)} />
  </section>
}
