import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext.jsx'

export function SignupPage() {
  const navigate = useNavigate()
  const { fetchUser } = useAuth()
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: {
      streetLine1: '',
      streetLine2: '',
      city: '',
      stateProvince: '',
      postalZipCode: '',
      country: '',
    },
    terms: false,
  })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const updateAddressField = (field, value) => {
    setForm(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }))
    const errorKey = `address.${field}`
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}
    
    // Personal Information
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required.'
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required.'
    
    // Contact Information
    if (!form.email.trim()) {
      newErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email address.'
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required.'
    } else if (!/^[\d\s\-\+\(\)]{10,20}$/.test(form.phone)) {
      newErrors.phone = 'Phone number must be 10-20 digits with optional formatting.'
    }

    // Password
    if (!form.password) {
      newErrors.password = 'Password is required.'
    } else if (form.password.length < 12) {
      newErrors.password = 'Password must be at least 12 characters.'
    } else if (form.password.length > 64) {
      newErrors.password = 'Password must not exceed 64 characters.'
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.'
    } else if (form.confirmPassword !== form.password) {
      newErrors.confirmPassword = 'Passwords do not match.'
    }

    // Address Information
    if (!form.address.streetLine1.trim()) newErrors['address.streetLine1'] = 'Street address is required.'
    if (!form.address.city.trim()) newErrors['address.city'] = 'City is required.'
    if (!form.address.stateProvince.trim()) newErrors['address.stateProvince'] = 'State/Province is required.'
    if (!form.address.postalZipCode.trim()) newErrors['address.postalZipCode'] = 'Postal code is required.'
    if (!form.address.country.trim()) newErrors['address.country'] = 'Country is required.'

    // Terms
    if (!form.terms) newErrors.terms = 'You must agree to the terms to continue.'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setSuccess('')
    setErrors({})
    if (!validate()) return

    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:5000/auth/email-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
          address: {
            streetLine1: form.address.streetLine1.trim(),
            streetLine2: form.address.streetLine2.trim(),
            city: form.address.city.trim(),
            stateProvince: form.address.stateProvince.trim(),
            postalZipCode: form.address.postalZipCode.trim(),
            country: form.address.country.trim(),
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle backend errors
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          const fieldErrors = {}
          data.errors.forEach(err => {
            fieldErrors[err.field] = err.message
          })
          setErrors(fieldErrors)
        } else if (data.message) {
          setErrors({ submit: data.message })
        } else {
          setErrors({ submit: 'Signup failed. Please try again.' })
        }
        return
      }

      setSuccess(data.message || 'Account created! Check your email for the verification code.')
      // Store email for OTP verification
      localStorage.setItem('pendingEmail', form.email)
      localStorage.setItem('pendingUserId', data.data?.user?.id)
      
      // Redirect to OTP verification page after 1.5 seconds
      setTimeout(() => {
        navigate('/verify-otp')
      }, 1500)
    } catch (error) {
      console.error('Signup error:', error)
      setErrors({ submit: 'Network error. Please check your connection and try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-light py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-dark mb-2">Create Your Account</h1>
        <p className="text-sm text-dark opacity-70 mb-8">Join CosmosCraft and start your journey</p>

        {success && <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}
        {errors.submit && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors.submit}</div>}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information Section */}
          <div>
            <h2 className="text-lg font-semibold text-dark mb-4">Personal Information</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-dark mb-1">First Name *</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={e => updateField('firstName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-dark mb-1">Middle Name</label>
                <input
                  type="text"
                  value={form.middleName}
                  onChange={e => updateField('middleName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                  placeholder="(optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-dark mb-1">Last Name *</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={e => updateField('lastName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div>
            <h2 className="text-lg font-semibold text-dark mb-4">Contact Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-dark mb-1">Email Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-dark mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  placeholder="(123) 456-7890 or 123-456-7890"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                />
                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div>
            <h2 className="text-lg font-semibold text-dark mb-4">Security</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-dark mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => updateField('password', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark pr-12 focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark/60 hover:text-dark"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                <div className="mt-2 text-xs text-dark/70 bg-gray-50 p-3 rounded">
                  <p className="font-semibold mb-1">Password Requirements:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Minimum 12 characters, maximum 64</li>
                    <li>Consider using a passphrase (e.g., "BlueSky-Guitar-2024")</li>
                    <li>Can include uppercase, numbers, symbols, and spaces</li>
                  </ul>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-dark mb-1">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={e => updateField('confirmPassword', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark pr-12 focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark/60 hover:text-dark"
                  >
                    {showConfirm ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>
            </div>
          </div>

          {/* Address Information Section */}
          <div>
            <h2 className="text-lg font-semibold text-dark mb-4">Address Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-dark mb-1">Street Address *</label>
                <input
                  type="text"
                  value={form.address.streetLine1}
                  onChange={e => updateAddressField('streetLine1', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                />
                {errors['address.streetLine1'] && <p className="mt-1 text-xs text-red-500">{errors['address.streetLine1']}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark mb-1">Apartment, Suite, etc. (optional)</label>
                <input
                  type="text"
                  value={form.address.streetLine2}
                  onChange={e => updateAddressField('streetLine2', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark mb-1">City *</label>
                  <input
                    type="text"
                    value={form.address.city}
                    onChange={e => updateAddressField('city', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  {errors['address.city'] && <p className="mt-1 text-xs text-red-500">{errors['address.city']}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark mb-1">State / Province *</label>
                  <input
                    type="text"
                    value={form.address.stateProvince}
                    onChange={e => updateAddressField('stateProvince', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  {errors['address.stateProvince'] && <p className="mt-1 text-xs text-red-500">{errors['address.stateProvince']}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark mb-1">Postal Code / Zip *</label>
                  <input
                    type="text"
                    value={form.address.postalZipCode}
                    onChange={e => updateAddressField('postalZipCode', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  {errors['address.postalZipCode'] && <p className="mt-1 text-xs text-red-500">{errors['address.postalZipCode']}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark mb-1">Country *</label>
                  <input
                    type="text"
                    value={form.address.country}
                    onChange={e => updateAddressField('country', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  {errors['address.country'] && <p className="mt-1 text-xs text-red-500">{errors['address.country']}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Terms Checkbox */}
          <label className="flex items-start gap-3 text-sm text-dark cursor-pointer">
            <input
              type="checkbox"
              checked={form.terms}
              onChange={e => updateField('terms', e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-gold"
            />
            <span>
              I agree to the <span className="font-semibold">Terms and Conditions</span> and{' '}
              <span className="font-semibold">Privacy Policy</span>.
            </span>
          </label>
          {errors.terms && <p className="text-xs text-red-500">{errors.terms}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gold hover:bg-gold-dark text-dark font-semibold py-3 rounded-lg transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin"></div>
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-dark/60">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/')}
            className="text-gold font-semibold hover:underline"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  )
}

