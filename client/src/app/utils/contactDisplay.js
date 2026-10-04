// Display-only normalization: retain every subscriber digit from settings.
export function formatContactPhone(value) {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  let subscriber
  if (digits.startsWith('63')) subscriber = digits.slice(2)
  else if (digits.startsWith('0')) subscriber = digits.slice(1)
  else if (digits.startsWith('9')) subscriber = digits
  else return raw
  return `+63 ${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`.trim()
}
