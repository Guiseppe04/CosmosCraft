import { API } from './apiConfig'

/**
 * staffApi.js — API utility for Staff Dashboard
 * Mirrors adminApi.js but scoped to staff-appropriate endpoints.
 * All calls use credentials:'include' so the access-token cookie is sent automatically.
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
  // ── Projects ──────────────────────────────────────────────────────────────
  /** GET /api/projects/my — returns projects assigned to the logged-in staff */
  getMyProjects: () => request('/api/projects/my'),

  /** GET /api/projects — all projects (staff can see all, read-only) */
  getAllProjects: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/projects${qs ? '?' + qs : ''}`)
  },

  /**
   * Update project status/progress — staff can only mutate status & progress.
   * Admin controls full project fields.
   */
  updateProjectStage: (id, body) =>
    request(`/api/projects/${id}`, { method: 'PUT', body }),

  // ── Orders ────────────────────────────────────────────────────────────────
  /** GET /api/orders — all orders (staff sees all) */
  getOrders: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/orders${qs ? '?' + qs : ''}`)
  },

  /** Update order status */
  updateOrderStatus: (id, status) =>
    request(`/api/orders/${id}`, { method: 'PUT', body: { status } }),

  // ── Appointments ──────────────────────────────────────────────────────────
  /** GET /api/appointments — all appointments (staff sees all) */
  getAppointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/appointments${qs ? '?' + qs : ''}`)
  },

  /** PATCH /api/appointments/:id — update status (completed / no-show / cancelled) */
  updateAppointmentStatus: (id, status) =>
    request(`/api/appointments/${id}`, { method: 'PATCH', body: { status } }),

  // ── Inventory ─────────────────────────────────────────────────────────────
  /** GET /api/inventory/summary — current stock overview */
  getInventorySummary: () => request('/api/inventory/summary'),

  /** GET /api/inventory/products — array of product stock */
  getInventoryProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/inventory/products${qs ? '?' + qs : ''}`)
  },

  /** PATCH /api/inventory/stock-out — deduct stock (staff adjusts after using materials) */
  deductStock: ({ product_id, ...rest }) =>
    request('/api/inventory/stock-out', { method: 'PATCH', body: { productId: product_id, ...rest } }),

  /** PATCH /api/inventory/stock-in — add stock */
  addStock: ({ product_id, ...rest }) =>
    request('/api/inventory/stock-in', { method: 'PATCH', body: { productId: product_id, ...rest } }),

  /** PATCH /api/inventory/adjust — manual adjustment with reason */
  adjustStock: ({ product_id, ...rest }) =>
    request('/api/inventory/adjust', { method: 'PATCH', body: { productId: product_id, ...rest } }),

  // ── Customizations ────────────────────────────────────────────────────────
  /** GET /api/guitars/customizations — all custom order builds */
  getCustomizations: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/guitars/customizations${qs ? '?' + qs : ''}`)
  },
}
