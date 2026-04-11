import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext.jsx'
import { API } from '../utils/apiConfig'
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Country, State } from 'country-state-city'
import {
  getAllRegions,
  getProvincesByRegion,
  getMunicipalitiesByProvince,
  getBarangaysByMunicipality,
} from '@aivangogh/ph-address'

const ALL_COUNTRIES = Country.getAllCountries()
const PHILIPPINES = ALL_COUNTRIES.find(c => c.isoCode === 'PH')
const OTHER_COUNTRIES = ALL_COUNTRIES.filter(c => c.isoCode !== 'PH')
const COUNTRIES = PHILIPPINES ? [PHILIPPINES, ...OTHER_COUNTRIES] : ALL_COUNTRIES

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

  // PH-specific cascading state
  const [phRegion, setPhRegion] = useState('')
  const [phProvince, setPhProvince] = useState('')
  const [phMunicipality, setPhMunicipality] = useState('')
  const [phBarangay, setPhBarangay] = useState('')

  // Derived PH data lists
  const phRegions = getAllRegions()
  const phProvinces = phRegion ? getProvincesByRegion(phRegion) : []
  const phMunicipalities = phProvince ? getMunicipalitiesByProvince(phProvince) : []
  const phBarangays = phMunicipality ? getBarangaysByMunicipality(phMunicipality) : []

  const isPhilippines = form.address.country === 'PH'

  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Helper to update top-level form fields
  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  // Helper to update nested address fields
  const updateAddressField = (field, value) => {
    setForm(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }))
    setErrors(prev => ({ ...prev, [`address.${field}`]: '' }))
  }

  // Reset PH cascading fields when country changes away from PH
  useEffect(() => {
    if (form.address.country !== 'PH') {
      setPhRegion('')
      setPhProvince('')
      setPhMunicipality('')
      setPhBarangay('')
      setForm(prev => ({
        ...prev,
        address: { ...prev.address, stateProvince: '', city: '' }
      }))
    }
  }, [form.address.country])

  // When PH region changes, reset downstream
  const handlePhRegionChange = (psgcCode, name) => {
    setPhRegion(psgcCode)
    setPhProvince('')
    setPhMunicipality('')
    setPhBarangay('')
    setForm(prev => ({
      ...prev,
      address: { ...prev.address, stateProvince: name, city: '' }
    }))
  }

  // When PH province changes, reset downstream
  const handlePhProvinceChange = (psgcCode, name) => {
    setPhProvince(psgcCode)
    setPhMunicipality('')
    setPhBarangay('')
    setForm(prev => ({
      ...prev,
      address: { ...prev.address, stateProvince: name, city: '' }
    }))
  }

  // When PH municipality changes, reset barangay/street
  const handlePhMunicipalityChange = (psgcCode, name) => {
    setPhMunicipality(psgcCode)
    setPhBarangay('')
    setForm(prev => ({
      ...prev,
      address: { ...prev.address, city: name }
    }))
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
      newErrors.phone = 'Phone must be valid (10-20 digits).'
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
    if (!form.address.country.trim()) newErrors['address.country'] = 'Country is required.'
    if (!form.address.streetLine1.trim()) newErrors['address.streetLine1'] = 'Street address is required.'
    if (!form.address.city.trim()) newErrors['address.city'] = 'City / Municipality is required.'
    if (!form.address.stateProvince.trim()) newErrors['address.stateProvince'] = isPhilippines ? 'Province is required.' : 'State/Province is required.'
    if (!form.address.postalZipCode.trim()) newErrors['address.postalZipCode'] = 'Postal/Zip code is required.'
    if (isPhilippines && !phRegion) newErrors['address.stateProvince'] = 'Region is required.'
    if (isPhilippines && !phProvince) newErrors['address.stateProvince'] = 'Province is required.'
    if (isPhilippines && !phMunicipality) newErrors['address.city'] = 'Municipality is required.'

    // Terms
    if (!form.terms) newErrors.terms = 'You must agree to the terms to continue.'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setSuccess('')
    setErrors({})
    if (!validate()) {
      // Small delay then clear generic submit error if any, form handles shakes
      return
    }

    setIsLoading(true)
    try {
      const payload = {
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
      }

      const response = await fetch(`${API}/auth/email-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
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
      localStorage.setItem('pendingEmail', form.email)
      localStorage.setItem('pendingUserId', data.data?.user?.id)

      setTimeout(() => navigate('/verify-otp'), 1500)
    } catch (error) {
      console.error('Signup error:', error)
      setErrors({ submit: 'Network error. Please check your connection and try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  // Helper for rendering error-aware inputs
  const getInputStyles = (error) => {
    return `w-full px-4 py-3 rounded-xl border bg-white/5 backdrop-blur-sm text-white focus:outline-none focus:ring-2 transition-all duration-300 ${error
      ? 'border-red-500/50 bg-red-500/10 focus:ring-red-500/50 focus:border-red-500/50'
      : 'border-white/10 focus:ring-[var(--gold-primary)] focus:border-[var(--gold-primary)] hover:border-white/30'
      }`
  }

  const shakeAnimation = {
    x: [0, -5, 5, -5, 5, 0],
    transition: { duration: 0.4 }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-12 px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[var(--gold-primary)]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <div className="flex justify-center mb-6">
            <img src="/logo-cosmos.png" alt="CosmosCraft Logo" className="h-20 w-auto object-contain" />
          </div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--text-muted)] tracking-tight mb-3">
            Join CosmosCraft
          </h1>
          <p className="text-base text-[var(--gold-primary)] font-medium tracking-wide">
            Design your instrument today.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 sm:p-10"
        >
          {success && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-8 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3 text-green-400">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{success}</p>
            </motion.div>
          )}

          {errors.submit && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{errors.submit}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-10" noValidate>

            {/* 1. PERSONAL INFO */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                <div className="w-8 h-8 rounded-full bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] flex justify-center items-center font-bold text-sm">1</div>
                <h2 className="text-xl font-medium text-white tracking-wide">Personal Details</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <motion.div animate={errors.firstName ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">First Name *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={e => updateField('firstName', e.target.value)}
                    className={getInputStyles(errors.firstName)}
                  />
                  {errors.firstName && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.firstName}</span>}
                </motion.div>

                <motion.div animate={errors.middleName ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Middle Name</label>
                  <input
                    type="text"
                    value={form.middleName}
                    placeholder="Optional"
                    onChange={e => updateField('middleName', e.target.value)}
                    className={getInputStyles(errors.middleName)}
                  />
                </motion.div>

                <motion.div animate={errors.lastName ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={e => updateField('lastName', e.target.value)}
                    className={getInputStyles(errors.lastName)}
                  />
                  {errors.lastName && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.lastName}</span>}
                </motion.div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <motion.div animate={errors.email ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Email Address *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => updateField('email', e.target.value)}
                    className={getInputStyles(errors.email)}
                  />
                  {errors.email && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</span>}
                </motion.div>

                <motion.div animate={errors.phone ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => updateField('phone', e.target.value)}
                    placeholder="(123) 456-7890"
                    className={getInputStyles(errors.phone)}
                  />
                  {errors.phone && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.phone}</span>}
                </motion.div>
              </div>
            </div>

            {/* 2. SECURITY */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                <div className="w-8 h-8 rounded-full bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] flex justify-center items-center font-bold text-sm">2</div>
                <h2 className="text-xl font-medium text-white tracking-wide">Security</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <motion.div animate={errors.password ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => updateField('password', e.target.value)}
                      className={getInputStyles(errors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)] hover:text-white transition-colors"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {errors.password && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.password}</span>}
                </motion.div>

                <motion.div animate={errors.confirmPassword ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={e => updateField('confirmPassword', e.target.value)}
                      className={getInputStyles(errors.confirmPassword)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)] hover:text-white transition-colors"
                    >
                      {showConfirm ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {errors.confirmPassword && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.confirmPassword}</span>}
                </motion.div>
              </div>
            </div>

            {/* 3. ADDRESS */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                <div className="w-8 h-8 rounded-full bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] flex justify-center items-center font-bold text-sm">3</div>
                <h2 className="text-xl font-medium text-white tracking-wide">Shipping Address</h2>
              </div>

              {/* Country selector - always shown first */}
              <motion.div animate={errors['address.country'] ? shakeAnimation : {}}>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Country *</label>
                <select
                  value={form.address.country}
                  onChange={e => updateAddressField('country', e.target.value)}
                  className={`${getInputStyles(errors['address.country'])} appearance-none cursor-pointer`}
                >
                  <option value="" disabled className="text-gray-900">Select Country</option>
                  {COUNTRIES.map(c => (
                    <option key={c.isoCode} value={c.isoCode} className="text-gray-900">{c.name}</option>
                  ))}
                </select>
                {errors['address.country'] && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors['address.country']}</span>}
              </motion.div>

              {/* PHILIPPINES: Cascading Region → Province → Municipality → Barangay */}
              {isPhilippines ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Region */}
                    <motion.div animate={errors['address.stateProvince'] ? shakeAnimation : {}}>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Region *</label>
                      <select
                        value={phRegion}
                        onChange={e => {
                          const opt = phRegions.find(r => r.psgcCode === e.target.value)
                          handlePhRegionChange(e.target.value, opt?.designation || opt?.name || '')
                        }}
                        className={`${getInputStyles(errors['address.stateProvince'])} appearance-none cursor-pointer`}
                      >
                        <option value="" disabled className="text-gray-900">Select Region</option>
                        {phRegions.map(r => (
                          <option key={r.psgcCode} value={r.psgcCode} className="text-gray-900">{r.name}</option>
                        ))}
                      </select>
                      {errors['address.stateProvince'] && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors['address.stateProvince']}</span>}
                    </motion.div>

                    {/* Province */}
                    <motion.div animate={errors['address.stateProvince'] ? shakeAnimation : {}}>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Province *</label>
                      <select
                        value={phProvince}
                        disabled={!phRegion}
                        onChange={e => {
                          const opt = phProvinces.find(p => p.psgcCode === e.target.value)
                          handlePhProvinceChange(e.target.value, opt?.name || '')
                        }}
                        className={`${getInputStyles(errors['address.stateProvince'])} appearance-none cursor-pointer disabled:opacity-40`}
                      >
                        <option value="" disabled className="text-gray-900">{phRegion ? 'Select Province' : 'Select a region first'}</option>
                        {phProvinces.map(p => (
                          <option key={p.psgcCode} value={p.psgcCode} className="text-gray-900">{p.name}</option>
                        ))}
                      </select>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Municipality / City */}
                    <motion.div animate={errors['address.city'] ? shakeAnimation : {}}>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Municipality / City *</label>
                      <select
                        value={phMunicipality}
                        disabled={!phProvince}
                        onChange={e => {
                          const opt = phMunicipalities.find(m => m.psgcCode === e.target.value)
                          handlePhMunicipalityChange(e.target.value, opt?.name || '')
                        }}
                        className={`${getInputStyles(errors['address.city'])} appearance-none cursor-pointer disabled:opacity-40`}
                      >
                        <option value="" disabled className="text-gray-900">{phProvince ? 'Select Municipality' : 'Select a province first'}</option>
                        {phMunicipalities.map(m => (
                          <option key={m.psgcCode} value={m.psgcCode} className="text-gray-900">{m.name}</option>
                        ))}
                      </select>
                      {errors['address.city'] && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors['address.city']}</span>}
                    </motion.div>

                    {/* Barangay */}
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Barangay (Optional)</label>
                      <select
                        value={phBarangay}
                        disabled={!phMunicipality}

                        className={`${getInputStyles(null)} appearance-none cursor-pointer disabled:opacity-40`}
                      >
                        <option value="" className="text-gray-900">{phMunicipality ? 'Select Barangay' : 'Select a municipality first'}</option>
                        {phBarangays.map(b => (
                          <option key={b.psgcCode} value={b.name} className="text-gray-900">{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Street Address line (editable, pre-filled with barangay if chosen) */}
                  <motion.div animate={errors['address.streetLine1'] ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Street / Building / House No. *</label>
                    <input
                      type="text"
                      value={form.address.streetLine1}
                      placeholder={phBarangay ? `Brgy. ${phBarangay}, add street/bldg...` : 'e.g. 123 Rizal St.'}
                      onChange={e => updateAddressField('streetLine1', e.target.value)}
                      className={getInputStyles(errors['address.streetLine1'])}
                    />
                    {errors['address.streetLine1'] && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors['address.streetLine1']}</span>}
                  </motion.div>

                  <motion.div animate={errors['address.streetLine2'] ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Unit / Floor / Landmark (Optional)</label>
                    <input
                      type="text"
                      value={form.address.streetLine2}
                      onChange={e => updateAddressField('streetLine2', e.target.value)}
                      className={getInputStyles(errors['address.streetLine2'])}
                    />
                  </motion.div>

                  <motion.div animate={errors['address.postalZipCode'] ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Postal / ZIP Code *</label>
                    <input
                      type="text"
                      value={form.address.postalZipCode}
                      placeholder="e.g. 1000"
                      onChange={e => updateAddressField('postalZipCode', e.target.value)}
                      className={getInputStyles(errors['address.postalZipCode'])}
                    />
                    {errors['address.postalZipCode'] && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors['address.postalZipCode']}</span>}
                  </motion.div>
                </>
              ) : (
                /* OTHER COUNTRIES: Generic address form */
                <>
                  <motion.div animate={errors['address.streetLine1'] ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Street Address *</label>
                    <input
                      type="text"
                      value={form.address.streetLine1}
                      onChange={e => updateAddressField('streetLine1', e.target.value)}
                      className={getInputStyles(errors['address.streetLine1'])}
                    />
                    {errors['address.streetLine1'] && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors['address.streetLine1']}</span>}
                  </motion.div>

                  <motion.div animate={errors['address.streetLine2'] ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Apartment, Suite (Optional)</label>
                    <input
                      type="text"
                      value={form.address.streetLine2}
                      onChange={e => updateAddressField('streetLine2', e.target.value)}
                      className={getInputStyles(errors['address.streetLine2'])}
                    />
                  </motion.div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <motion.div animate={errors['address.stateProvince'] ? shakeAnimation : {}}>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">State / Province *</label>
                      {(() => {
                        const availableStates = form.address.country ? State.getStatesOfCountry(form.address.country) : []
                        if (availableStates.length > 0) {
                          return (
                            <select
                              value={form.address.stateProvince}
                              onChange={e => updateAddressField('stateProvince', e.target.value)}
                              className={`${getInputStyles(errors['address.stateProvince'])} appearance-none cursor-pointer`}
                            >
                              <option value="" disabled className="text-gray-900">Select State/Province</option>
                              {availableStates.map(s => (
                                <option key={s.isoCode} value={s.name} className="text-gray-900">{s.name}</option>
                              ))}
                            </select>
                          )
                        }
                        return (
                          <input
                            type="text"
                            value={form.address.stateProvince}
                            placeholder="State / Region"
                            onChange={e => updateAddressField('stateProvince', e.target.value)}
                            className={getInputStyles(errors['address.stateProvince'])}
                          />
                        )
                      })()}
                      {errors['address.stateProvince'] && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors['address.stateProvince']}</span>}
                    </motion.div>

                    <motion.div animate={errors['address.city'] ? shakeAnimation : {}}>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">City *</label>
                      <input
                        type="text"
                        value={form.address.city}
                        onChange={e => updateAddressField('city', e.target.value)}
                        className={getInputStyles(errors['address.city'])}
                      />
                      {errors['address.city'] && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors['address.city']}</span>}
                    </motion.div>
                  </div>

                  <motion.div animate={errors['address.postalZipCode'] ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Postal / Zip Code *</label>
                    <input
                      type="text"
                      value={form.address.postalZipCode}
                      onChange={e => updateAddressField('postalZipCode', e.target.value)}
                      className={getInputStyles(errors['address.postalZipCode'])}
                    />
                    {errors['address.postalZipCode'] && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors['address.postalZipCode']}</span>}
                  </motion.div>
                </>
              )}
            </div>

            {/* TERMS & ACTIONS */}
            <div className="pt-6 border-t border-white/10">
              <motion.label animate={errors.terms ? shakeAnimation : {}} className="flex items-start gap-3 mt-2 mb-8 cursor-pointer group">
                <div className="relative mt-1">
                  <input
                    type="checkbox"
                    checked={form.terms}
                    onChange={e => updateField('terms', e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className={`w-5 h-5 border-2 rounded-md transition-all duration-300 flex items-center justify-center
                    ${form.terms ? 'bg-[var(--gold-primary)] border-[var(--gold-primary)]' : 'border-white/30 group-hover:border-white/50 bg-white/5'}
                    ${errors.terms ? 'border-red-500 bg-red-500/10' : ''}
                  `}>
                    {form.terms && <CheckCircle2 className="w-4 h-4 text-black" />}
                  </div>
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  I agree to the <span className="text-white font-medium hover:text-[var(--gold-primary)] transition-colors">Terms of Service</span> and acknowledge the <span className="text-white font-medium hover:text-[var(--gold-primary)] transition-colors">Privacy Policy</span>.
                  {errors.terms && <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.terms}</p>}
                </div>
              </motion.label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-white text-black rounded-2xl font-bold tracking-wide hover:bg-[var(--gold-primary)] transition-all duration-300 disabled:opacity-70 flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    Initialize Account
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center bg-black/20 p-4 rounded-xl border border-white/5">
            <span className="text-sm text-[var(--text-muted)] tracking-wide">
              Already a have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-[var(--gold-primary)] font-semibold hover:text-white transition-colors ml-1"
              >
                Sign In Instead
              </button>
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
