import { useState, useCallback, useRef } from 'react'
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
  const requestSequence = useRef(0)
  const [state, setState] = useState({
    isValid: null,
    isLoading: false,
    error: null,
    validZips: null,
    city: null,
  })

  const validate = useCallback(async (cityCode, zipCode) => {
    const sequence = ++requestSequence.current
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

    setState((prev) => ({ ...prev, isValid: null, isLoading: true, error: null }))

    try {
      const params = new URLSearchParams({
        cityCode: String(cityCode),
        zipCode: String(zipCode),
      })

      const response = await fetch(`${API}/api/address/validate-zip?${params}`, {
        credentials: 'include',
      })

      const data = await response.json()
      if (sequence !== requestSequence.current) return { valid: null }

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
        message: result.message,
        isLoading: false,
        error: result.valid === false ? result.message : null,
        validZips: result.zips || null,
        city: result.city || null,
      })
      return result
    } catch (err) {
      if (sequence !== requestSequence.current) return { valid: null }
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
    requestSequence.current++
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
    message: state.message,
    isLoading: state.isLoading,
    error: state.error,
    validZips: state.validZips,
    city: state.city,
    validate,
    clearValidation,
  }
}
