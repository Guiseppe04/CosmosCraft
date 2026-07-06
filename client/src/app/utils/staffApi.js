import { API } from './apiConfig'

const normalizeAppointmentStatus = (status) => {
  if (status === 'approved') return 'confirmed'
  return status
}

/**
 * staffApi.js
 * Mirrors the admin API surface for staff-safe actions.
 */

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

export const staffApi = {
  // Products
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/products${qs ? `?${qs}` : ''}`)
  },
  getProduct: (id) => request(`/api/products/${id}`),

  // Projects
  getMyProjects: () => request('/api/projects/my'),
  getAllProjects: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/projects${qs ? `?${qs}` : ''}`)
  },
  updateProject: (id, body) => request(`/api/projects/${id}`, { method: 'PUT', body }),
  updateProjectStage: (id, body) => request(`/api/projects/${id}`, { method: 'PUT', body }),

  // Orders
  getOrders: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/orders${qs ? `?${qs}` : ''}`)
  },
  updateOrderStatus: (id, status) => request(`/api/orders/${id}`, { method: 'PUT', body: { status } }),
  createOrder: (body) => request('/api/orders', { method: 'POST', body }),

  // Appointments
  getAppointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/appointments${qs ? `?${qs}` : ''}`)
  },
  getAppointment: (id) => request(`/api/appointments/${id}`),
  createAppointment: (data) => request('/api/appointments', { method: 'POST', body: data }),
  updateAppointment: (id, data) => request(`/api/appointments/${id}`, { method: 'PATCH', body: data }),
  updateAppointmentStatus: (id, status, reason) =>
    request(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      body: { status: normalizeAppointmentStatus(status), reason },
    }),
  rescheduleAppointment: (id, newScheduledAt, reason) =>
    request(`/api/appointments/${id}/reschedule`, { method: 'PATCH', body: { new_scheduled_at: newScheduledAt, reason } }),
  cancelAppointment: (id, reason) =>
    request(`/api/appointments/${id}`, { method: 'DELETE', body: reason ? { reason } : {} }),
  getAppointmentStats: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/appointments/stats${qs ? `?${qs}` : ''}`)
  },
  getAvailableSlots: (serviceId, date, slotDuration = 30) =>
    request(`/api/appointments/services/${serviceId}/availability/slots?date=${date}&slot_duration=${slotDuration}`),
  checkAvailability: (serviceId, scheduledAt) =>
    request(`/api/appointments/services/${serviceId}/availability?scheduled_at=${scheduledAt}`),
  getUnavailableDates: () => request('/api/appointments/unavailable-dates'),
  addUnavailableDate: (data) => request('/api/appointments/unavailable-dates', { method: 'POST', body: data }),
  removeUnavailableDate: (id) => request(`/api/appointments/unavailable-dates/${id}`, { method: 'DELETE' }),

  // Inventory
  getInventorySummary: () => request('/api/inventory/summary'),
  getInventoryProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/inventory/products${qs ? `?${qs}` : ''}`)
  },
  getInventoryProduct: (id) => request(`/api/inventory/products/${id}`),
  addStock: ({ product_id, ...rest }) =>
    request('/api/inventory/stock-in', { method: 'PATCH', body: { productId: product_id, ...rest } }),
  deductStock: ({ product_id, ...rest }) =>
    request('/api/inventory/stock-out', { method: 'PATCH', body: { productId: product_id, ...rest } }),
  adjustStock: ({ product_id, ...rest }) =>
    request('/api/inventory/adjust', { method: 'PATCH', body: { productId: product_id, ...rest } }),
  getInventoryLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/inventory/logs${qs ? `?${qs}` : ''}`)
  },
  getProductInventoryLogs: (productId, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/inventory/logs/${productId}${qs ? `?${qs}` : ''}`)
  },
  getLowStockAlerts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/inventory/alerts/low-stock${qs ? `?${qs}` : ''}`)
  },
  markAlertAsRead: (alertId) => request(`/api/inventory/alerts/${alertId}/read`, { method: 'PATCH' }),
  getBuilderParts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/builder-parts${qs ? `?${qs}` : ''}`)
  },
  getBuilderPart: (id) => request(`/api/builder-parts/${id}`),
  updateBuilderPart: (id, body) => request(`/api/builder-parts/${id}`, { method: 'PUT', body }),

  // Services
  getServices: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/services${qs ? `?${qs}` : ''}`)
  },
  getService: (id) => request(`/api/services/${id}`),

  // Customizations
  getCustomizations: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/guitars/customizations${qs ? `?${qs}` : ''}`)
  },
}
