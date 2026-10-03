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

export const PHONE_REGEX = /^(09\d{9}|\+639\d{9})$/

export const PHONE_ERROR_MESSAGE =
  'Phone number must be 11 digits starting with 09 or in +63 format (e.g. +639123456789)'

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
  return isValidPhoneNumber(sanitized) ? sanitized : undefined
}
