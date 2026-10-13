import { RETURN_REFUND_STEPS } from '../../utils/refundWorkflow'
export default function CustomerRefundProgress({ refund, showNextStep = true }) {
  const steps = RETURN_REFUND_STEPS.map(([,label]) => label)
  let current = Math.max(0,RETURN_REFUND_STEPS.findIndex(([key]) => key === refund.status))
  if (refund.status === 'return_pending') current = 1
  if (refund.status === 'approved' && (!refund.original_payment_method || refund.return_status === 'return_pending')) current = 1
  if (['returned','return_in_transit'].includes(refund.return_status)) current = 2
  if (refund.return_status === 'return_confirmed') current = 3
  if (refund.status === 'item_received') current = 3
  if (refund.status === 'under_inspection') current = 4
  if (refund.status === 'approved' && (refund.return_status === 'not_required' || (refund.original_payment_method && refund.return_status === 'return_confirmed'))) current = 5
  if (['processing','refund_sent'].includes(refund.status)) current = 6
  if (['completed','refunded'].includes(refund.status)) current = 7
  const terminal = ['rejected','withdrawn'].includes(refund.status)
  const nextStep = terminal ? refund.status === 'rejected'
    ? 'Review the rejection reason below. Contact the store if you need clarification.' : 'Your request was withdrawn. No further action is needed.'
    : current === 7 ? 'Your refund is complete. No further action is needed.'
    : refund.status === 'refund_sent' ? 'Refund payment has been recorded. Waiting for the admin to confirm that the payment succeeded.'
    : current === 6 ? 'Your refund payment is being processed through the original payment method. No action is needed from you.'
    : current === 5 ? 'Your refund is approved. Waiting for the admin to process the payment.'
    : current === 4 ? 'Your returned item is being inspected. Waiting for the refund decision.'
    : current === 3 ? 'The store has received your item. Waiting for inspection.'
    : current === 2 ? 'Your return evidence has been submitted. Waiting for the store to receive your item.'
    : refund.return_status === 'not_required' ? 'You do not need to return the item. Waiting for the refund decision.'
    : current === 1 ? refund.review?.shipping?.arrangement==='seller_pickup'
      ? 'Follow the store instructions for the arranged pickup, then submit your return evidence after handover.'
      : 'Please return your item using the instructions below, then submit your return evidence.'
    : 'Your request is awaiting the admin review decision. No action is needed from you.'
  return <div className="space-y-2">
    <p role="status" className={terminal ? 'text-sm text-red-400' : 'text-sm text-[var(--gold-primary)]'}>
      {terminal ? refund.status === 'rejected' ? 'Refund Rejected' : 'Request Withdrawn' : steps[current]}
      {refund.status === 'under_review' ? ' — under review' : refund.status === 'refund_sent' ? ' — payment recorded; awaiting admin confirmation' : ''}
    </p>
    {showNextStep && <p aria-label="Next step" className="text-sm text-[var(--text-muted)]"><span className="font-semibold">Next step: </span>{nextStep}</p>}
    <ol aria-label="Refund progress" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((label,index) => <li key={label} aria-current={!terminal && index === current ? 'step' : undefined}
        className={`rounded-lg border p-2 text-xs ${!terminal && index <= current ? 'border-[var(--gold-primary)] text-[var(--gold-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
        {label}{refund.return_status === 'not_required' && index > 0 && index < 5 ? ' (not required)' : ''}
      </li>)}
    </ol>
  </div>
}
