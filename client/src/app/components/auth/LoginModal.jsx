import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../context/AuthContext.jsx'
import { API } from '../../utils/apiConfig'

export function LoginModal() {
  const { loginOpen, closeLogin, login, fetchUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
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

      // Set user data directly from login response
      if (data.data?.user) {
        login(data.data.user)
      }

      // Clear form and close modal
      setEmail('')
      setPassword('')
      closeLogin()

      // Redirect to dashboard based on role
      const role = data.data?.user?.role || 'customer'
      if (role === 'admin' || role === 'super_admin') {
        navigate('/admin')
      } else if (role === 'staff') {
        navigate('/staff')
      } else {
        navigate('/dashboard')
      }
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full max-w-md rounded-2xl shadow-2xl p-8 relative bg-[var(--surface-elevated)]"
          >
            <button
              type="button"
              onClick={closeLogin}
              className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--gold-primary)] text-xl leading-none"
              aria-label="Close login"
            >
              ×
            </button>

            <div className="mb-6">
              <div className="mb-4 flex justify-center">
                <img src="/logo-cosmos.png" alt="CosmosCraft Logo" className="h-12 w-auto object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-light)] mb-1">Login to CosmosCraft</h2>
              <p className="text-sm text-[var(--text-muted)]">Sign in to continue your purchase</p>
            </div>

            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border theme-input focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-lg border theme-input pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-xs text-[var(--text-muted)] hover:text-[var(--gold-primary)]"
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
                    className="w-4 h-4 rounded border-[var(--border)] text-[var(--gold-primary)]"
                  />
                  <span className="text-[var(--text-muted)]">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-[var(--gold-primary)] hover:text-[var(--gold-secondary)]"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-[var(--gold-primary)] hover:bg-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
              <span>Don&apos;t have an account? </span>
              <button
                type="button"
                onClick={handleGoToSignup}
                className="font-semibold text-[var(--gold-primary)] hover:text-[var(--gold-secondary)]"
              >
                Create Account
              </button>
            </div>

            <div className="mt-6">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--border)]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 bg-[var(--surface-elevated)] text-[var(--text-muted)]">Or continue with</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => window.location.href = `${API}/auth/google`}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-light)] hover:bg-[var(--surface-elevated)]"
                >
                  <img src="/google.svg" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => window.location.href = `${API}/auth/facebook`}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-light)] hover:bg-[var(--surface-elevated)]"
                >
                  <img src="/facebook.svg" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
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

