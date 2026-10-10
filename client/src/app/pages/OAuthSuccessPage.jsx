import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext.jsx'
import { setAuthToken } from '../utils/apiConfig'

import { getAuthDestination, takeAuthReturnPath } from '../utils/authRedirect.js'

export function OAuthSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login, fetchUser } = useAuth()
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const initializationStarted = useRef(false)

  useEffect(() => {
    if (initializationStarted.current) return
    initializationStarted.current = true
    const userId = searchParams.get('userId')
    const token = searchParams.get('token') || searchParams.get('accessToken')
    const returnPath = takeAuthReturnPath()
    const fallbackPath = '/login'

    if (token) {
      setAuthToken(token)
    }

    if (!userId && !token) {
      setError('Authentication failed. Please try again.')
      setTimeout(() => navigate(fallbackPath, { replace: true }), 800)
      return
    }

    // Fetch the authenticated user data from backend
    const initializeUser = async () => {
      try {
        const userData = await fetchUser()

        if (userData) {
          await login(userData, token)
          navigate(getAuthDestination(userData.role, returnPath, window.location.origin), { replace: true })
          return
        }

        setError('Failed to load user data')
        setTimeout(() => navigate(fallbackPath, { replace: true }), 800)
      } catch (err) {
        console.error('Auth initialization error:', err)
        setError('Failed to complete authentication')
        setTimeout(() => navigate(fallbackPath, { replace: true }), 800)
      } finally {
        setIsLoading(false)
      }
    }

    initializeUser()
  }, [searchParams, navigate, login, fetchUser])

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
