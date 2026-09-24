/**
 * Centralized Feedback & Review Service
 * Handles public testimonials, public product reviews, customer eligibility, and admin moderation.
 */
import { API, getAuthHeaders } from '../utils/apiConfig'

const API_URL = API

async function request(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const baseHeaders = isFormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers }
  const headers = getAuthHeaders(baseHeaders)

  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
    body: isFormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
  })
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(data.message || 'Request failed')
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      error.fieldErrors = data.errors
    }
    throw error
  }
  return data
}

export const feedbackService = {
  // Public endpoints
  getPublicTestimonials: (limit = 10) => {
    return request(`/api/reviews/testimonials?limit=${encodeURIComponent(limit)}`)
  },

  getPublicProductReviews: (productId) => {
    return request(`/api/reviews/products/${productId}/public`)
  },

  // Customer eligibility & submissions
  getProductReviewEligibility: () => {
    return request('/api/reviews/product-eligibility')
  },

  getCustomizationFeedbackEligibility: () => {
    return request('/api/reviews/customization-eligibility')
  },

  createProductReview: (body) => {
    return request('/api/reviews/products', { method: 'POST', body })
  },

  updateProductReview: (reviewId, body) => {
    return request(`/api/reviews/products/${reviewId}`, { method: 'PUT', body })
  },

  createCustomizationFeedback: (body) => {
    return request('/api/reviews/customizations', { method: 'POST', body })
  },

  updateCustomizationFeedback: (feedbackId, body) => {
    return request(`/api/reviews/customizations/${feedbackId}`, { method: 'PUT', body })
  },

  // Admin moderation endpoints
  getAdminReviews: (params = {}) => {
    const cleanParams = Object.entries(params).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'undefined') {
        acc[k] = v
      }
      return acc
    }, {})
    const qs = new URLSearchParams(cleanParams).toString()
    return request(`/api/reviews/admin${qs ? '?' + qs : ''}`)
  },

  updateAdminProductReviewStatus: (reviewId, body) => {
    return request(`/api/reviews/admin/product/${reviewId}/status`, { method: 'PUT', body })
  },

  updateAdminCustomizationFeedbackStatus: (feedbackId, body) => {
    return request(`/api/reviews/admin/customization/${feedbackId}/status`, { method: 'PUT', body })
  },

  deleteAdminProductReview: (reviewId) => {
    return request(`/api/reviews/admin/product/${reviewId}`, { method: 'DELETE' })
  },

  deleteAdminCustomizationFeedback: (feedbackId) => {
    return request(`/api/reviews/admin/customization/${feedbackId}`, { method: 'DELETE' })
  },
}

export default feedbackService
