import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { CheckCircle, XCircle } from 'lucide-react'
import { API } from '../utils/apiConfig'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('idle') // idle | success | error
  const [message, setMessage] = useState('')

  const validatePassword = (pwd) => {
    return pwd.length >= 8
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')

    if (!token) {
      setStatus('error')
      setMessage('Invalid or missing reset token.')
      return
    }

    if (!validatePassword(newPassword)) {
      setStatus('error')
      setMessage('Password must be at least 8 characters and include required complexity.')
      return
    }

    if (newPassword !== confirmPassword) {
      setStatus('error')
      setMessage('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to reset password')
      }

      setStatus('success')
      setMessage(data?.message || 'Password updated successfully. Redirecting to login...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      console.error('Reset password error:', err)
      setStatus('error')
      setMessage(err.message || 'This reset link is invalid or has expired')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8 max-w-md w-full">
        {status === 'idle' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-2xl font-bold text-white text-center">Reset your password</h1>
            <p className="text-sm text-[var(--text-muted)] text-center">Enter a new password for your account.</p>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">New password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full px-4 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">Confirm password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full px-4 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white" />
            </div>

            {message && <p className={`text-sm ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>{message}</p>}

            <div className="flex gap-3">
              <button type="submit" disabled={isLoading} className="flex-1 bg-[var(--gold-primary)] hover:bg-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold py-2.5 rounded-lg transition disabled:opacity-60">
                {isLoading ? 'Saving...' : 'Save new password'}
              </button>
              <button type="button" onClick={() => navigate('/login')} className="flex-1 border border-[var(--border)] rounded-lg py-2.5 text-sm text-[var(--text-muted)] hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Password changed</h2>
            <p className="text-sm text-[var(--text-muted)] mt-2">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Verification Failed</h2>
            <p className="text-sm text-[var(--text-muted)] mt-2">{message}</p>
            <div className="mt-4 text-center">
              <button onClick={() => navigate('/forgot-password')} className="px-4 py-2 rounded-full bg-[var(--gold-primary)] text-[var(--text-dark)] font-semibold">Request new link</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordPage