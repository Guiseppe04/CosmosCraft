/**
 * Centralized API utility for Admin Dashboard.
 * All functions use credentials: 'include' so the access token cookie is sent automatically.
 */

const API_URL = import.meta.env.VITE_API_URL

function buildQueryString(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    qs.append(key, String(value))
  })
  return qs.toString()
}

function normalizeListResponse(res, legacyKey) {
  const data = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.data?.[legacyKey])
      ? res.data[legacyKey]
      : []

  return {
    ...res,
    data,
    pagination: res?.pagination || {
      page: 1,
      pageSize: data.length || 10,
      total: data.length,
      totalPages: 1,
    },
  }
}

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
  // Users & Profile
  getProfile: () => request('/api/users/profile'),
  updateProfile: (body) => request('/api/users/profile', { method: 'PUT', body }),
  addAddress: (body) => request('/api/users/addresses', { method: 'POST', body }),
  updateAddress: (id, body) => request(`/api/users/addresses/${id}`, { method: 'PUT', body }),
  deleteAddress: (id) => request(`/api/users/addresses/${id}`, { method: 'DELETE' }),
  changePassword: (body) => request('/api/users/change-password', { method: 'POST', body }),

  // Products
  getProducts: (params = {}) => {
    const qs = buildQueryString(params)
    return request(`/api/products${qs ? '?' + qs : ''}`).then((res) => normalizeListResponse(res, 'products'))
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
    const qs = buildQueryString(params)
    return request(`/api/guitars/customizations${qs ? '?' + qs : ''}`)
  },
  getCustomization: (id) => request(`/api/guitars/customizations/${id}`),
  updateCustomization: (id, body) => request(`/api/guitars/customizations/${id}`, { method: 'PUT', body }),
  deleteCustomization: (id) => request(`/api/guitars/customizations/${id}`, { method: 'DELETE' }),

  // Guitar Parts
  getParts: (params = {}) => {
    const qs = buildQueryString(params)
    return request(`/api/guitars/parts${qs ? '?' + qs : ''}`)
  },
  createPart: (body) => request('/api/guitars/parts', { method: 'POST', body }),
  updatePart: (id, body) => request(`/api/guitars/parts/${id}`, { method: 'PUT', body }),
  deletePart: (id) => request(`/api/guitars/parts/${id}`, { method: 'DELETE' }),

  // Builder Catalog Parts (for Frontend Guitar Customizer)
  getBuilderParts: (params = {}) => {
    const qs = buildQueryString(params)
    return request(`/api/builder-parts${qs ? '?' + qs : ''}`).then((res) => normalizeListResponse(res, 'parts'))
  },
  createBuilderPart: (body) => request('/api/builder-parts', { method: 'POST', body }),
  updateBuilderPart: (id, body) => request(`/api/builder-parts/${id}`, { method: 'PUT', body }),
  deleteBuilderPart: (id) => request(`/api/builder-parts/${id}`, { method: 'DELETE' }),

  // Users / RBAC
  getUsers: (params = {}) => {
    const qs = buildQueryString(params)
    return request(`/api/users${qs ? '?' + qs : ''}`)
  },
  updateUserRole: (id, role) => request(`/api/users/${id}/role`, { method: 'PUT', body: { role } }),
  updateUserStatus: (id, is_active) => request(`/api/users/${id}/status`, { method: 'PUT', body: { is_active } }),

  // Orders
  getOrders: (params = {}) => {
    const qs = buildQueryString(params)
    return request(`/api/orders${qs ? '?' + qs : ''}`)
  },
  getMyOrders: () => request('/api/orders/my-orders').then(res => res.data.orders ? res.data.orders : []),
  getOrder: (id) => request(`/api/orders/${id}`),
  updateOrder: (id, body) => request(`/api/orders/${id}`, { method: 'PUT', body }),
  approvePayment: (id) => request(`/api/orders/${id}/approve-payment`, { method: 'POST' }),
  updatePaymentStatus: (id, status) => request(`/api/orders/${id}/payment-status`, { method: 'PUT', body: { status } }),
  cancelOrder: (id) => request(`/api/orders/${id}/cancel`, { method: 'POST' }),
  cancelMyOrder: (id) => request(`/api/orders/${id}/cancel-my-order`, { method: 'POST' }),

  // Projects
  getProjects: (params = {}) => {
    const qs = buildQueryString(params)
    return request(`/api/projects${qs ? '?' + qs : ''}`)
  },
  getMyProjects: () => request('/api/projects/my'),
  getProject: (id) => request(`/api/projects/${id}`),
  createProject: (body) => request('/api/projects', { method: 'POST', body }),
  updateProject: (id, body) => request(`/api/projects/${id}`, { method: 'PUT', body }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  assignTeam: (id, userIds) => request(`/api/projects/${id}/team`, { method: 'PUT', body: { user_ids: userIds } }),
  getProjectHierarchy: (id) => request(`/api/projects/${id}/hierarchy`),
  getProjectActivity: (id) => request(`/api/projects/${id}/activity`),
  createMilestone: (projectId, body) => request(`/api/projects/${projectId}/milestones`, { method: 'POST', body }),
  updateMilestone: (id, body) => request(`/api/projects/milestones/${id}`, { method: 'PUT', body }),
  deleteMilestone: (id) => request(`/api/projects/milestones/${id}`, { method: 'DELETE' }),
  createSubtask: (milestoneId, body) => request(`/api/projects/milestones/${milestoneId}/subtasks`, { method: 'POST', body }),
  updateSubtask: (subtaskId, body) => request(`/api/projects/subtasks/${subtaskId}`, { method: 'PATCH', body }),
  deleteSubtask: (subtaskId) => request(`/api/projects/subtasks/${subtaskId}`, { method: 'DELETE' }),

  // Appointments
  getAppointments: (params = {}) => {
    const qs = buildQueryString(params)
    return request(`/api/appointments${qs ? '?' + qs : ''}`)
  },
  getAppointment: (id) => request(`/api/appointments/${id}`),
  createAppointment: (body) => request('/api/appointments', { method: 'POST', body }),
  updateAppointment: (id, body) => request(`/api/appointments/${id}`, { method: 'PATCH', body }),
  deleteAppointment: (id) => request(`/api/appointments/${id}`, { method: 'DELETE' }),

  // Reports
  getSalesReport: () => request('/api/reports/dashboard'),

  // Inventory
  getInventorySummary: () => request('/api/inventory/summary'),
  getInventoryProducts: (params = {}) => {
    const qs = buildQueryString(params)
    return request(`/api/inventory/products${qs ? '?' + qs : ''}`)
  },
  getInventoryLogs: (params = {}) => {
    const qs = buildQueryString(params)
    return request(`/api/inventory/logs${qs ? '?' + qs : ''}`)
  },
  addStock: ({ product_id, ...rest }) => request('/api/inventory/stock-in', { method: 'PATCH', body: { productId: product_id, ...rest } }),
  deductStock: ({ product_id, ...rest }) => request('/api/inventory/stock-out', { method: 'PATCH', body: { productId: product_id, ...rest } }),
  adjustStock: ({ product_id, ...rest }) => request('/api/inventory/adjust', { method: 'PATCH', body: { productId: product_id, ...rest } }),
}
