import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { API } from '../utils/apiConfig'

export function OTPVerificationPage() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [canResend, setCanResend] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const inputRefs = useRef([])
  useEffect(() => {
    // Get email from localStorage
    const pendingEmail = localStorage.getItem('pendingEmail')
    if (!pendingEmail) {
      navigate('/signup')
      return
    }
    setEmail(pendingEmail)
  }, [navigate])

  // Handle resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    } else if (resendTimer === 0 && !canResend && email) {
      setCanResend(true)
    }
  }, [resendTimer, canResend, email])

  const handleOtpChange = (index, value) => {
    // Only allow digits
    if (/^\d?$/.test(value)) {
      const newOtp = [...otp]
      newOtp[index] = value
      setOtp(newOtp)

      // Auto-focus next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validate OTP
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      setError('Please enter a valid 6-digit code.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          otp: otpCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Invalid OTP. Please try again.')
        return
      }

      setSuccess('Email verified successfully! Redirecting to login...')
      
      // Clear localStorage
      localStorage.removeItem('pendingEmail')
      localStorage.removeItem('pendingUserId')

      // Redirect to home page after 2 seconds
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (error) {
      console.error('OTP verification error:', error)
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (!canResend) return

    setError('')
    setSuccess('')
    setIsLoading(true)
    setCanResend(false)
    setResendTimer(60) // 60 second cooldown

    try {
      const response = await fetch(`${API}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to resend OTP.')
        setCanResend(true)
        setResendTimer(0)
        return
      }

      setSuccess('New code sent to your email!')
      setOtp(['', '', '', '', '', ''])
    } catch (error) {
      console.error('Resend OTP error:', error)
      setError('Network error. Please try again.')
      setCanResend(true)
      setResendTimer(0)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-light flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-dark mb-2">Verify Your Email</h1>
        <p className="text-sm text-dark opacity-70 mb-2">
          We sent a code to <span className="font-semibold">{email}</span>
        </p>
        <p className="text-xs text-dark opacity-60 mb-6">Enter the 6-digit code to continue</p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-2 justify-center">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={el => (inputRefs.current[index] = el)}
                type="text"
                maxLength="1"
                value={digit}
                onChange={e => handleOtpChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg focus:border-gold focus:outline-none"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.join('').length !== 6}
            className="w-full bg-gold hover:bg-gold-dark text-dark font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-dark opacity-70 mb-3">Didn't receive the code?</p>
          <button
            onClick={handleResendOtp}
            disabled={!canResend || isLoading}
            className="text-gold font-semibold hover:text-gold-dark disabled:opacity-50 text-sm"
          >
            {canResend ? 'Resend Code' : `Resend in ${resendTimer}s`}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/signup')}
            className="text-sm text-dark opacity-70 hover:opacity-100"
          >
            Back to Sign Up
          </button>
        </div>
      </div>
    </div>
  )
}
