import { API } from './apiConfig'

export const DEFAULT_SITE_CONTACT = {
  email: 'cosmosguitars@gmail.com',
  phone: '+095213121581',
}
export const SITE_CONTACT_STORAGE_KEY = 'cosmoscraft.site.contact'
export const SITE_CONTACT_UPDATED_EVENT = 'cosmoscraft-site-contact-updated'

const listeners = new Set()
let revision = 0
let pendingRequest = null

function parseContact(value) {
  if (typeof value?.email !== 'string' || typeof value?.phone !== 'string') return null
  const email = value.email.trim()
  const phone = value.phone.trim()
  return email && phone ? { email, phone } : null
}

function readCachedContact() {
  if (typeof window === 'undefined') return null
  try {
    return parseContact(JSON.parse(window.localStorage.getItem(SITE_CONTACT_STORAGE_KEY)))
  } catch {
    return null
  }
}

let contact = readCachedContact() || DEFAULT_SITE_CONTACT

function applyContact(value, persist = true) {
  const next = parseContact(value)
  if (!next) return contact
  if (persist && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SITE_CONTACT_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Live updates still work when browser storage is unavailable.
    }
  }
  if (next.email !== contact.email || next.phone !== contact.phone) {
    revision += 1
    contact = next
    listeners.forEach((listener) => listener())
  }
  return contact
}

export function getSiteContactSnapshot() {
  return contact
}

export function publishSiteContact(value) {
  revision += 1
  const saved = applyContact(value)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SITE_CONTACT_UPDATED_EVENT, { detail: saved }))
  }
  return saved
}

const onStorage = (event) => {
  if (event.key === SITE_CONTACT_STORAGE_KEY) applyContact(readCachedContact(), false)
}
const onContactUpdated = (event) => applyContact(event.detail)

export function subscribeSiteContact(listener) {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    applyContact(readCachedContact(), false)
    window.addEventListener('storage', onStorage)
    window.addEventListener(SITE_CONTACT_UPDATED_EVENT, onContactUpdated)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SITE_CONTACT_UPDATED_EVENT, onContactUpdated)
    }
  }
}

export function refreshSiteContact() {
  if (pendingRequest) return pendingRequest
  const startedAtRevision = revision
  pendingRequest = Promise.resolve()
    .then(() => fetch(`${API}/api/contact/settings`))
    .then(async (response) => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to load contact information')
      // An older request must not replace settings saved while it was loading.
      if (revision === startedAtRevision) applyContact(result.data)
      return contact
    })
    .catch(() => contact)
    .finally(() => { pendingRequest = null })
  return pendingRequest
}
