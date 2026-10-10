import versions from '../../../../shared/termsVersions.json'
import { API, getAuthHeaders } from './apiConfig'

export { versions as TERMS_VERSIONS }
export const accountAgreement = () => ({ agreed: true, versions: { account: versions.account } })

export function createCheckoutId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  // getRandomValues also works when testing mobile devices over a local HTTP network.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function saveAgreement(path, agreement) {
  const response = await fetch(`${API}/auth/terms/${path}`, {
    method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include', body: JSON.stringify(agreement),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Unable to record acknowledgment. Please try again.')
  return data.data
}
