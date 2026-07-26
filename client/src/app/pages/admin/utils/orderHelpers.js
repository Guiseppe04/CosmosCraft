export function extractOrderPaymentMethod(order = {}) {
  const rawMethod = String(order.payment_method || order.payment?.method || '').toLowerCase()
  if (!rawMethod) return 'unknown'
  if (rawMethod.includes('cod') || rawMethod.includes('cash')) return 'cash'
  if (rawMethod.includes('gcash') || rawMethod.includes('g-cash')) return 'gcash'
  if (rawMethod.includes('bank') || rawMethod.includes('transfer') || rawMethod.includes('bdo') || rawMethod.includes('bpi') || rawMethod.includes('unionbank')) return 'bank_transfer'
  return rawMethod
}

export function isCashOnDeliveryOrder(order = {}) {
  return extractOrderPaymentMethod(order) === 'cash'
}
