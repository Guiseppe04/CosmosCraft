import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext.jsx'

export function SignupPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dob: '',
    gender: '',
    address: '',
    terms: false,
  })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState('')

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const validate = () => {
    const newErrors = {}
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required.'
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required.'
    if (!form.username.trim()) newErrors.username = 'Username is required.'
    if (!form.email.trim()) {
      newErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email address.'
    }
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required.'

    if (!form.password) {
      newErrors.password = 'Password is required.'
    } else if (form.password.length < 8 || !/\d/.test(form.password) || !/[!@#$%^&*]/.test(form.password)) {
      newErrors.password =
        'Password must be at least 8 characters and include a number and special character.'
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.'
    } else if (form.confirmPassword !== form.password) {
      newErrors.confirmPassword = 'Passwords do not match.'
    }
    if (!form.dob) newErrors.dob = 'Date of birth is required.'
    if (!form.terms) newErrors.terms = 'You must agree to the terms to continue.'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = e => {
    e.preventDefault()
    setSuccess('')
    if (!validate()) return

    // Simulate successful account creation and auto-login
    login({ email: form.email, remember: true })
    setSuccess('Account created successfully.')
    setTimeout(() => {
      navigate('/dashboard')
    }, 600)
  }

  return (
    <div className="min-h-screen bg-light flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-dark mb-1">Create an Account</h1>
        <p className="text-sm text-dark opacity-70 mb-6">Sign up to start using CosmosCraft</p>
        {success && <p className="mb-4 text-sm text-green-600">{success}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-dark mb-1">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => updateField('firstName', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark mb-1">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => updateField('lastName', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => updateField('username', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark mb-1">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark mb-1">Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => updateField('phone', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-dark mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => updateField('password', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark mb-1">Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={e => updateField('confirmPassword', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark mb-1">Date of Birth</label>
            <input
              type="date"
              value={form.dob}
              onChange={e => updateField('dob', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {errors.dob && <p className="mt-1 text-xs text-red-500">{errors.dob}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark mb-1">
              Gender <span className="text-xs text-dark/60">(optional)</span>
            </label>
            <select
              value={form.gender}
              onChange={e => updateField('gender', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark mb-1">
              Address <span className="text-xs text-dark/60">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={form.address}
              onChange={e => updateField('address', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-dark cursor-pointer">
            <input
              type="checkbox"
              checked={form.terms}
              onChange={e => updateField('terms', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gold"
            />
            <span>
              I agree to the <span className="font-semibold">Terms and Conditions</span> and{' '}
              <span className="font-semibold">Privacy Policy</span>.
            </span>
          </label>
          {errors.terms && <p className="mt-1 text-xs text-red-500">{errors.terms}</p>}

          <button
            type="submit"
            className="w-full mt-2 bg-gold hover:bg-gold-dark text-dark font-semibold py-2.5 rounded-lg transition"
          >
            Sign Up
          </button>
        </form>
      </div>
    </div>
  )
}

