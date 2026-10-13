import { API, getAuthHeaders, getAuthToken, setAuthToken, removeAuthToken } from './apiConfig.js'

let refreshPromise

function clearSession() {
  removeAuthToken()
  window.localStorage.removeItem('cosmoscraft_auth')
  window.dispatchEvent(new Event('cosmoscraft:session-expired'))
}

async function refreshSession() {
  const sessionToken = getAuthToken()
  const response = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
  if (!response.ok) {
    if (sessionToken === getAuthToken() && (response.status === 401 || response.status === 403)) clearSession()
    const error = new Error('Unable to renew your session. Please try again.')
    error.status = response.status
    throw error
  }
  const data = await response.json()
  if (!data.data?.accessToken) throw new Error('Invalid session renewal response. Please try again.')
  if (sessionToken === getAuthToken()) setAuthToken(data.data.accessToken)
}

// One refresh per group of failed requests, with at most one retry per request.
export async function authFetch(url, options = {}) {
  const sentToken = getAuthToken()
  const send = () => fetch(url, { ...options, credentials: 'include', headers: getAuthHeaders(options.headers) })
  let response = await send()
  const renewedToken = response.headers.get('X-New-Access-Token')
  if (renewedToken && sentToken === getAuthToken()) setAuthToken(renewedToken)
  const path = new URL(url, window.location.origin).pathname
  const excluded = /\/(?:api\/)?auth\/(?!check$|terms\/)/.test(path)
  if (response.status !== 401 || excluded) return response

  if (sentToken === getAuthToken()) {
    if (!refreshPromise) refreshPromise = refreshSession().finally(() => { refreshPromise = null })
    await refreshPromise
  }
  // Replace an explicit old Authorization header when retrying.
  const headers = { ...options.headers }
  delete headers.Authorization
  delete headers.authorization
  response = await fetch(url, { ...options, credentials: 'include', headers: getAuthHeaders(headers) })
  const token = response.headers.get('X-New-Access-Token')
  if (token) setAuthToken(token)
  return response
}
