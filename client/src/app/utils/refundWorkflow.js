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

export const RETURN_REFUND_STEPS = [
  ['pending','Pending Review'],['return_required','Return Required'],['return_in_transit','Return in Transit'],
  ['item_received','Item Received'],['under_inspection','Under Inspection'],['approved','Refund Approved'],
  ['processing','Refund Processing'],['completed','Refund Completed'],
]

export const refundStatusLabel = status => Object.fromEntries(RETURN_REFUND_STEPS)[status] || ({under_review:'Pending Review',refund_sent:'Refund Processing',rejected:'Refund Rejected',withdrawn:'Request Withdrawn',returned:'Return in Transit',return_pending:'Return Required',return_confirmed:'Item Received',refunded:'Refund Completed'})[status] || status

export function adminRefundTextError(value,label) {
  const text = (value || '').trim()
  return (text.match(/[\p{L}\p{N}]/gu) || []).length >= 10 && !/^other(?:\s*\(please specify\))?$/i.test(text)
    ? '' : `${label} ${/instructions$/i.test(label) ? 'are' : 'is'} required. Please enter at least 10 meaningful characters.`
}
export const REFUND_MESSAGE_PRESETS = {
  adminNotes: ['Insufficient supporting evidence','Item does not meet return conditions','Return request is outside the applicable return period','Incorrect or incomplete request information','Product condition requires further verification','Item has not been returned','Returned item does not match the original order','Return shipment could not be verified'],
  returnInstructions: ['Please securely pack the item and return it using J&T Express or another suitable courier.','Please return the item with its original accessories and packaging, if available.','Please provide the courier tracking number after shipping the item.','Please upload a clear photo of the shipping receipt as proof of return.','Please ensure the item is properly protected against shipping damage.'],
  noReturnReason: ['Order was cancelled before shipment','Item has not been dispatched','Refund concerns a service or appointment','Duplicate or excess payment','Refund can be processed without a physical return','Return requirement waived by management'],
}
