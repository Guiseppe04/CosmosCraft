import { useState, useCallback } from 'react'
import { API } from '../utils/apiConfig'

/**
 * Reusable hook for validating Philippine zip codes against a selected city.
 *
 * Uses the backend /api/address/validate-zip endpoint, which cross-references
 * the zip code against the `@aivangogh/ph-address` PSGC city code and the
 * consolidated zip-code dataset.
 *
 * Usage:
 *   const { isValid, isLoading, error, validZips, validate, clearValidation } = useZipValidation()
 *
 *   // reactive validation
 *   useEffect(() => {
 *     if (phMunicipality && postalZipCode) {
 *       validate(phMunicipality, postalZipCode)
 *     }
 *   }, [phMunicipality, postalZipCode, validate])
 *
 *   // the component can read `isValid` (null / true / false) to style the input
 */
export function useZipValidation() {
  const [state, setState] = useState({
    isValid: null,
    isLoading: false,
    error: null,
    validZips: null,
    city: null,
  })

  const validate = useCallback(async (cityCode, zipCode) => {
    if (!cityCode || !zipCode) {
      setState({
        isValid: null,
        isLoading: false,
        error: null,
        validZips: null,
        city: null,
      })
      return { valid: null }
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const params = new URLSearchParams({
        cityCode: String(cityCode),
        zipCode: String(zipCode),
      })

      const response = await fetch(`${API}/api/address/validate-zip?${params}`, {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      })

      const data = await response.json()

      if (!response.ok) {
        const msg = data.message || 'Validation failed'
        setState({
          isValid: false,
          isLoading: false,
          error: msg,
          validZips: null,
          city: null,
        })
        return { valid: false, error: msg }
      }

      const result = data.data
      setState({
        isValid: result.valid,
        isLoading: false,
        error: null,
        validZips: result.zips || null,
        city: result.city || null,
      })
      return result
    } catch (err) {
      const msg = err.message || 'Network error. Please check your connection.'
      setState({
        isValid: false,
        isLoading: false,
        error: msg,
        validZips: null,
        city: null,
      })
      return { valid: false, error: msg }
    }
  }, [])

  const clearValidation = useCallback(() => {
    setState({
      isValid: null,
      isLoading: false,
      error: null,
      validZips: null,
      city: null,
    })
  }, [])

  return {
    isValid: state.isValid,
    isLoading: state.isLoading,
    error: state.error,
    validZips: state.validZips,
    city: state.city,
    validate,
    clearValidation,
  }
}
