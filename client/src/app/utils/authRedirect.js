import { normalizeRole } from './roles.js'

export function getAuthDestination(role, returnTo, origin) {
  const normalizedRole = normalizeRole(role)
  const fallback = normalizedRole === 'admin' ? '/admin' : normalizedRole === 'staff' ? '/staff' : '/dashboard'
  if (!returnTo) return fallback
  try {
    const target = new URL(returnTo, origin)
    const path = target.pathname.replace(/\/+$/, '').toLowerCase()
    if (target.origin !== origin || path === '/auth' || path.startsWith('/auth/') ||
      ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-otp'].includes(path)) return fallback
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}

export function takeAuthReturnPath() {
  try {
    const returnTo = window.sessionStorage.getItem('cosmoscraft.auth.returnTo')
    window.sessionStorage.removeItem('cosmoscraft.auth.returnTo')
    return returnTo
  } catch {
    return null
  }
}
