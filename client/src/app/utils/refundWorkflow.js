export const REFUND_STEPS = [
  ['pending', 'Refund Requested'], ['under_review', 'Under Review'], ['approved', 'Approved'],
  ['processing', 'Payment Processing'], ['refund_sent', 'Refund Sent'], ['completed', 'Completed'],
]
export const refundMethodLabel = method => method === 'e_bank' || method === 'bank_transfer' ? 'E-Bank / Bank Transfer' : 'E-Wallet'
export const emptyRefundDestination = () => ({ method: '', provider: '', accountName: '', accountNumber: '', details: '' })
export function refundDestinationError(value) {
  if (!['e_wallet', 'e_bank'].includes(value.method)) return 'Select your preferred refund method.'
  const qrOnlyAllowed = value.method === 'e_wallet' && Boolean(value.qrImage)
  const provider = (value.provider || '').trim(), name = (value.accountName || '').trim(), number = (value.accountNumber || '').trim()
  if ((!qrOnlyAllowed || provider) && provider.length < 2) return 'Enter the wallet provider or bank name.'
  if ((!qrOnlyAllowed || name) && name.length < 2) return 'Enter the account name.'
  if ((!qrOnlyAllowed || number) && !/^[0-9+ -]{5,40}$/.test(number)) return 'Enter a valid account or mobile number (5–40 characters).'
  return ''
}
