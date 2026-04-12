/**
 * API Service Layer for CosmosCraft
 * Handles all HTTP requests to the backend
 */

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  // Add auth token if available
  const token = localStorage.getItem('authToken')
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include',
  }

  try {
    const response = await fetch(url, config)
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    const data = contentType?.includes('application/json') 
      ? await response.json() 
      : await response.text()

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 401) {
        // Unauthorized - clear token and redirect
        localStorage.removeItem('authToken')
        window.location.href = '/login'
        throw new Error('Session expired. Please login again.')
      }
      
      if (response.status === 403) {
        throw new Error('You do not have permission to perform this action.')
      }

      // Parse error message from response
      const errorMessage = data?.message 
        || data?.error 
        || data?.errors?.[0]?.message 
        || 'An error occurred'
      
      throw new Error(errorMessage)
    }

    return data
  } catch (error) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to server. Please check your internet connection.')
    }
    throw error
  }
}

// ============================================
// AUTH API
// ============================================
export const authAPI = {
  login: (email, password) => {
    return fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  signup: (userData) => {
    return fetchAPI('/auth/email-signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  },

  logout: () => {
    return fetchAPI('/auth/logout', {
      method: 'POST',
    })
  },

  verifyOTP: (userId, code) => {
    return fetchAPI('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ userId, code }),
    })
  },

  resendOTP: (email) => {
    return fetchAPI('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  googleLogin: () => {
    return fetchAPI('/auth/google')
  },

  getCurrentUser: () => {
    return fetchAPI('/auth/me')
  },
}

// ============================================
// USERS API
// ============================================
export const usersAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/users${queryString ? `?${queryString}` : ''}`)
  },

  getById: (id) => {
    return fetchAPI(`/users/${id}`)
  },

  create: (userData) => {
    return fetchAPI('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  },

  update: (id, userData) => {
    return fetchAPI(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  },

  delete: (id) => {
    return fetchAPI(`/users/${id}`, {
      method: 'DELETE',
    })
  },

  updateRole: (id, role) => {
    return fetchAPI(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  },
}

// ============================================
// PRODUCTS API
// ============================================
export const productsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/products${queryString ? `?${queryString}` : ''}`)
  },

  getById: (id) => {
    return fetchAPI(`/products/${id}`)
  },

  create: (productData) => {
    return fetchAPI('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    })
  },

  update: (id, productData) => {
    return fetchAPI(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    })
  },

  delete: (id) => {
    return fetchAPI(`/products/${id}`, {
      method: 'DELETE',
    })
  },

  updateStock: (id, quantity) => {
    return fetchAPI(`/products/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    })
  },
}

// ============================================
// ORDERS API
// ============================================
export const ordersAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/orders${queryString ? `?${queryString}` : ''}`)
  },

  getById: (id) => {
    return fetchAPI(`/orders/${id}`)
  },

  getByUser: (userId) => {
    return fetchAPI(`/orders/user/${userId}`)
  },

  create: (orderData) => {
    return fetchAPI('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    })
  },

  update: (id, orderData) => {
    return fetchAPI(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData),
    })
  },

  updateStatus: (id, status) => {
    return fetchAPI(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  cancel: (id) => {
    return fetchAPI(`/orders/${id}/cancel`, {
      method: 'POST',
    })
  },

  getMessages: (orderId) => {
    return fetchAPI(`/orders/${orderId}/messages`)
  },

  sendMessage: (orderId, message) => {
    return fetchAPI(`/orders/${orderId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  },
}

// ============================================
// PROJECTS API (Custom Guitar Builds)
// ============================================
export const projectsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/projects${queryString ? `?${queryString}` : ''}`)
  },

  getById: (id) => {
    return fetchAPI(`/projects/${id}`)
  },

  getByUser: (userId) => {
    return fetchAPI(`/projects/user/${userId}`)
  },

  getByStaff: (staffId) => {
    return fetchAPI(`/projects/staff/${staffId}`)
  },

  create: (projectData) => {
    return fetchAPI('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    })
  },

  update: (id, projectData) => {
    return fetchAPI(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    })
  },

  updateStage: (id, stage) => {
    return fetchAPI(`/projects/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    })
  },

  assignStaff: (id, staffId) => {
    return fetchAPI(`/projects/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ staffId }),
    })
  },

  getMessages: (projectId) => {
    return fetchAPI(`/projects/${projectId}/messages`)
  },

  sendMessage: (projectId, message) => {
    return fetchAPI(`/projects/${projectId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  },

  getTimeline: (projectId) => {
    return fetchAPI(`/projects/${projectId}/timeline`)
  },
}

// ============================================
// APPOINTMENTS API
// ============================================
export const appointmentsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return fetchAPI(`/appointments${queryString ? `?${queryString}` : ''}`)  },

  getById: (id) => {
    return fetchAPI(`/appointments/${id}`)
  },

  getByUser: (userId) => {
    return fetchAPI(`/appointments/user/${userId}`)
  },

  getByStaff: (staffId) => {
    return fetchAPI(`/appointments/staff/${staffId}`)
  },

  create: (appointmentData) => {
    return fetchAPI('/appointments', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    })
  },

  update: (id, appointmentData) => {
    return fetchAPI(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(appointmentData),
    })
  },

  updateStatus: (id, status) => {
    return fetchAPI(`/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  cancel: (id) => {
    return fetchAPI(`/appointments/${id}/cancel`, {
      method: 'POST',
    })
  },
}

// ============================================
// ANALYTICS API
// ============================================
export const analyticsAPI = {
  getDashboardStats: () => {
    return fetchAPI('/analytics/dashboard')
  },

  getRevenueStats: (period = 'month') => {
    return fetchAPI(`/analytics/revenue?period=${period}`)
  },

  getOrderStats: () => {
    return fetchAPI('/analytics/orders')
  },

  getUserStats: () => {
    return fetchAPI('/analytics/users')
  },

  getTopProducts: (limit = 10) => {
    return fetchAPI(`/analytics/top-products?limit=${limit}`)
  },

  getRecentActivity: () => {
    return fetchAPI('/analytics/recent-activity')
  },
}

// ============================================
// UPLOAD API
// ============================================
export const uploadAPI = {
  uploadImage: async (file, folder = 'general') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)

    const token = localStorage.getItem('authToken')
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    return response.json()
  },

  deleteFile: (publicId) => {
    return fetchAPI('/upload/delete', {
      method: 'POST',
      body: JSON.stringify({ publicId }),
    })
  },
}

// ============================================
// CART API
// ============================================
export const cartAPI = {
  getCart: () => {
    return fetchAPI('/cart')
  },

  getCartItemCount: () => {
    return fetchAPI('/cart/count')
  },

  addItem: (itemData) => {
    return fetchAPI('/cart/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    })
  },

  updateItem: (id, updateData) => {
    return fetchAPI(`/cart/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    })
  },

  removeItem: (id) => {
    return fetchAPI(`/cart/items/${id}`, {
      method: 'DELETE',
    })
  },

  clearCart: () => {
    return fetchAPI('/cart', {
      method: 'DELETE',
    })
  },

  prepareCheckout: () => {
    return fetchAPI('/cart/prepare-checkout', {
      method: 'POST',
    })
  },

  checkout: (checkoutData) => {
    return fetchAPI('/cart/checkout', {
      method: 'POST',
      body: JSON.stringify(checkoutData),
    })
  },
}

export default {
  auth: authAPI,
  users: usersAPI,
  products: productsAPI,
  orders: ordersAPI,
  projects: projectsAPI,
  appointments: appointmentsAPI,
  analytics: analyticsAPI,
  upload: uploadAPI,
  cart: cartAPI,
}
