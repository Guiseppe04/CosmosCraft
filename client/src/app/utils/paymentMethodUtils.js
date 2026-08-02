const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  e_wallet: 'E-Wallet',
  e_bank: 'E-Bank',
  gcash: 'GCash',
  bank_transfer: 'Bank Transfer',
}

export function formatPaymentMethod(method) {
  if (!method) return 'Not Specified'
  return PAYMENT_METHOD_LABELS[method] || method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
