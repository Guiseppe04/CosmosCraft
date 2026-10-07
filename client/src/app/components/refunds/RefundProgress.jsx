import { REFUND_STEPS } from '../../utils/refundWorkflow'
export default function RefundProgress({ status }) {
  const current = REFUND_STEPS.findIndex(([key]) => key === status)
  return <ol aria-label="Refund progress" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {REFUND_STEPS.map(([key, label], index) => <li key={key} aria-current={key === status ? 'step' : undefined}
      className={`rounded-lg border px-3 py-2 text-xs ${index <= current ? 'border-[var(--gold-primary)] text-[var(--gold-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
      {index + 1}. {label}
    </li>)}
    {['rejected', 'withdrawn'].includes(status) && <li className="text-sm text-red-400">{status === 'rejected' ? 'Rejected' : 'Withdrawn'}</li>}
    {status === 'pending_payment_verification' && <li className="text-sm text-amber-400">Awaiting payment verification</li>}
  </ol>
}
