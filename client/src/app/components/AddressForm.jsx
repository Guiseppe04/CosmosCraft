import { useEffect, useMemo, useState } from 'react'
import { Country } from 'country-state-city'
import {
  getAllProvinces,
  getMunicipalitiesByProvince,
  getBarangaysByMunicipality
} from '@aivangogh/ph-address'
import { Home, Building, X } from 'lucide-react'

const ALL_COUNTRIES = Country.getAllCountries()
const PHILIPPINES = ALL_COUNTRIES.find((c) => c.isoCode === 'PH')
const COUNTRIES = PHILIPPINES
  ? [PHILIPPINES, ...ALL_COUNTRIES.filter((c) => c.isoCode !== 'PH')]
  : ALL_COUNTRIES

const ADDRESS_CATEGORIES = ['Home', 'Work', 'Other']

const resolveProvinceCode = (country, rawProvince) => {
  if (country !== 'PH' || !rawProvince) return rawProvince || ''
  const provinces = getAllProvinces()
  const matched = provinces.find(
    (p) => p.psgcCode === rawProvince || p.name?.toLowerCase() === String(rawProvince).toLowerCase()
  )
  return matched ? matched.psgcCode : rawProvince
}

const resolveCityCode = (provinceCode, rawCity) => {
  if (!provinceCode || !rawCity) return rawCity || ''
  try {
    const cities = getMunicipalitiesByProvince(provinceCode)
    const matchedCity = cities.find(
      (c) => c.psgcCode === rawCity || c.name?.toLowerCase() === String(rawCity).toLowerCase()
    )
    return matchedCity ? matchedCity.psgcCode : rawCity
  } catch (err) {
    return rawCity || ''
  }
}

const normalizeInitialAddress = (address = {}) => {
  const rawCountry = String(address.country || address.country_code || 'PH').toUpperCase()
  const rawProvince = address.stateProvince ?? address.province ?? ''
  const resolvedProvinceCode = resolveProvinceCode(rawCountry, rawProvince)
  const rawCity = address.city ?? ''
  const resolvedCityCode = resolveCityCode(resolvedProvinceCode, rawCity)
  const rawLabel = address.label || address.category || 'Home'

  return {
    label: ADDRESS_CATEGORIES.includes(rawLabel) ? rawLabel : 'Home',
    country: /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : 'PH',
    streetLine1: address.streetLine1 ?? address.street_line1 ?? address.street ?? '',
    streetLine2: address.streetLine2 ?? address.street_line2 ?? address.street2 ?? '',
    province: resolvedProvinceCode || '',
    city: resolvedCityCode || '',
    barangay: address.barangay ?? '',
    stateProvince: rawProvince || '',
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
}) {
  const [formData, setFormData] = useState(() => normalizeInitialAddress(initialAddress))
  const [errors, setErrors] = useState({})
  const [locationData, setLocationData] = useState({ provinces: [], cities: [], barangays: [] })

  const isPhilippines = formData.country === 'PH'

  useEffect(() => {
    setFormData(normalizeInitialAddress(initialAddress))
  }, [initialAddress])

  useEffect(() => {
    if (!isPhilippines) {
      setLocationData({ provinces: [], cities: [], barangays: [] })
      return
    }

    if (locationData.provinces.length > 0) return

    try {
      const provinces = getAllProvinces()
      setLocationData((prev) => ({ ...prev, provinces, cities: [], barangays: [] }))
    } catch (err) {
      console.error('Failed to load provinces:', err)
      setLocationData({ provinces: [], cities: [], barangays: [] })
    }
  }, [isPhilippines, locationData.provinces.length])

  useEffect(() => {
    if (!isPhilippines || !formData.province) return
    try {
      const cities = getMunicipalitiesByProvince(formData.province)
      setLocationData((prev) => ({ ...prev, cities, barangays: [] }))
    } catch (err) {
      console.error('Failed to load cities:', err)
      setLocationData((prev) => ({ ...prev, cities: [], barangays: [] }))
    }
  }, [isPhilippines, formData.province])

  useEffect(() => {
    if (!isPhilippines || !formData.city) return
    try {
      const barangays = getBarangaysByMunicipality(formData.city)
      setLocationData((prev) => ({ ...prev, barangays }))
    } catch (err) {
      console.error('Failed to load barangays:', err)
      setLocationData((prev) => ({ ...prev, barangays: [] }))
    }
  }, [isPhilippines, formData.city])

  const handleProvinceChange = (provinceCode, provinceName) => {
    setFormData((prev) => ({
      ...prev,
      province: provinceCode,
      stateProvince: provinceName,
      city: '',
      barangay: '',
    }))
    if (!provinceCode) {
      setLocationData((prev) => ({ ...prev, cities: [], barangays: [] }))
      return
    }
    try {
      const cities = getMunicipalitiesByProvince(provinceCode)
      setLocationData((prev) => ({ ...prev, cities, barangays: [] }))
    } catch (err) {
      console.error('Failed to load cities:', err)
      setLocationData((prev) => ({ ...prev, cities: [], barangays: [] }))
    }
  }

  const handleCityChange = (cityCode, cityName) => {
    setFormData((prev) => ({
      ...prev,
      city: cityCode,
      barangay: '',
    }))
    if (!cityCode) {
      setLocationData((prev) => ({ ...prev, barangays: [] }))
      return
    }
    try {
      const barangays = getBarangaysByMunicipality(cityCode)
      setLocationData((prev) => ({ ...prev, barangays }))
    } catch (err) {
      console.error('Failed to load barangays:', err)
      setLocationData((prev) => ({ ...prev, barangays: [] }))
    }
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const validate = () => {
    const nextErrors = {}
    if (!formData.label?.trim()) nextErrors.label = 'Address label is required'
    if (!formData.streetLine1?.trim()) nextErrors.streetLine1 = 'Street address is required'
    if (!formData.country?.trim()) nextErrors.country = 'Country is required'
    if (isPhilippines) {
      if (!formData.province) nextErrors.province = 'Province is required'
      if (!formData.city) nextErrors.city = 'City is required'
      if (!formData.barangay) nextErrors.barangay = 'Barangay is required'
    } else {
      if (!formData.stateProvince?.trim()) nextErrors.stateProvince = 'Province is required'
      if (!formData.city?.trim()) nextErrors.city = 'City is required'
    }
    if (!formData.postalZipCode?.trim()) nextErrors.postalZipCode = 'Postal code is required'
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
    const selectedProvince = locationData.provinces.find((p) => p.psgcCode === formData.province)
    return selectedProvince?.name || String(formData.stateProvince || formData.province || '').trim()
  }

  const handleSubmit = () => {
    if (!validate()) return
    const payload = {
      label: formData.label,
      country: formData.country,
      streetLine1: formData.streetLine1.trim(),
      streetLine2: formData.streetLine2?.trim() || '',
      city: resolveCityName(),
      stateProvince: resolveProvinceName(),
      postalZipCode: formData.postalZipCode.trim(),
      isDefault: Boolean(formData.isDefault),
    }
    onSubmit(payload)
  }

  return (
    <div className="space-y-4">
      {showCategory && (
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Address Label *</label>
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
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Country *</label>
        <select
          value={formData.country}
          onChange={(e) => handleChange('country', e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] appearance-none cursor-pointer"
        >
          <option value="" disabled className="bg-[var(--surface-dark)]">Select Country</option>
          {COUNTRIES.map((country) => (
            <option key={country.isoCode} value={country.isoCode} className="bg-[var(--surface-dark)]">
              {country.name}
            </option>
          ))}
        </select>
        {errors.country && <p className="text-xs text-red-400 mt-1.5">{errors.country}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Street Address 1 *</label>
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

      {isPhilippines ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Province *</label>
              <select
                value={formData.province}
                onChange={(e) => {
                  const selected = locationData.provinces.find((option) => option.psgcCode === e.target.value)
                  handleProvinceChange(e.target.value, selected?.name || '')
                }}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] appearance-none cursor-pointer"
              >
                <option value="" className="bg-[var(--surface-dark)]">Select Province</option>
                {locationData.provinces.map((province) => (
                  <option key={province.psgcCode} value={province.psgcCode} className="bg-[var(--surface-dark)]">
                    {province.name}
                  </option>
                ))}
              </select>
              {errors.province && <p className="text-xs text-red-400 mt-1.5">{errors.province}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">City / Municipality *</label>
              <select
                value={formData.city}
                onChange={(e) => {
                  const selected = locationData.cities.find((option) => option.psgcCode === e.target.value)
                  handleCityChange(e.target.value, selected?.name || '')
                }}
                disabled={!formData.province}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="" className="bg-[var(--surface-dark)]">
                  {formData.province ? 'Select City' : 'Select a province first'}
                </option>
                {locationData.cities.map((city) => (
                  <option key={city.psgcCode} value={city.psgcCode} className="bg-[var(--surface-dark)]">
                    {city.name}
                  </option>
                ))}
              </select>
              {errors.city && <p className="text-xs text-red-400 mt-1.5">{errors.city}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Barangay *</label>
            <select
              value={formData.barangay}
              onChange={(e) => handleChange('barangay', e.target.value)}
              disabled={!formData.city}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)] appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="" className="bg-[var(--surface-dark)]">
                {formData.city ? 'Select Barangay' : 'Select a city first'}
              </option>
              {locationData.barangays.map((barangay) => (
                <option key={barangay.psgcCode} value={barangay.name} className="bg-[var(--surface-dark)]">
                  {barangay.name}
                </option>
              ))}
            </select>
            {errors.barangay && <p className="text-xs text-red-400 mt-1.5">{errors.barangay}</p>}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">State / Province *</label>
            <input
              type="text"
              value={formData.stateProvince}
              onChange={(e) => handleChange('stateProvince', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
              placeholder="State / Province"
            />
            {errors.stateProvince && <p className="text-xs text-red-400 mt-1.5">{errors.stateProvince}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">City *</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
              placeholder="City"
            />
            {errors.city && <p className="text-xs text-red-400 mt-1.5">{errors.city}</p>}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Postal Code *</label>
        <input
          type="text"
          value={formData.postalZipCode}
          onChange={(e) => handleChange('postalZipCode', e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]/20 focus:border-[var(--gold-primary)]"
          placeholder="1234"
        />
        {errors.postalZipCode && <p className="text-xs text-red-400 mt-1.5">{errors.postalZipCode}</p>}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={formData.isDefault}
          onChange={(e) => handleChange('isDefault', e.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-primary)] text-[var(--gold-primary)] focus:ring-[var(--gold-primary)]"
        />
        <span className="text-sm text-[var(--text-muted)]">Set as default address</span>
      </div>

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
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  )
}
