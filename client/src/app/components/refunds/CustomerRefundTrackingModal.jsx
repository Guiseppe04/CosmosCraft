import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import CustomerRefundTracking from './CustomerRefundTracking'
import CustomerRefundProgress from './CustomerRefundProgress'
import CustomerRefundReviewLoader from './CustomerRefundReviewLoader'
import { adminApi } from '../../utils/adminApi'

export default function CustomerRefundTrackingModal({ order, onClose, onRefresh, onNotify }) {
  const dialog = useRef(null)
  const [withdrawing, setWithdrawing] = useState(false), [error, setError] = useState('')
  const withdrawLock = useRef(false)
  useEffect(() => {
    const element = dialog.current, opener = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  async function withdraw() {
    if (withdrawLock.current) return
    withdrawLock.current = true; setWithdrawing(true); setError('')
    try {
      await adminApi.withdrawRefund(order.refund_request_id)
      await onRefresh?.()
      onNotify?.('Refund request withdrawn.')
    } catch (err) { setError(`Failed to withdraw refund: ${err.message}`) }
    finally { withdrawLock.current = false; setWithdrawing(false) }
  }
  return createPortal(<dialog ref={dialog} aria-labelledby="customer-refund-tracking-title"
    onCancel={event => {
      event.preventDefault()
      // Escape closes an enlarged photo first, leaving tracking open.
      if (!dialog.current.querySelector('[role="dialog"]')) onClose()
    }}
    onClick={event => {
      if (event.target !== dialog.current) return
      const bounds = dialog.current.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-0 text-[var(--text-light)] shadow-2xl backdrop:bg-black/70">
    <div className="flex max-h-[90dvh] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] p-4 sm:p-5">
        <div><h2 id="customer-refund-tracking-title" className="text-lg font-semibold">Return &amp; refund tracking</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Order #{order.order_number || order.order_id}</p></div>
        <button type="button" onClick={onClose} aria-label="Close refund tracking" className="rounded-lg p-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)]"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-5">
        {order.refund_workflow_version === 2 ? <CustomerRefundTracking key={order.refund_request_id} order={order} onRefresh={onRefresh} /> : <>
          <CustomerRefundProgress refund={{ status: order.refund_request_status }} />
          {(order.refund_rejection_reason || order.refund_admin_notes) && <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-muted)]">{order.refund_rejection_reason || order.refund_admin_notes}</p>}
          <CustomerRefundReviewLoader refundId={order.refund_request_id} onUpdated={onRefresh} />
        </>}
        {error && <p role="alert" style={{ color: '#ef4444' }} className="text-sm">{error}</p>}
      </div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--border)] p-4">
        {['received', 'delivered'].includes(order.status) && ['pending', 'pending_payment_verification'].includes(order.refund_request_status) && <button type="button" disabled={withdrawing} onClick={withdraw} className="rounded-lg border border-slate-500/30 px-4 py-2 text-sm font-semibold text-slate-400 disabled:opacity-50">{withdrawing ? 'Withdrawing...' : 'Withdraw Refund'}</button>}
        <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">Close</button>
      </footer>
    </div>
  </dialog>, document.body)
}
