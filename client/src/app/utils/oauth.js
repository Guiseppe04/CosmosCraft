import { API, setAuthToken } from './apiConfig.js'

const verifierKey = 'cosmoscraft.oauth.verifier'
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
let completion

export async function startGoogleLogin() {
  const verifier = hex(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  // Fail closed if storage is unavailable; the callback requires this proof.
  sessionStorage.setItem(verifierKey, verifier)
  window.location.assign(`${API}/auth/google?challenge=${challenge}`)
}

export function completeOAuth() {
  // Share the exchange across React StrictMode effects and concurrent callers.
  // Retain the settled promise too: a failed exchange must start a new login.
  if (completion) return completion
  const handoff = new URLSearchParams(window.location.hash.slice(1)).get('handoff')
  window.history.replaceState(window.history.state, '', '/auth/success')
  if (!handoff) return Promise.resolve()
  completion = (async () => {
    const verifier = sessionStorage.getItem(verifierKey)
    sessionStorage.removeItem(verifierKey)
    if (!verifier) throw new Error('Sign-in must be completed in the tab that started it.')
    const response = await fetch(`${API}/auth/oauth/complete`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoff, verifier }),
    })
    if (!response.ok) throw new Error('Sign-in expired or was already completed. Please start again.')
    const data = await response.json()
    if (!data.data?.accessToken) throw new Error('Sign-in could not be completed.')
    setAuthToken(data.data.accessToken)
  })()
  return completion
}
