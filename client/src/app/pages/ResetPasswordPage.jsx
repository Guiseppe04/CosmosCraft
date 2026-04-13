import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    const userId = searchParams.get('userId')

    const verifyToken = async () => {
      if (!token || !userId) {
        setStatus('error')
        setMessage('Invalid token or user ID')
        return
      }

      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/verify-password-reset-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, userId }),
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.message || 'Failed to verify token')
        }

        setStatus('success')
        setMessage('Password updated successfully!')

        setTimeout(() => {
          navigate('/login')
        }, 3000)
      } catch (error) {
        setStatus('error')
        setMessage(error.message || 'This token is invalid or has expired')
      }
    }

    verifyToken()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-[var(--gold-primary)] animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Confirming Password Change</h1>
            <p className="text-sm text-[var(--text-muted)]">Please wait while we verify your request...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Password Changed!</h1>
            <p className="text-sm text-[var(--text-muted)]">Your password has been updated successfully.</p>
            <p className="text-sm text-[var(--text-muted)] mt-2">Redirecting to login page...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Verification Failed</h1>
            <p className="text-sm text-[var(--text-muted)]">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-6 px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)]"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordPage