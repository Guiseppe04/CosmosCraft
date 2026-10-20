export function canRequestOrderRefund(order) {
  if (order.payment_status === 'refunded') return false
  const cancelledByCustomer = order.status === 'cancelled' && /Customer cancellation reason \(/.test(order.notes || '')
  const paymentSubmitted = Number(order.payment?.amount) > 0 && ['pending', 'for_verification', 'verified'].includes(order.payment?.status)
  const completeCancellationForm = cancelledByCustomer && paymentSubmitted && order.refund_workflow_version !== 2 &&
    ['pending', 'pending_payment_verification', 'approved', 'processing'].includes(order.refund_request_status)
  return completeCancellationForm || (!order.has_refund_request &&
    (['received', 'delivered'].includes(order.status) || (cancelledByCustomer && paymentSubmitted)))
}
