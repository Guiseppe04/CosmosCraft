import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext.jsx'

export function OAuthSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login, fetchUser } = useAuth()
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const userId = searchParams.get('userId')

    if (!userId) {
      setError('Authentication failed. Please try again.')
      setTimeout(() => navigate('/'), 2000)
      return
    }

    // Fetch the authenticated user data from backend
    const initializeUser = async () => {
      try {
        const userData = await fetchUser()
        
        if (userData) {
          // Use the full user data from backend
          login(userData)
          // Redirect to home
          setTimeout(() => navigate('/'), 500)
        } else {
          setError('Failed to load user data')
          setTimeout(() => navigate('/'), 2000)
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        setError('Failed to complete authentication')
        setTimeout(() => navigate('/'), 2000)
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
