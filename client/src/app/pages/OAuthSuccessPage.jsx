import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext.jsx'
import { setAuthToken } from '../utils/apiConfig'

function getOAuthReturnPath() {
  try {
    const returnTo = window.sessionStorage.getItem('cosmoscraft.auth.returnTo')
    window.sessionStorage.removeItem('cosmoscraft.auth.returnTo')
    if (!returnTo) return '/'

    const target = new URL(returnTo, window.location.origin)
    if (target.origin !== window.location.origin || target.pathname === '/auth/success') return '/'
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return '/'
  }
}

export function OAuthSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login, fetchUser } = useAuth()
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const userId = searchParams.get('userId')
    const token = searchParams.get('token') || searchParams.get('accessToken')
    const returnPath = getOAuthReturnPath()
    const fallbackPath = returnPath && returnPath !== '/auth/success' ? returnPath : '/'

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
          login(userData, token)
          setTimeout(() => navigate(fallbackPath, { replace: true }), 300)
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
      <div className="min-h-screen bg-light flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-light flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37] mx-auto mb-4"></div>
        <p className="text-gray-600">Completing your login...</p>
      </div>
    </div>
  )
}
