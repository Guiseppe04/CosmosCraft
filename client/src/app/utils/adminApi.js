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
  getMyCustomizations: () => request('/api/guitars/my-customizations'),
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
  deletePart: (id, body) => request(`/api/guitars/parts/${id}`, { method: 'DELETE', body }),

  // Builder Parts
  getBuilderParts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/builder-parts${qs ? '?' + qs : ''}`)
  },
  getBuilderPart: (id) => request(`/api/builder-parts/${id}`),
  createBuilderPart: (body) => request('/api/builder-parts', { method: 'POST', body }),
  updateBuilderPart: (id, body) => request(`/api/builder-parts/${id}`, { method: 'PUT', body }),
  deleteBuilderPart: (id) => request(`/api/builder-parts/${id}`, { method: 'DELETE' }),

  // Users / RBAC
  getUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/users${qs ? '?' + qs : ''}`)
  },
  updateUserRole: (id, role) => request(`/api/users/${id}/role`, { method: 'PUT', body: { role } }),
  updateUserStatus: (id, is_active) => request(`/api/users/${id}/status`, { method: 'PUT', body: { is_active } }),

  // User Profile
  getProfile: () => request('/api/users/me'),
  updateProfile: (body) => request('/api/users/me', { method: 'PUT', body }),
  changePassword: (body) => request('/api/users/me/password', { method: 'PUT', body }),

  // Orders
  getOrders: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/orders${qs ? '?' + qs : ''}`)
  },
  getMyOrders: () => request('/api/orders/my-orders'),
  getOrder: (id) => request(`/api/orders/${id}`),
  updateOrder: (id, body) => request(`/api/orders/${id}`, { method: 'PUT', body }),
  updatePaymentStatus: (id, status, options = {}) => request(`/api/orders/${id}/payment-status`, { method: 'PUT', body: { status, ...options } }),
  cancelOrder: (id) => request(`/api/orders/${id}/cancel`, { method: 'POST' }),
  cancelMyOrder: (id) => request(`/api/orders/${id}/cancel-my-order`, { method: 'POST' }),

  // Projects
  getProjects: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/projects${qs ? '?' + qs : ''}`)
  },
  getMyProjects: () => request('/api/projects/my'),
  getProject: (id) => request(`/api/projects/${id}`),
  createProject: (body) => request('/api/projects', { method: 'POST', body }),
  updateProject: (id, body) => request(`/api/projects/${id}`, { method: 'PUT', body }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  assignTeam: (id, userIds) => request(`/api/projects/${id}/team`, { method: 'PUT', body: { user_ids: userIds } }),

  // Appointments
  getAppointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/appointments${qs ? '?' + qs : ''}`)
  },
  getAppointment: (id) => request(`/api/appointments/${id}`),
  createAppointment: (body) => request('/api/appointments', { method: 'POST', body }),
  updateAppointment: (id, body) => request(`/api/appointments/${id}`, { method: 'PATCH', body }),
  updateAppointmentStatus: (id, status, reason) => request(`/api/appointments/${id}/status`, { method: 'PATCH', body: { status, reason } }),
  rescheduleAppointment: (id, newScheduledAt, reason) => request(`/api/appointments/${id}/reschedule`, { method: 'PATCH', body: { new_scheduled_at: newScheduledAt, reason } }),
  cancelAppointment: (id, reason) => request(`/api/appointments/${id}`, { method: 'DELETE', body: reason ? { reason } : {} }),
  getAppointmentStats: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/appointments/stats${qs ? '?' + qs : ''}`)
  },
  getAvailableSlots: (serviceId, date, slotDuration = 30) => request(`/api/appointments/services/${serviceId}/availability/slots?date=${date}&slot_duration=${slotDuration}`),
  checkAvailability: (serviceId, scheduledAt) => request(`/api/appointments/services/${serviceId}/availability?scheduled_at=${scheduledAt}`),

  // Services (for appointment creation)
  getServices: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/services${qs ? '?' + qs : ''}`)
  },
  getService: (id) => request(`/api/services/${id}`),

  // Unavailable Dates
  getUnavailableDates: () => request('/api/appointments/unavailable-dates'),
  setUnavailableDate: (date, reason) => request('/api/appointments/unavailable-dates', { method: 'POST', body: { date, reason } }),
  removeUnavailableDate: (dateId) => request(`/api/appointments/unavailable-dates/${dateId}`, { method: 'DELETE' }),

   // Inventory
  getInventoryProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/inventory/products${qs ? '?' + qs : ''}`)
  },
  getInventoryProduct: (id) => request(`/api/inventory/products/${id}`),
  addStock: (body) => request('/api/inventory/stock-in', { method: 'PATCH', body }),
  deductStock: (body) => request('/api/inventory/stock-out', { method: 'PATCH', body }),
  adjustStock: (body) => request('/api/inventory/adjust', { method: 'PATCH', body }),
  getInventoryLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/inventory/logs${qs ? '?' + qs : ''}`)
  },
  getProductInventoryLogs: (productId) => request(`/api/inventory/logs/${productId}`),
  getLowStockAlerts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/inventory/alerts/low-stock${qs ? '?' + qs : ''}`)
  },
  markAlertAsRead: (alertId) => request(`/api/inventory/alerts/${alertId}/read`, { method: 'PATCH' }),
  getInventorySummary: () => request('/api/inventory/summary'),

  // Reports
  getSalesReport: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/reports/sales${qs ? '?' + qs : ''}`)
  },

  // Project Hierarchy & Activity
  getProjectHierarchy: (id) => request(`/api/projects/${id}/hierarchy`),
  getProjectActivity: (id) => request(`/api/projects/${id}/activity`),

  // Milestones & Subtasks
  createMilestone: (projectId, body) => request(`/api/projects/${projectId}/milestones`, { method: 'POST', body }),
  updateMilestone: (milestoneId, body) => request(`/api/projects/milestones/${milestoneId}`, { method: 'PUT', body }),
  deleteMilestone: (milestoneId) => request(`/api/projects/milestones/${milestoneId}`, { method: 'DELETE' }),
  createSubtask: (milestoneId, body) => request(`/api/projects/milestones/${milestoneId}/subtasks`, { method: 'POST', body }),
  deleteSubtask: (subtaskId) => request(`/api/projects/subtasks/${subtaskId}`, { method: 'DELETE' }),
  updateSubtask: (subtaskId, body) => request(`/api/projects/subtasks/${subtaskId}`, { method: 'PATCH', body }),

  // User Addresses
  updateAddress: (addressId, body) => request(`/api/users/me/addresses/${addressId}`, { method: 'PUT', body }),
  addAddress: (body) => request('/api/users/me/addresses', { method: 'POST', body }),
  deleteAddress: (addressId) => request(`/api/users/me/addresses/${addressId}`, { method: 'DELETE' }),
}
