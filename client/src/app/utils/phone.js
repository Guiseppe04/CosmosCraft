/**
 * Philippine mobile number rules shared by every phone input in the app.
 *
 * Valid formats (both exactly 11 significant digits):
 *   09XXXXXXXXX
 *   +639XXXXXXXXX
 *
 * Anything else — letters, spaces, dashes, parentheses — is rejected so stored
 * contact numbers always match this shape.
 */

export const PHONE_REGEX = /^(9\d{9}|09\d{9}|\+639\d{9})$/

export const PHONE_ERROR_MESSAGE =
  'Please enter 10 digits starting with 9 after +63 (e.g. 9661341242).'

/**
 * Keeps digits only. A single leading "+" is preserved so the +63 international
 * format can be typed; every other character is discarded as it is entered.
 */
export function sanitizePhoneInput(value) {
  const raw = String(value ?? '')
  const digitsOnly = raw.replace(/\D/g, '')
  if (!raw.trim().startsWith('+')) return digitsOnly
  return digitsOnly ? `+${digitsOnly}` : '+'
}

export function isValidPhoneNumber(value) {
  return PHONE_REGEX.test(String(value ?? '').trim())
}

/** Sanitized value when valid, otherwise undefined so it is omitted from payloads. */
export function normalizePhoneForSubmit(value) {
  const sanitized = sanitizePhoneInput(value).trim()
  return isValidPhoneNumber(sanitized) ? `+63${getPhoneSubscriber(sanitized)}` : undefined
}

export function getPhoneSubscriber(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('63')) return digits.slice(2)
  if (digits.startsWith('0')) return digits.slice(1)
  return digits
}

// Delivery rider input accepts PH local/international numbers and stores +63.
export function normalizeRiderContact(value) {
  const input = String(value ?? '').trim().replace(/\s+/g, '')
  if (/^9\d{9}$/.test(input)) return `+63${input}`
  if (/^09\d{9}$/.test(input)) return `+63${input.slice(1)}`
  return /^\+639\d{9}$/.test(input) ? input : null
}
