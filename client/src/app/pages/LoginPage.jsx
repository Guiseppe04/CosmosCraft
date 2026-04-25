import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API } from '../utils/apiConfig'

/**
 * LoginPage - User Authentication
 * Theme: Dark theme with gold accents (matching LandingPage)
 */
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API}/auth/email-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Login failed. Please check your credentials.')
        return
      }

      if (data.data?.user) {
        login(data.data.user)
      }

      const role = data.data?.user?.role || 'customer'
      if (role === 'admin' || role === 'super_admin') {
        navigate('/admin')
      } else if (role === 'staff') {
        navigate('/staff')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = (provider) => {
    window.location.href = `${API}/auth/${provider.toLowerCase()}`
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] bg-clip-text text-transparent">
            CosmosCraft
          </Link>
        </motion.div>

        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex justify-center mb-6">
            <img src="/logo-cosmos.png" alt="CosmosCraft Logo" className="h-16 w-auto object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 text-center">Welcome Back</h1>
          <p className="text-[var(--text-muted)] text-center">Sign in to continue to CosmosCraft</p>
        </motion.div>

        {error && <p className="mb-4 text-sm text-red-500 font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8 space-y-6"
        >
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          {/* Remember & Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border border-[var(--border)] rounded cursor-pointer bg-[var(--bg-primary)] accent-[var(--gold-primary)]"
              />
              <span className="text-sm text-[var(--text-muted)]">Remember me</span>
            </label>
            <Link to="#" className="text-sm text-[var(--gold-primary)] hover:text-[var(--gold-secondary)] font-medium transition-colors duration-200">
              Forgot password?
            </Link>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--text-dark)]/30 border-t-[var(--text-dark)] rounded-full animate-spin"></div>
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[var(--surface-dark)] text-[var(--text-muted)]">Or continue with</span>
            </div>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSocialLogin('Google')}
              className="w-full border border-[var(--border)] hover:border-[var(--gold-primary)] bg-[var(--bg-primary)] rounded-lg py-3 font-medium text-white transition-all duration-200 hover:bg-[var(--gold-primary)]/10 flex items-center justify-center gap-2"
            >
              <img src="/google.svg" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
              Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('Facebook')}
              className="w-full border border-[var(--border)] hover:border-[var(--gold-primary)] bg-[var(--bg-primary)] rounded-lg py-3 font-medium text-white transition-all duration-200 hover:bg-[var(--gold-primary)]/10 flex items-center justify-center gap-2"
            >
              <img src="/facebook.svg" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
              Facebook
            </button>
          </div>
        </motion.form>

        {/* Sign Up Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 text-center space-y-4"
        >
          <p className="text-[var(--text-muted)]">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[var(--gold-primary)] font-bold hover:text-[var(--gold-secondary)] transition-colors duration-200">
              Sign up
            </Link>
          </p>
        </motion.div>



        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6 text-center"
        >
          <Link to="/" className="inline-flex items-center gap-2 text-[var(--gold-primary)] hover:text-[var(--gold-secondary)] font-medium transition-colors duration-200">
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to home
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
