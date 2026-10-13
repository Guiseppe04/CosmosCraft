const FULFILLMENT_STEPS = [
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
]

export function getFulfillmentProgress(order) {
  const status = String(order?.status || '').trim().toLowerCase()
  const completed = ['delivered', 'received', 'completed'].includes(status)
  const statusKey = completed ? 'delivered' : status
  const currentIndex = FULFILLMENT_STEPS.findIndex(step => step.key === statusKey)
  if (currentIndex === -1) return null
  return {
    currentIndex,
    steps: FULFILLMENT_STEPS.map((step, index) => ({
      ...step,
      state: completed || index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming',
    })),
  }
}

export function getOrderDisplayTotal(order) {
  const total = Number(order.total_amount || 0)
  if (total > 0) {
    // Older orders included shipping in the saved total. The admin quote is paid separately.
    const legacyShipping = Number(order.shipping_cost ?? order.shipping_fee ?? 0) || 0
    const tax = Number(order.tax_amount || 0) || 0
    return Math.max(total - tax - legacyShipping, 0)
  }
  return Math.max((Number(order.subtotal || 0) || 0) - (Number(order.discount_amount || 0) || 0), 0)
}
