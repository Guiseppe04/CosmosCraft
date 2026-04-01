/**
 * Centralized API utility for Admin Dashboard.
 * All functions use credentials: 'include' so the access token cookie is sent automatically.
 */

const API_URL = import.meta.env.VITE_API_URL

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

// ─── Products ────────────────────────────────────────────────────────────────
export const adminApi = {
  // Products
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/products${qs ? '?' + qs : ''}`)
  },
  getProduct: (id) => request(`/api/products/${id}`),
  createProduct: (body) => request('/api/products', { method: 'POST', body }),
  updateProduct: (id, body) => request(`/api/products/${id}`, { method: 'PUT', body }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),

  // Product images
  addProductImage: (id, body) => request(`/api/products/${id}/images`, { method: 'POST', body }),
  deleteProductImage: (id, imageId) => request(`/api/products/${id}/images/${imageId}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request('/api/products/categories'),
  createCategory: (body) => request('/api/products/categories', { method: 'POST', body }),
  updateCategory: (id, body) => request(`/api/products/categories/${id}`, { method: 'PUT', body }),
  deleteCategory: (id) => request(`/api/products/categories/${id}`, { method: 'DELETE' }),

  // Guitar Customizations
  getCustomizations: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/guitars/customizations${qs ? '?' + qs : ''}`)
  },
  getCustomization: (id) => request(`/api/guitars/customizations/${id}`),
  updateCustomization: (id, body) => request(`/api/guitars/customizations/${id}`, { method: 'PUT', body }),
  deleteCustomization: (id) => request(`/api/guitars/customizations/${id}`, { method: 'DELETE' }),

  // Guitar Parts
  getParts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/guitars/parts${qs ? '?' + qs : ''}`)
  },
  createPart: (body) => request('/api/guitars/parts', { method: 'POST', body }),
  updatePart: (id, body) => request(`/api/guitars/parts/${id}`, { method: 'PUT', body }),
  deletePart: (id) => request(`/api/guitars/parts/${id}`, { method: 'DELETE' }),

  // Users / RBAC
  getUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/users${qs ? '?' + qs : ''}`)
  },
  updateUserRole: (id, role) => request(`/api/users/${id}/role`, { method: 'PUT', body: { role } }),
  updateUserStatus: (id, is_active) => request(`/api/users/${id}/status`, { method: 'PUT', body: { is_active } }),
}
