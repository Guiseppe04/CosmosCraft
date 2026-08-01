import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Mail } from 'lucide-react'
import { API } from '../utils/apiConfig'

export function ForgotPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialEmail = searchParams.get('email') || ''
  const [email, setEmail] = useState(initialEmail)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setEmail(initialEmail)
  }, [initialEmail])

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.message || 'Failed to request password reset. Please try again.')
      } else {
        setMessage(data?.message || 'If an account exists for that email, a reset link was sent.')
      }
    } catch (err) {
      console.error('Forgot password error:', err)
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center">
          <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] bg-clip-text text-transparent">
            CosmosCraft
          </Link>
        </motion.div>

        <motion.form onSubmit={handleSubmit} className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8 space-y-6">
          <div className="flex justify-center mb-2">
            <img src="/logo-cosmos.png" alt="CosmosCraft Logo" className="h-12 w-auto object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-white text-center">Forgot Password</h2>
          <p className="text-sm text-[var(--text-muted)] text-center">Enter your account email and we'll send a reset link.</p>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-green-400">{message}</p>}

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-12 pr-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isLoading} className="flex-1 bg-[var(--gold-primary)] hover:bg-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold py-2.5 rounded-lg transition disabled:opacity-60">
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button type="button" onClick={() => navigate('/login')} className="flex-1 border border-[var(--border)] rounded-lg py-2.5 text-sm text-[var(--text-muted)] hover:text-white">
              Back to login
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  )
}

export default ForgotPassword
