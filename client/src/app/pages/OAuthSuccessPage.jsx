import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext.jsx'

import { getAuthDestination, takeAuthReturnPath } from '../utils/authRedirect.js'

export function OAuthSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, isAuthenticated, isRestoringSession } = useAuth()
  const [error, setError] = useState(null)
  const redirectStarted = useRef(false)

  useEffect(() => {
    if (redirectStarted.current) return
    const userId = searchParams.get('userId')
    const token = searchParams.get('token') || searchParams.get('accessToken')
    const fallbackPath = '/login'
    const validCallback = Boolean(userId || token)
    if (validCallback && isRestoringSession) return

    if (validCallback && isAuthenticated && user) {
      redirectStarted.current = true
      const returnPath = takeAuthReturnPath()
      navigate(getAuthDestination(user.role, returnPath, window.location.origin), { replace: true })
      return
    }

    setError(validCallback ? 'Unable to complete sign-in. Please try again.' : 'Authentication failed. Please try again.')
    const timer = setTimeout(() => navigate(fallbackPath, { replace: true }), 800)
    return () => clearTimeout(timer)
  }, [searchParams, navigate, user, isAuthenticated, isRestoringSession])

  if (error) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-8 text-center shadow-2xl">
          <p className="mb-2 text-red-400">{error}</p>
          <p className="text-sm text-[var(--text-muted)]">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-8 text-center shadow-2xl">
        <div className="mb-6 flex justify-center">
          <img src="/logo-cosmos.png" alt="CosmosCraft Logo" className="h-16 w-auto object-contain" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white">Signing In</h2>
        <p className="mb-6 text-sm text-[var(--text-muted)]">Completing your login...</p>
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--gold-primary)]" />
      </div>
    </div>
  )
}
