import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext.jsx'

export function OAuthSignupPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [userData, setUserData] = useState(null)

  useEffect(() => {
    const provider = searchParams.get('provider')
    const userDataStr = searchParams.get('userData')

    if (userDataStr) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userDataStr))
        setUserData({ ...parsed, provider })
      } catch (e) {
        console.error('Failed to parse OAuth data:', e)
        navigate('/')
      }
    } else {
      navigate('/')
    }
  }, [searchParams, navigate])

  const handleCompleteSignup = async () => {
    if (!userData) return

    setIsLoading(true)

    try {
      // Call backend to complete signup
      const response = await fetch('http://localhost:5000/auth/oauth-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Signup failed')

      const data = await response.json()

      // Login and redirect
      login({ email: userData.email, remember: true })
      setTimeout(() => navigate('/dashboard'), 500)
    } catch (error) {
      console.error('Signup error:', error)
      alert('Failed to complete signup. Please try again.')
      setIsLoading(false)
    }
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-light flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark mb-2">Complete Your Setup</h1>
          <p className="text-dark opacity-60">
            Welcome! Let's complete your {userData.provider} account setup
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg space-y-6">
          {/* Display parsed user data */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm">
              <span className="font-semibold text-dark">Email: </span>
              <span className="text-gray-600">{userData.email}</span>
            </p>
            {userData.firstName && (
              <p className="text-sm">
                <span className="font-semibold text-dark">Name: </span>
                <span className="text-gray-600">
                  {[userData.firstName, userData.middleName, userData.lastName]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </p>
            )}
            <p className="text-sm">
              <span className="font-semibold text-dark">Provider: </span>
              <span className="text-gray-600 capitalize">{userData.provider}</span>
            </p>
          </div>

          <button
            onClick={handleCompleteSignup}
            disabled={isLoading}
            className="w-full bg-[#d4af37] hover:bg-[#c39d2f] text-[#231f20] font-semibold py-3 rounded-lg transition disabled:opacity-60"
          >
            {isLoading ? 'Setting up...' : 'Complete Setup'}
          </button>

          <p className="text-xs text-gray-600 text-center">
            You can update your profile information later in your dashboard
          </p>
        </div>
      </div>
    </div>
  )
}
