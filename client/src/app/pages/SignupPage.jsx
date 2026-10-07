import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import SitePolicyAgreement from '../components/SitePolicyAgreement'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext.jsx'
import { API } from '../utils/apiConfig'
import { useZipValidation } from '../hooks/useZipValidation'
import { ArrowRight, AlertCircle, CheckCircle2 , Eye, EyeOff} from 'lucide-react'
import { getAllRegions, getProvincesByRegion, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'

// ─── Philippine Phone Input Helpers ──────────────────────────────────────────

function stripNonDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatPhMobileDisplay(digits) {
  if (!digits) return ''
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  if (digits.length <= 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`
}

function extractPhSubscriberNumber(value) {
  const digits = stripNonDigits(value)
  if (!digits) return ''
  if (digits.startsWith('63')) return digits.slice(2)
  if (digits.startsWith('0')) return digits.slice(1)
  return digits
}

function toE164(subscriberDigits) {
  if (!subscriberDigits) return ''
  return `+63${subscriberDigits}`
}

function isValidPhMobile(subscriberDigits) {
  if (!subscriberDigits || subscriberDigits.length !== 10) return false
  return /^9\d{9}$/.test(subscriberDigits)
}

// ─── Component ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 3

export function SignupPage() {
  const navigate = useNavigate()
  const { fetchUser } = useAuth()
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    phoneDisplay: '',
    password: '',
    confirmPassword: '',
    address: {
      streetLine1: '',
      streetLine2: '',
      city: '',
      barangay: '',
      stateProvince: '',
      postalZipCode: '',
      country: 'PH',
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

  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [addressValidationAttempted, setAddressValidationAttempted] = useState(false)
  const fieldRefs = useRef({})

  const getAddressError = (field) => addressValidationAttempted && errors[`address.${field}`]
  const showTermsError = addressValidationAttempted && errors.terms

  // ZIP Code validation hook
  const {
    isValid: zipValid,
    isLoading: zipLoading,
    error: zipError,
    validate: validateZip,
  } = useZipValidation()

  // Real-time ZIP validation when city or zip changes
  useEffect(() => {
    validateZip(phMunicipality, form.address.postalZipCode)
  }, [phMunicipality, form.address.postalZipCode, validateZip])

  const registerFieldRef = (fieldKey) => (element) => {
    if (element) {
      fieldRefs.current[fieldKey] = element
    }
  }

  const focusFirstInvalidField = (validationErrors) => {
    const fieldOrder = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'password',
      'confirmPassword',
      'address.country',
      'address.streetLine1',
      'address.region',
      'address.province',
      'address.city',
      'address.barangay',
      'address.postalZipCode',
      'terms',
    ]
    const firstKey = fieldOrder.find((key) => validationErrors[key]) || Object.keys(validationErrors)[0]
    if (!firstKey) return

    const element = fieldRefs.current[firstKey]
    if (!element) return

    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    requestAnimationFrame(() => {
      element.focus?.({ preventScroll: true })
    })
  }

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
        address: { ...prev.address, stateProvince: '', city: '', barangay: '' }
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
      address: { ...prev.address, stateProvince: name, city: '', barangay: '' }
    }))
    setErrors(prev => ({
      ...prev,
      'address.region': '',
      'address.stateProvince': '',
    }))
  }

  // When PH province changes, reset downstream
  const handlePhProvinceChange = (psgcCode, name) => {
    setPhProvince(psgcCode)
    setPhMunicipality('')
    setPhBarangay('')
    setForm(prev => ({
      ...prev,
      address: { ...prev.address, stateProvince: name, city: '', barangay: '' }
    }))
    setErrors(prev => ({
      ...prev,
      'address.province': '',
      'address.stateProvince': '',
    }))
  }

  // When PH municipality changes, reset barangay/street
  const handlePhMunicipalityChange = (psgcCode, name) => {
    setPhMunicipality(psgcCode)
    setPhBarangay('')
    setForm(prev => ({
      ...prev,
      address: { ...prev.address, city: name, barangay: '' }
    }))
    setErrors(prev => ({
      ...prev,
      'address.city': '',
    }))
  }

  // ─── Validation ────────────────────────────────────────────────────────────
  // Full validation — used on desktop submit AND on mobile final-step submit.
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
    } else {
      const cleanedPhone = form.phone.replace(/\D/g, '')
      if (!/^639\d{9}$/.test(cleanedPhone)) {
        newErrors.phone = 'Phone number must start with +63 and contain 10 digits after the country code.'
      }
    }

    // Password
    if (!form.password) {
      newErrors.password = 'Password is required.'
    } else if (form.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.'
    } else if (form.password.length > 64) {
      newErrors.password = 'Password must not exceed 64 characters.'
    } else if (!/[A-Z]/.test(form.password)) {
      newErrors.password = 'Password must include at least one uppercase letter.'
    } else if (!/[a-z]/.test(form.password)) {
      newErrors.password = 'Password must include at least one lowercase letter.'
    } else if (!/[^A-Za-z0-9]/.test(form.password)) {
      newErrors.password = 'Password must include at least one special character.'
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.'
    } else if (form.confirmPassword !== form.password) {
      newErrors.confirmPassword = 'Passwords do not match.'
    }

    // Address Information
    if (!form.address.country.trim()) newErrors['address.country'] = 'Country is required.'
    if (!form.address.streetLine1.trim()) newErrors['address.streetLine1'] = 'Street address is required.'
    if (!phMunicipality) newErrors['address.city'] = 'Municipality is required.'
    if (!phBarangay) newErrors['address.barangay'] = 'Barangay is required.'
    if (!phProvince) newErrors['address.province'] = 'Province is required.'
    if (!phRegion) newErrors['address.region'] = 'Region is required.'
    if (!form.address.postalZipCode.trim()) newErrors['address.postalZipCode'] = 'Postal/Zip code is required.'
    if (phMunicipality && form.address.postalZipCode.trim() && zipValid === false) {
      newErrors['address.postalZipCode'] = zipError || 'The ZIP code entered is incorrect for the selected city. Please verify and try again.'
    }

    // Terms
    if (!form.terms) newErrors.terms = 'You must agree to the terms to continue.'

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => focusFirstInvalidField(newErrors), 0)
    }
    return Object.keys(newErrors).length === 0
  }

  // Wizard-only per-step validation. Returns true if valid, false otherwise.
  const validateStep = (step) => {
    const newErrors = {}

    if (step === 1) {
      if (!form.firstName.trim()) newErrors.firstName = 'First name is required.'
      if (!form.lastName.trim()) newErrors.lastName = 'Last name is required.'

      if (!form.email.trim()) {
        newErrors.email = 'Email is required.'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        newErrors.email = 'Enter a valid email address.'
      }

      if (!form.phone.trim()) {
        newErrors.phone = 'Phone number is required.'
      } else {
        const cleanedPhone = form.phone.replace(/\D/g, '')
        if (!/^639\d{9}$/.test(cleanedPhone)) {
          newErrors.phone = 'Phone number must start with +63 and contain 10 digits after the country code.'
        }
      }
    }

    if (step === 2) {
      if (!form.password) {
        newErrors.password = 'Password is required.'
      } else if (form.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters.'
      } else if (form.password.length > 64) {
        newErrors.password = 'Password must not exceed 64 characters.'
      } else if (!/[A-Z]/.test(form.password)) {
        newErrors.password = 'Password must include at least one uppercase letter.'
      } else if (!/[a-z]/.test(form.password)) {
        newErrors.password = 'Password must include at least one lowercase letter.'
      } else if (!/[^A-Za-z0-9]/.test(form.password)) {
        newErrors.password = 'Password must include at least one special character.'
      }
      if (!form.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password.'
      } else if (form.confirmPassword !== form.password) {
        newErrors.confirmPassword = 'Passwords do not match.'
      }
    }

    if (step === 3) {
      if (!form.address.country.trim()) newErrors['address.country'] = 'Country is required.'
      if (!form.address.streetLine1.trim()) newErrors['address.streetLine1'] = 'Street address is required.'
      if (!phMunicipality) newErrors['address.city'] = 'Municipality is required.'
      if (!phBarangay) newErrors['address.barangay'] = 'Barangay is required.'
      if (!phProvince) newErrors['address.province'] = 'Province is required.'
      if (!phRegion) newErrors['address.region'] = 'Region is required.'
      if (!form.address.postalZipCode.trim()) newErrors['address.postalZipCode'] = 'Postal/Zip code is required.'
      if (phMunicipality && form.address.postalZipCode.trim() && zipValid === false) {
        newErrors['address.postalZipCode'] = zipError || 'The ZIP code entered is incorrect for the selected city. Please verify and try again.'
      }
      if (!form.terms) newErrors.terms = 'You must agree to the terms to continue.'
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => focusFirstInvalidField(newErrors), 0)
      return false
    }
    return true
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return
    if (currentStep < TOTAL_STEPS) setCurrentStep(s => s + 1)
  }

  const goToPrevStep = () => {
    setErrors({})
    if (currentStep > 1) setCurrentStep(s => s - 1)
  }

  // If a submit-time error belongs to a hidden step on mobile, jump to that step.
  useEffect(() => {
    if (!errors || Object.keys(errors).length === 0) return
    if (errors.submit) return

    const stepForError = (key) => {
      if (['firstName', 'lastName', 'email', 'phone', 'middleName'].includes(key)) return 1
      if (['password', 'confirmPassword'].includes(key)) return 2
      if (key.startsWith('address.') || key === 'terms') return 3
      return 1
    }

    const firstErrorKey = Object.keys(errors)[0]
    const targetStep = stepForError(firstErrorKey)
    if (targetStep !== currentStep) {
      setCurrentStep(targetStep)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors])

  const handleSubmit = async e => {
    e.preventDefault()
    setSuccess('')
    setAddressValidationAttempted(true)
    setErrors({})

    // ZIP Code validation (await async validation before proceeding)
    if (phMunicipality && form.address.postalZipCode.trim()) {
      const zipResult = await validateZip(phMunicipality, form.address.postalZipCode.trim())
      if (zipResult.valid === false) {
        setErrors(prev => ({
          ...prev,
          'address.postalZipCode': zipResult.message || 'The ZIP code entered is incorrect for the selected city. Please verify and try again.',
        }))
        setTimeout(() => focusFirstInvalidField({ 'address.postalZipCode': true }), 0)
        setIsLoading(false)
        return
      }
    }

    if (!validate()) {
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
          barangay: form.address.barangay.trim(),
          stateProvince: form.address.stateProvince.trim(),
          postalZipCode: form.address.postalZipCode.trim(),
          country: form.address.country.trim(),
          addressLocationCityCode: phMunicipality || '',
          stateAddressProvinceCode: phProvince || '',
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
          setTimeout(() => focusFirstInvalidField(fieldErrors), 0)
        } else if (data.message) {
          const emailExists = /email.*(exist|used|already)/i.test(data.message)
          if (emailExists) {
            const emailError = { email: data.message }
            setErrors(emailError)
            setTimeout(() => focusFirstInvalidField(emailError), 0)
          } else {
            setErrors({ submit: data.message })
          }
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

  const passwordChecks = [
    { label: 'At least 8 characters', isValid: form.password.length >= 8 },
    { label: 'No more than 64 characters', isValid: form.password.length <= 64 && form.password.length > 0 },
    { label: 'At least one uppercase letter', isValid: /[A-Z]/.test(form.password) },
    { label: 'At least one lowercase letter', isValid: /[a-z]/.test(form.password) },
    { label: 'At least one special character', isValid: /[^A-Za-z0-9]/.test(form.password) },
  ]

  const passwordsMatch =
  form.confirmPassword.length > 0 && form.confirmPassword === form.password
  const passwordsMismatch =
    form.confirmPassword.length > 0 && form.confirmPassword !== form.password
  const passwordRulesMet = passwordChecks.filter(r => r.isValid).length

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
              <p className="text-sm font-medium text-red-400">{errors.submit}</p>
            </motion.div>
          )}

          {/* Mobile / tablet wizard header */}
          <div className="mb-6 md:hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Step {currentStep} of {TOTAL_STEPS}
              </span>
              <span className="text-xs font-semibold text-[var(--gold-primary)]">
                {currentStep === 1 && 'Personal Details'}
                {currentStep === 2 && 'Security'}
                {currentStep === 3 && 'Shipping Address'}
              </span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    n <= currentStep ? 'bg-[var(--gold-primary)]' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10" noValidate>

            {/* 1. PERSONAL INFO */}
            <div className={`space-y-5 ${currentStep !== 1 ? 'hidden md:block' : ''}`}>
              <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                <div className="w-8 h-8 rounded-full bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] flex justify-center items-center font-bold text-sm">1</div>
                <h2 className="text-xl font-medium text-white tracking-wide">Personal Details</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <motion.div animate={errors.firstName ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">First Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={form.firstName}
                    ref={registerFieldRef('firstName')}
                    onChange={e => updateField('firstName', e.target.value)}
                    className={getInputStyles(errors.firstName)}
                  />
                  {errors.firstName && <span style={{ color: '#ef4444' }} className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.firstName}</span>}
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
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={form.lastName}
                    ref={registerFieldRef('lastName')}
                    onChange={e => updateField('lastName', e.target.value)}
                    className={getInputStyles(errors.lastName)}
                  />
                  {errors.lastName && <span style={{ color: '#ef4444' }} className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.lastName}</span>}
                </motion.div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <motion.div animate={errors.email ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    ref={registerFieldRef('email')}
                    onChange={e => updateField('email', e.target.value)}
                    className={getInputStyles(errors.email)}
                  />
                  {errors.email && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</span>}
                </motion.div>

                <motion.div animate={errors.phone ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className={`flex rounded-xl border bg-white/5 backdrop-blur-sm transition-all duration-300 overflow-hidden focus-within:ring-2 ${
                    errors.phone
                      ? 'border-red-500/50 bg-red-500/10 focus:ring-red-500/50'
                      : 'border-white/10 focus:ring-[var(--gold-primary)] hover:border-white/30'
                  }`}>
                    <div className="flex items-center gap-1.5 px-3 py-3 bg-white/5 border-r border-white/10 shrink-0">
                      <img src="/ph-flag.png" alt="PH flag" className="w-5 h-5 object-cover rounded-sm" />
                      <span className="text-sm font-semibold text-white/80">+63</span>
                    </div>
                    <input
                      type="tel"
                      value={form.phoneDisplay}
                      ref={registerFieldRef('phone')}
                      onChange={e => {
                        const raw = e.target.value
                        if (!/^\d{0,10}$/.test(raw)) return
                        const subscriber = extractPhSubscriberNumber(raw)
                        const truncated = subscriber.slice(0, 10)
                        setForm(prev => ({
                          ...prev,
                          phoneDisplay: truncated,
                          phone: truncated ? toE164(truncated) : '',
                        }))
                        setErrors(prev => ({ ...prev, phone: '' }))
                      }}
                      onBlur={() => {
                        const subscriber = extractPhSubscriberNumber(form.phone)
                        if (subscriber && !isValidPhMobile(subscriber)) {
                          setErrors(prev => ({ ...prev, phone: 'Enter 10 digits starting with 9 after +63 (e.g. 9661341242).' }))
                        }
                      }}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="9171234567"
                      className="w-full px-3 py-3 bg-transparent text-white placeholder-white/30 focus:outline-none text-sm"
                    />
                  </div>
                  {errors.phone && <span style={{ color: '#ef4444' }} className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.phone}</span>}
                </motion.div>
              </div>
            </div>

            {/* 2. SECURITY */}
            <div className={`space-y-5 ${currentStep !== 2 ? 'hidden md:block' : ''}`}>
              <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                <div className="w-8 h-8 rounded-full bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] flex justify-center items-center font-bold text-sm">2</div>
                <h2 className="text-xl font-medium text-white tracking-wide">Security</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <motion.div animate={errors.password ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Password <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      ref={registerFieldRef('password')}
                      onChange={e => updateField('password', e.target.value)}
                      className={getInputStyles(errors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                    <ul className="mt-2 space-y-1">
                      {passwordChecks.map((rule) => {
                        return (
                          <li
                            key={rule.label}
                            className={`text-xs flex items-center gap-1.5 ${rule.isValid ? 'text-green-400' : 'text-[var(--text-muted)]'}`}
                          >
                            <CheckCircle2 className={`w-3 h-3 flex-shrink-0 ${rule.isValid ? 'opacity-100' : 'opacity-30'}`} />
                            <span className="whitespace-nowrap">{rule.label}</span>
                          </li>
                        )
                      })}
                    </ul>
                  {errors.password && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.password}</span>}
                </motion.div>

                <motion.div animate={errors.confirmPassword || passwordsMismatch ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">
                    Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={form.confirmPassword}
                      ref={registerFieldRef('confirmPassword')}
                      onChange={e => updateField('confirmPassword', e.target.value)}
                      className={`${getInputStyles(
                        errors.confirmPassword || passwordsMismatch
                      )} pr-16`}
                    />

                    {/* Match indicator — green check when equal, red X when not, hidden while empty */}
                    {form.confirmPassword.length > 0 && (
                      <span
                        className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      >
                        {passwordsMatch ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Live hint below the input */}
                  {form.confirmPassword.length > 0 && passwordsMatch && (
                    <span className="text-xs text-green-400 mt-1.5 flex items-center gap-1" style={{ color: '#4ade80' }}>
                      <CheckCircle2 className="w-3 h-3" />
                      Passwords match
                    </span>
                  )}

                  {form.confirmPassword.length > 0 && passwordsMismatch && (
                    <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1" style={{ color: '#ef4444' }}>
                      <AlertCircle className="w-3 h-3" />
                      Passwords don't match yet
                    </span>
                  )}

                  {errors.confirmPassword && !passwordsMismatch && (
                    <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1" style={{ color: '#ef4444' }}>
                      <AlertCircle className="w-3 h-3" />
                      {errors.confirmPassword}
                    </span>
                  )}
                </motion.div>
              </div>
            </div>

            {/* 3. ADDRESS */}
            <div className={`space-y-5 ${currentStep !== 3 ? 'hidden md:block' : ''}`}>
              <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                <div className="w-8 h-8 rounded-full bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] flex justify-center items-center font-bold text-sm">3</div>
                <h2 className="text-xl font-medium text-white tracking-wide">Shipping Address</h2>
              </div>

              <motion.div animate={getAddressError('country') ? shakeAnimation : {}}>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Country <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value="Philippines"
                  disabled
                  className={`${getInputStyles(getAddressError('country'))} cursor-not-allowed opacity-70`}
                />
                {getAddressError('country') && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{getAddressError('country')}</span>}
              </motion.div>

              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <motion.div animate={getAddressError('region') ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Region <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={phRegion}
                      ref={registerFieldRef('address.region')}
                      onChange={e => {
                        const opt = phRegions.find(r => r.psgcCode === e.target.value)
                        handlePhRegionChange(e.target.value, opt?.designation || opt?.name || '')
                      }}
                      className={`${getInputStyles(getAddressError('region'))} appearance-none cursor-pointer`}
                    >
                      <option value="" disabled className="text-gray-900">Select Region</option>
                      {phRegions.map(r => (
                        <option key={r.psgcCode} value={r.psgcCode} className="text-gray-900">{r.name}</option>
                      ))}
                    </select>
                    {getAddressError('region') && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{getAddressError('region')}</span>}
                  </motion.div>

                  <motion.div animate={getAddressError('province') ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Province <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={phProvince}
                      ref={registerFieldRef('address.province')}
                      disabled={!phRegion}
                      onChange={e => {
                        const opt = phProvinces.find(p => p.psgcCode === e.target.value)
                        handlePhProvinceChange(e.target.value, opt?.name || '')
                      }}
                      className={`${getInputStyles(getAddressError('province'))} appearance-none cursor-pointer disabled:opacity-40`}
                    >
                      <option value="" disabled className="text-gray-900">{phRegion ? 'Select Province' : 'Select a region first'}</option>
                      {phProvinces.map(p => (
                        <option key={p.psgcCode} value={p.psgcCode} className="text-gray-900">{p.name}</option>
                      ))}
                    </select>
                    {getAddressError('province') && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{getAddressError('province')}</span>}
                  </motion.div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <motion.div animate={getAddressError('city') ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Municipality / City <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={phMunicipality}
                      ref={registerFieldRef('address.city')}
                      disabled={!phProvince}
                      onChange={e => {
                        const opt = phMunicipalities.find(m => m.psgcCode === e.target.value)
                        handlePhMunicipalityChange(e.target.value, opt?.name || '')
                      }}
                      className={`${getInputStyles(getAddressError('city'))} appearance-none cursor-pointer disabled:opacity-40`}
                    >
                      <option value="" disabled className="text-gray-900">{phProvince ? 'Select Municipality' : 'Select a province first'}</option>
                      {phMunicipalities.map(m => (
                        <option key={m.psgcCode} value={m.psgcCode} className="text-gray-900">{m.name}</option>
                      ))}
                    </select>
                    {getAddressError('city') && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{getAddressError('city')}</span>}
                  </motion.div>

                  <motion.div animate={getAddressError('barangay') ? shakeAnimation : {}}>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Barangay <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={phBarangay}
                      disabled={!phMunicipality}
                      onChange={e => {
                        setPhBarangay(e.target.value)
                        setForm(prev => ({
                          ...prev,
                          address: { ...prev.address, barangay: e.target.value }
                        }))
                          if (e.target.value) {
                            setErrors(prev => ({ ...prev, 'address.barangay': '' }))
                          }
                      }}
                      ref={registerFieldRef('address.barangay')}
                      className={`${getInputStyles(getAddressError('barangay'))} appearance-none cursor-pointer disabled:opacity-40`}
                    >
                      <option value="" disabled className="text-gray-900">{phMunicipality ? 'Select Barangay' : 'Select a municipality first'}</option>
                      {phBarangays.map(b => (
                        <option key={b.psgcCode} value={b.name} className="text-gray-900">{b.name}</option>
                      ))}
                    </select>
                    {getAddressError('barangay') && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{getAddressError('barangay')}</span>}
                  </motion.div>
                </div>

                <motion.div animate={getAddressError('streetLine1') ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Street / Building / House No. *</label>
                  <input
                    type="text"
                    value={form.address.streetLine1}
                    ref={registerFieldRef('address.streetLine1')}
                    placeholder={phBarangay ? `Brgy. ${phBarangay}, add street/bldg...` : 'e.g. 123 Rizal St.'}
                    onChange={e => updateAddressField('streetLine1', e.target.value)}
                    className={getInputStyles(getAddressError('streetLine1'))}
                  />
                  {getAddressError('streetLine1') && <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{getAddressError('streetLine1')}</span>}
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

                <motion.div animate={getAddressError('postalZipCode') || (zipValid === false && phMunicipality && form.address.postalZipCode.trim()) ? shakeAnimation : {}}>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">Postal / ZIP Code <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.address.postalZipCode}
                      ref={registerFieldRef('address.postalZipCode')}
                      placeholder="e.g. 1000"
                      onChange={e => updateAddressField('postalZipCode', e.target.value)}
                      className={getInputStyles(getAddressError('postalZipCode') || (zipValid === false && phMunicipality && form.address.postalZipCode.trim())) + ' pr-10'}
                    />
                    {phMunicipality && form.address.postalZipCode.trim() && zipLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-400/30 border-t-[var(--gold-primary)] rounded-full animate-spin" />
                    )}
                    {phMunicipality && form.address.postalZipCode.trim() && zipValid === true && !zipLoading && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                    )}
                  </div>
                  {getAddressError('postalZipCode') && (
                    <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {getAddressError('postalZipCode')}
                    </span>
                  )}
                  {phMunicipality && form.address.postalZipCode.trim() && !zipLoading && zipValid === false && !getAddressError('postalZipCode') && (
                    <span className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {zipError || 'Invalid ZIP code for the selected city.'}
                    </span>
                  )}
                  {phMunicipality && form.address.postalZipCode.trim() && !zipLoading && zipValid === true && !getAddressError('postalZipCode') && (
                    <span className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Valid ZIP code for {form.address.city}
                    </span>
                  )}
                </motion.div>
              </>

              {/* TERMS & ACTIONS */}
              <div className="pt-6 border-t border-white/10">
                <motion.div animate={showTermsError ? shakeAnimation : {}} className="mt-2 mb-8">
                  <SitePolicyAgreement checked={form.terms} onChange={checked => updateField('terms', checked)}
                    inputRef={registerFieldRef('terms')} error={showTermsError} />
                </motion.div>

                {/* Desktop submit (unchanged) */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="hidden md:flex w-full py-4 bg-white text-black rounded-2xl font-bold tracking-wide hover:bg-[var(--gold-primary)] transition-all duration-300 disabled:opacity-70 justify-center items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {/* Mobile / tablet wizard nav */}

              </div>
            </div>
            {/* Mobile / tablet wizard nav — side by side */}
<div className="md:hidden mt-6 pt-6 border-t border-white/10">
  <div className="flex flex-row items-center gap-3">
    {currentStep > 1 && (
      <button
        type="button"
        onClick={goToPrevStep}
        className="flex-1 min-w-0 py-3.5 rounded-2xl font-bold tracking-wide bg-white/5 text-white border border-white/15 hover:bg-white/10 transition-all duration-300"
      >
        Back
      </button>
    )}

    {currentStep < TOTAL_STEPS ? (
      <button
        type="button"
        onClick={goToNextStep}
        className="flex-1 min-w-0 py-3.5 rounded-2xl font-bold tracking-wide bg-[var(--gold-primary)] text-black hover:bg-[var(--gold-secondary)] transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
      >
        Next
      </button>
    ) : (
      <button
        type="submit"
        disabled={isLoading}
        className="flex-1 min-w-0 py-3.5 rounded-2xl font-bold tracking-wide bg-[var(--gold-primary)] text-black hover:bg-[var(--gold-secondary)] transition-all duration-300 disabled:opacity-70 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
        ) : (
          <>
            Create Account
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    )}
  </div>
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
