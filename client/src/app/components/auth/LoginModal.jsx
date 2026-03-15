import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../context/AuthContext.jsx'

export function LoginModal() {
  const { loginOpen, closeLogin, fetchUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API}/auth/email-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important: send cookies
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Login failed. Please check your credentials.')
        return
      }

      // Successful login - fetch user data to update auth context
      await fetchUser()
      
      // Clear form and close modal
      setEmail('')
      setPassword('')
      closeLogin()

      // Redirect to dashboard
      navigate('/dashboard')
    } catch (error) {
      console.error('Login error:', error)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoToSignup = () => {
    closeLogin()
    navigate('/signup')
  }

  useEffect(() => {
    if (loginOpen) {
      // Reset states whenever modal is (re)opened
      setIsLoading(false)
      setError('')
    }
  }, [loginOpen])

  return (
    <AnimatePresence>
      {loginOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 relative"
          >
            <button
              type="button"
              onClick={closeLogin}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="Close login"
            >
              ×
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Login to CosmosCraft</h2>
              <p className="text-sm text-gray-500">Sign in to continue your purchase</p>
            </div>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 pr-10 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-[#d4af37]"
                  />
                  <span className="text-gray-700">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-[#d4af37] hover:text-[#c39d2f]"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-[#d4af37] hover:bg-[#c39d2f] text-[#231f20] font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              <span>Don&apos;t have an account? </span>
              <button
                type="button"
                onClick={handleGoToSignup}
                className="font-semibold text-[#d4af37] hover:text-[#c39d2f]"
              >
                Create Account
              </button>
            </div>

            <div className="mt-6">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 bg-white text-gray-400">Or continue with</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => window.location.href = `${API}/auth/google`}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <span className="w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center text-[10px] font-bold text-red-500">
                    G
                  </span>
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => window.location.href = `${API}/auth/facebook`}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <span className="w-5 h-5 rounded-full bg-[#1877f2] text-white flex items-center justify-center text-[10px] font-bold">
                    f
                  </span>
                  Facebook
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

