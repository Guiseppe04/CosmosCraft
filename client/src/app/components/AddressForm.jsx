import { useEffect, useMemo, useState, useId as reactUseId } from 'react'
import { regions, provincesInRegion, citiesFor, barangaysFor, resolveSavedLocation } from '../utils/phAddress'
import { Home, Building, X, CheckCircle2, AlertCircle, Loader } from 'lucide-react'
import { useZipValidation } from '../hooks/useZipValidation'
const ADDRESS_CATEGORIES = ['Home', 'Work', 'Other']

const locationSelectClass = 'w-full min-w-0 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] disabled:opacity-50'

function LocationSelect({ id, label, value, onChange, options, placeholder, disabled, error, required = true }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-muted)] mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <select id={id} aria-label={label} aria-required={required} aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined} value={value}
        onChange={event => onChange(event.target.value)} disabled={disabled} className={locationSelectClass}>
        <option value="">{placeholder}</option>
        {options.map(item => <option key={item.psgcCode} value={item.psgcCode}>
          {item.designation ? (item.designation === 'NCR' ? 'NCR – ' + item.name : item.name + ' – ' + item.designation) : item.name}
        </option>)}
      </select>
      {error && <p id={id + '-error'} role="alert" className="text-xs text-red-400 mt-1.5">{error}</p>}
    </div>
  )
}

const normalizeInitialAddress = (address = {}) => {
  const location = resolveSavedLocation(address)
  const rawLabel = address.label || address.category || 'Home'

  return {
    label: ADDRESS_CATEGORIES.includes(rawLabel) ? rawLabel : 'Home',
    country: 'PH',
    streetLine1: address.streetLine1 ?? address.street_line1 ?? address.street ?? '',
    streetLine2: address.streetLine2 ?? address.street_line2 ?? address.street2 ?? '',
    ...location,
    stateProvince: address.stateProvince ?? address.province ?? '',
    postalZipCode: address.postalZipCode ?? address.postal_code ?? address.postalCode ?? '',
    isDefault: Boolean(address.isDefault ?? address.is_default),
  }
}

export function AddressForm({
  initialAddress = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save Address',
  isSubmitting = false,
  showCategory = true,
  showDefault = true,
}) {
  const addressFormId = reactUseId()
  const [formData, setFormData] = useState(() => normalizeInitialAddress(initialAddress))
  const [errors, setErrors] = useState({})
  const isPhilippines = true
  const isNcr = formData.region === '1300000000'
  const locationData = useMemo(() => ({
    provinces: provincesInRegion(formData.region),
    cities: citiesFor(formData.region, formData.province),
    barangays: formData.city ? barangaysFor(formData.city) : [],
  }), [formData.region, formData.province, formData.city])
  const provinceRequired = !isNcr && !locationData.cities.some(c => c.psgcCode === formData.city && !formData.province)

  const {
    isValid: zipValid,
    message: zipMessage,
    isLoading: zipLoading,
    error: zipError,
    validate: validateZip,
    clearValidation: clearZipValidation,
  } = useZipValidation()

  // Reactively validate zip whenever city (PSGC code) or postal code changes
  useEffect(() => {
    if (!isPhilippines) {
      clearZipValidation()
      return
    }
    validateZip(formData.city, formData.postalZipCode)
  }, [isPhilippines, formData.city, formData.postalZipCode, validateZip, clearZipValidation])

  const initialAddressKey = useMemo(
    () => JSON.stringify(initialAddress || {}),
    [initialAddress]
  )

  useEffect(() => {
    setFormData(normalizeInitialAddress(initialAddress))
    // Reset the form only when the address *content* changes, not on every render
    // (callers may pass fresh object literals like `{}` that change identity on
    // each render, which would otherwise wipe the user's input after a failed save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddressKey])

  const resetLocation = (changes) => {
    setFormData(prev => ({ ...prev, ...changes }))
    setErrors({})
  }
  const handleRegionChange = region => resetLocation({ region, province: '', stateProvince: '', city: '', barangay: '' })
  const handleProvinceChange = province => resetLocation({ province, city: '', barangay: '' })
  const handleCityChange = city => resetLocation({ city, barangay: '' })

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const validate = () => {
    const nextErrors = {}
    if (showCategory && !formData.label?.trim()) nextErrors.label = 'Address label is required'
    if (!formData.streetLine1?.trim()) nextErrors.streetLine1 = 'Street address is required'
    if (!formData.country?.trim()) nextErrors.country = 'Country is required'
    if (!formData.region) nextErrors.region = 'Select a region'
    if (provinceRequired && !locationData.provinces.some(p => p.psgcCode === formData.province)) nextErrors.province = 'Select a province or an independent city'
    if (!locationData.cities.some(c => c.psgcCode === formData.city)) nextErrors.city = 'Select a city in the selected region or province'
    if (!locationData.barangays.some(b => b.psgcCode === formData.barangay)) nextErrors.barangay = 'Select a barangay in the selected city'
    if (!formData.postalZipCode?.trim()) {
      nextErrors.postalZipCode = 'Postal code is required'
    } else if (isPhilippines && formData.city && formData.postalZipCode.trim() && zipValid === false) {
      nextErrors.postalZipCode = zipError || 'The ZIP code entered is incorrect for the selected city.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const resolveCityName = () => {
    if (!isPhilippines) return formData.city?.trim() || ''
    const selectedCity = locationData.cities.find((c) => c.psgcCode === formData.city)
    return selectedCity?.name || String(formData.city || '').trim()
  }

  const resolveProvinceName = () => {
    if (!isPhilippines) return formData.stateProvince?.trim() || ''
    if (!formData.province) return null
    const selectedProvince = locationData.provinces.find((p) => p.psgcCode === formData.province)
    return selectedProvince?.name || String(formData.stateProvince || formData.province || '').trim()
  }

  const handleSubmit = () => {
    if (!validate()) return
    const payload = {
      ...(showCategory ? { label: formData.label } : {}),
      country: 'PH',
      regionCode: formData.region,
      streetLine1: formData.streetLine1.trim(),
      streetLine2: formData.streetLine2?.trim() || '',
      city: resolveCityName(),
      stateProvince: resolveProvinceName(),
      barangay: locationData.barangays.find(b => b.psgcCode === formData.barangay)?.name || '',
      postalZipCode: formData.postalZipCode.trim(),
      ...(showDefault ? { isDefault: Boolean(formData.isDefault) } : {}),
    }
    onSubmit(payload)
  }

  return (
    <div className="space-y-4">
      {showCategory && (
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Address Label <span className="text-red-400" style={{ color: '#f87171' }}>*</span></label>
          <div className="flex gap-2">
            {ADDRESS_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleChange('label', category)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                  formData.label === category
                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          {errors.label && <p className="text-xs text-red-400 mt-1.5">{errors.label}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Country <span className="text-red-400" style={{ color: '#f87171' }}>*</span></label>
        <input value="Philippines" readOnly aria-label="Country" className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)]" />
        {errors.country && <p className="text-xs text-red-400 mt-1.5">{errors.country}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Street Address 1 <span className="text-red-400" style={{ color: '#f87171' }}>*</span></label>
        <input
          type="text"
          value={formData.streetLine1}
          onChange={(e) => handleChange('streetLine1', e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
          placeholder="House number, street name"
        />
        {errors.streetLine1 && <p className="text-xs text-red-400 mt-1.5">{errors.streetLine1}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Street Address 2</label>
        <input
          type="text"
          value={formData.streetLine2}
          onChange={(e) => handleChange('streetLine2', e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
          placeholder="Apt, unit, floor, building"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LocationSelect id={addressFormId + '-region'} label="Region" value={formData.region}
          onChange={handleRegionChange} options={regions} placeholder="Select Region" error={errors.region} />
        {!isNcr && <LocationSelect id={addressFormId + '-province'} label="Province" value={formData.province}
          onChange={handleProvinceChange} options={locationData.provinces} placeholder="Select Province"
          disabled={!formData.region} required={provinceRequired} error={errors.province} />}
        <LocationSelect id={addressFormId + '-city'} label="City / Municipality" value={formData.city}
          onChange={handleCityChange} options={locationData.cities}
          placeholder={!formData.region ? 'Select a region first' : !locationData.cities.length ? 'Select a province first' : 'Select City / Municipality'}
          disabled={!formData.region || !locationData.cities.length} error={errors.city} />
        <LocationSelect id={addressFormId + '-barangay'} label="Barangay" value={formData.barangay}
          onChange={value => handleChange('barangay', value)} options={locationData.barangays}
          placeholder={formData.city ? 'Select Barangay' : 'Select a city first'} disabled={!formData.city} error={errors.barangay} />
      </div>
      {!isNcr && formData.region && !formData.province && locationData.cities.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">Select a province, or choose an independent city directly.</p>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Postal Code <span className="text-red-400" style={{ color: '#f87171' }}>*</span></label>
        <div className="relative">
          <input
            type="text"
            value={formData.postalZipCode}
            onChange={(e) => handleChange('postalZipCode', e.target.value)}
            className={`w-full px-4 py-2.5 pr-10 rounded-lg border bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] ${
              errors.postalZipCode
                ? 'border-red-500'
                : isPhilippines && formData.city && formData.postalZipCode.trim() && zipValid === true
                ? 'border-green-500'
                : 'border-[var(--border)]'
            }`}
            placeholder="1234"
          />
          {isPhilippines && formData.city && formData.postalZipCode.trim() && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {zipLoading && <Loader className="w-4 h-4 text-[var(--text-muted)] animate-spin" />}
              {!zipLoading && zipValid === true && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              {!zipLoading && zipValid === false && <AlertCircle className="w-4 h-4 text-red-400" />}
            </div>
          )}
        </div>
        {errors.postalZipCode && <p className="text-xs text-red-400 mt-1.5">{errors.postalZipCode}</p>}
        {!errors.postalZipCode && isPhilippines && formData.city && formData.postalZipCode.trim() && !zipLoading && zipValid === false && zipError && (
          <p className="text-xs text-red-400 mt-1.5">{zipError}</p>
        )}
        {!errors.postalZipCode && isPhilippines && formData.city && formData.postalZipCode.trim() && !zipLoading && zipValid === true && (
          <p className="text-xs text-green-400 mt-1.5"><span style={{ color: '#10b981' }}>{zipMessage || 'Valid ZIP code for the selected city ✓'}</span></p>
        )}
      </div>

      {showDefault && <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={formData.isDefault}
          onChange={(e) => handleChange('isDefault', e.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-primary)] text-[var(--gold-primary)] focus:ring-[var(--gold-primary)]"
        />
        <span className="text-sm text-[var(--text-muted)]">Set as default address</span>
      </div>}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-light)] hover:border-[var(--gold-primary)] transition-all"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || zipLoading}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  )
}
