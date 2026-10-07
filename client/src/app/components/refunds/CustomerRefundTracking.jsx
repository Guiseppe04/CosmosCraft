import { useState } from 'react'
import RefundProgress from './RefundProgress'
import PrivateRefundFile from './PrivateRefundFile'
import { adminApi } from '../../utils/adminApi'
import { formatCurrency } from '../../utils/formatCurrency'
import { refundMethodLabel } from '../../utils/refundWorkflow'

export default function CustomerRefundTracking({ order, onRefresh }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  const sent = ['refund_sent', 'completed'].includes(order.refund_request_status)
  async function confirm() {
    setBusy(true); setError('')
    try { await adminApi.confirmRefund(order.refund_request_id); setSuccess('Refund receipt confirmed.'); await onRefresh?.() }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <section aria-label="Refund tracking" className="mt-4 space-y-4 rounded-xl border border-[var(--border)] p-4">
    <h3 className="text-sm font-semibold text-[var(--text-light)]">Refund tracking</h3>
    <RefundProgress status={order.refund_request_status} />
    <p className="text-sm text-[var(--text-muted)]">Preferred method: {refundMethodLabel(order.refund_preferred_method)}</p>
    {sent && <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--text-light)]">Admin payment confirmation</h4>
      <dl className="grid grid-cols-1 gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-2">
        <div><dt>Refund amount</dt><dd className="text-[var(--text-light)]">{formatCurrency(order.refund_refunded_amount)}</dd></div>
        <div><dt>Refund method</dt><dd>{refundMethodLabel(order.refund_preferred_method)}</dd></div>
        <div><dt>Sent</dt><dd>{order.refund_sent_at ? new Date(order.refund_sent_at).toLocaleString('en-PH') : '—'}</dd></div>
        <div><dt>Transaction reference</dt><dd className="break-all">{order.refund_reference || 'Not provided'}</dd></div>
      </dl>
      <PrivateRefundFile refundId={order.refund_request_id} kind="proof" label="Proof of refund payment" />
      {order.refund_request_status === 'refund_sent' && <button type="button" disabled={busy || Boolean(success)} onClick={confirm}
        className="rounded-lg bg-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Confirming…' : 'Confirm refund received'}</button>}
      {order.refund_completed_at && <p className="text-sm text-green-400">Completed {new Date(order.refund_completed_at).toLocaleString('en-PH')}</p>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {success && <p role="status" className="text-sm text-green-400">{success}</p>}
  </section>
}
