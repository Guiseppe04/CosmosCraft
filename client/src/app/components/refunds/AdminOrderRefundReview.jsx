import { useRef, useState } from 'react'
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
import { CheckCircle, XCircle, Truck, Clock, Search, PackageCheck } from 'lucide-react'

const actions = {
  pending:['under_review','return_required','approved','rejected'],
  under_review:['return_required','approved','rejected'],
  return_required:['item_received','rejected'],return_in_transit:['item_received','rejected'],
  return_pending:['item_received','rejected'],returned:['item_received','rejected'],
  item_received:['under_inspection','rejected'],under_inspection:['approved','rejected'],
  approved:['processing'],processing:['refund_sent','rejected'],refund_sent:['completed'],
}
const labels = {mark_no_return:'Mark Return Not Required',under_review:'Start review',return_required:'Approve return',item_received:'Confirm item received',
  under_inspection:'Start inspection',approved:'Approve refund',processing:'Start refund processing',
  refund_sent:'Record refund payment',completed:'Complete refund',rejected:'Reject refund'}
const fieldClass = 'mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-light)]'
const Required = () => <span style={{ color: '#ef4444' }} className="text-red-400">*</span>

export default function AdminOrderRefundReview({ refund, onUpdated }) {
  const [notes,setNotes] = useState(''), [instructions,setInstructions] = useState(refund.return_instructions || '')
  const [customNotes,setCustomNotes] = useState('')
  const [customInstructions,setCustomInstructions] = useState(refund.return_instructions || '')
  const [exception,setException] = useState(''), [inspection,setInspection] = useState(refund.inspection_notes || '')
  const [suitable,setSuitable] = useState(''), [amount,setAmount] = useState(refund.approved_amount ?? refund.review_context?.calculation?.suggestedAmount ?? refund.amount_requested)
  const [claim,setClaim] = useState('')
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
  const next = review ? noReturnRecorded ? ['approved','rejected'] : [mode === 'no_return' ? 'mark_no_return' : mode === 'reject' ? 'rejected' : 'return_required']
    : refund.status === 'approved' && ['return_pending','returned','return_in_transit'].includes(refund.return_status)
      ? ['item_received','rejected'] : actions[refund.status] || []
  const files = refund.private_files || []
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
    if ((status === 'approved' || status === 'rejected') && inspect && !inspection.trim()) result.inspectionNotes='Inspection notes are required.'
    if ((status === 'approved' || status === 'rejected') && inspect && !claim) result.claimVerified='Select whether the customer claim was verified during inspection.'
    if (status === 'approved' && inspect && claim==='no') result.claimVerified='The customer claim must be verified before approving the refund.'
    if (status === 'approved') {
      const calculation=refund.review_context?.calculation;
      if(calculation?.custom && calculation.requiresVerifiedCosts) result.approvedAmount='Verified material/base value, incurred labor and supporting evidence are required before approving this customized guitar refund.'
      else if(calculation?.custom && Number(amount)>calculation.maximum) result.approvedAmount=`The verified customized guitar refund limit is ${formatCurrency(calculation.maximum)}.`
      if (!Number.isFinite(Number(amount)) || Number(amount)<=0 || Number(amount)>Number(refund.amount_requested)) result.approvedAmount='Enter a positive amount up to the requested refund.'
      if (inspect && !suitable) result.resaleSuitable='Select whether the item is suitable for resale.'
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
  async function update(status) {
    if (lock.current || reading) return
    const validation=validate(status);setErrors(validation);setError('')
    if(Object.keys(validation).length){const field=fields.current[Object.keys(validation)[0]];field?.focus();field?.scrollIntoView({block:'center',behavior:'smooth'});return}
    lock.current=true;setBusy(true)
    try {
      await adminApi.updateRefundStatus(refund.refund_request_id,status==='mark_no_return'?'under_review':status,{
        adminNotes:notes,
        ...(status==='mark_no_return'?{action:'mark_no_return',noReturnReason:exception}:{}),
        ...(status==='return_required'?{returnInstructions:instructions}:{}),
        ...(status==='approved'?{approvedAmount:Number(amount),...(inspect?{inspectionNotes:inspection,resaleSuitable:suitable==='yes',claimVerified:claim==='yes'}:{})}:{}),
        ...(status==='rejected'&&inspect?{inspectionNotes:inspection,claimVerified:claim==='yes'}:{}),
        ...(status==='refund_sent'?{refundReference:reference,proofImage:proof}:{}),
        ...(status==='completed'?{paymentConfirmed:confirmed}:{}),
      })
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
    {refund.can_manage && files.filter(kind => /^(evidence|return)_?[0-4]$/.test(kind)).length > 0 && <details open className="text-sm text-[var(--text-muted)]">
      <summary>Supporting and return evidence</summary>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{files.filter(kind => /^(evidence|return)_?[0-4]$/.test(kind)).map(kind =>
        <PrivateRefundFile key={kind} refundId={refund.refund_request_id} kind={kind} label={`${kind.startsWith('return') ? 'Return evidence' : 'Customer Received Photo'} ${Number(kind.match(/[0-4]$/)[0]) + 1}`} />)}</div>
    </details>}
    {!files.some(kind => /^(evidence|return)_?[0-4]$/.test(kind)) && <p className="text-sm text-[var(--text-muted)]">No supporting or return evidence is attached to this request.</p>}
    </>}
    {<>
    <div className="space-y-2 text-sm text-[var(--text-muted)]">
      {!refundApproved && refund.admin_notes && <p className="whitespace-pre-wrap break-words">Admin remarks: {refund.admin_notes}</p>}
      {refund.return_instructions && <p className="whitespace-pre-wrap break-words">Return instructions: {refund.return_instructions}</p>}
      {refund.return_reference && <p className="break-all">Return reference: {refund.return_reference}</p>}
      {refund.customer_return_notes && <p className="whitespace-pre-wrap break-words">Customer return notes: {refund.customer_return_notes}</p>}
      {refund.item_received_at && <p>Received: {new Date(refund.item_received_at).toLocaleString('en-PH')}</p>}
      {refund.inspection_notes && <p className="whitespace-pre-wrap break-words">Inspection: {refund.inspection_notes}</p>}
      {refund.claim_verified != null && <p>Claim verified: {refund.claim_verified?'Yes':'No'}</p>}
      {refund.no_return_reason && <p className="whitespace-pre-wrap break-words">Return Not Required: {refund.no_return_reason}</p>}
      {refund.rejection_reason && <p className="text-red-400 whitespace-pre-wrap break-words">Rejection reason: {refund.rejection_reason}</p>}
    </div>
    {refund.has_proof && refund.can_manage && <div className="space-y-2">
      <p className="break-all text-sm text-[var(--text-muted)]">Refund transaction: {refund.refund_reference || 'Not provided'}</p>
      <PrivateRefundFile refundId={refund.refund_request_id} kind="proof" label="Proof of refund payment" />
      {refund.completed_at && <p className="text-sm text-green-400">Repayment confirmed {new Date(refund.completed_at).toLocaleString('en-PH')}</p>}
    </div>}
    {!refund.can_manage && <p className="text-sm text-[var(--text-muted)]">An authorized admin must manage this refund.</p>}
    {refund.can_manage && next.length > 0 && <fieldset disabled={busy || reading} className="space-y-4">
      {review && !noReturnRecorded && <label className="block text-sm text-[var(--text-light)]">Review action
        <select aria-label="Review action" value={mode} onChange={e=>{setMode(e.target.value);setErrors({})}} className={fieldClass}>
          <option value="return">Approve item return</option><option value="no_return">Return Not Required</option><option value="reject">Reject request</option>
        </select>
      </label>}
      {!refundApproved && textField('adminNotes','Admin remarks / rejection reason',notes,setNotes,{required:mode==='reject'||Boolean(errors.adminNotes),options:REFUND_MESSAGE_PRESETS.adminNotes})}
      {refundApproved && next.includes('rejected') && textField('adminNotes','Rejection reason',notes,setNotes,{options:REFUND_MESSAGE_PRESETS.adminNotes})}
      {review && !noReturnRecorded && mode==='return' && textField('returnInstructions','Return instructions',instructions,setInstructions,{required:true,max:2000,options:REFUND_MESSAGE_PRESETS.returnInstructions})}
      {review && !noReturnRecorded && mode==='no_return' && textField('noReturnReason','Return Not Required reason',exception,setException,{required:true,options:REFUND_MESSAGE_PRESETS.noReturnReason})}
      {inspect && <>
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
            onClick={()=>{setSuitable(value);setErrors(previous=>({...previous,resaleSuitable:undefined}))}}
            className={`rounded-lg border px-5 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] ${suitable===value?'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black':'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)]'} ${errors.resaleSuitable?'ring-1 ring-red-500':''}`}>
            {value==='yes'?'Yes':'No'}
          </button>)}</div>
        </div>
        <p className="text-xs text-[var(--text-muted)]">Inspection does not automatically restock the item.</p>
      </>}
      {((review && noReturnRecorded) || inspect) && <label className="block text-sm text-[var(--text-light)]">Approved refund amount (PHP) <Required />
        <input type="number" min="0.01" max={refund.amount_requested} step="0.01" value={amount} ref={node=>{fields.current.approvedAmount=node}} onChange={e=>{setAmount(e.target.value);setErrors(previous=>({...previous,approvedAmount:undefined}))}} className={fieldClass} />
        {refund.review_context?.calculation?.suggestedAmount!=null && <p className="mt-2 text-sm">{refund.review_context.calculation.custom?'Verified cost-based amount':'Default 50% regular-product refund (editable; subject to approval)'}: {formatCurrency(refund.review_context.calculation.suggestedAmount)}. <button type="button" onClick={()=>setAmount(refund.review_context.calculation.suggestedAmount)} className="underline">Use suggested amount</button></p>}
      </label>}
      {refund.status === 'processing' && <>
        <p className="text-sm text-[var(--text-muted)]">Process the repayment through {formatPaymentMethod(refund.original_payment_method)} using the original transaction. Record the actual payment evidence below.</p>
        <p className="text-sm text-[var(--text-muted)]">This records a payment already sent. It does not transfer money.</p>
        <label className="block text-sm text-[var(--text-light)]">Refund transaction reference (optional)
          <input value={reference} maxLength={255} onChange={e=>setReference(e.target.value)} className={fieldClass} />
          <span className="text-xs text-[var(--text-muted)]">Optional; a reference helps reconcile the repayment.</span>
        </label>
        <RefundImageInput label="Refund payment proof (required)" value={proof} onChange={value=>{setProof(value);setErrors(previous=>({...previous,proofImage:undefined}))}} disabled={busy} onBusyChange={setReading} />
      </>}
      {refund.status === 'refund_sent' && <label className="flex items-start gap-2 text-sm text-[var(--text-light)]">
        <input ref={node=>{fields.current.paymentConfirmed=node}} type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);setErrors(previous=>({...previous,paymentConfirmed:undefined}))}} className="mt-1" />
        I have verified that the actual refund payment succeeded through the original payment channel. <Required />
      </label>}
      {['inspectionNotes','claimVerified','resaleSuitable','approvedAmount','proofImage','paymentConfirmed'].filter(key=>errors[key]).map(key=><p key={key} id={`error-${key}`} role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{errors[key]}</p>)}
      <div className="flex flex-wrap gap-2">{next.map(status=>{
        const Icon={return_required:Truck,approved:CheckCircle,rejected:XCircle,processing:Clock,completed:CheckCircle,item_received:PackageCheck,under_inspection:Search}[status] || Clock
        const color={return_required:'bg-blue-600 hover:bg-blue-500',approved:'bg-green-600 hover:bg-green-500',rejected:'bg-red-600 hover:bg-red-500',processing:'bg-amber-600 hover:bg-amber-500',completed:'bg-green-600 hover:bg-green-500'}[status] || 'bg-slate-600 hover:bg-slate-500'
        return <button key={status} type="button" disabled={busy||reading} onClick={()=>update(status)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] disabled:opacity-50 ${color}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />{busy?'Updating...':labels[status]}</button>
      })}</div>
    </fieldset>}
    {error && <p role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{error}</p>}
    {next.length === 0 && <p className="text-sm text-[var(--text-muted)]">No further refund actions are available for this request.</p>}
    </>}
    </AdminRefundSteps>
  </section>
}
