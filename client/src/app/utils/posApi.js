import { API } from './apiConfig'

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

export const posApi = {
  createSale: (body) => request('/pos/sales', { method: 'POST', body }),
  listSales: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/pos/sales${qs ? `?${qs}` : ''}`)
  },
  getSale: (id) => request(`/pos/sales/${id}`),
  getDailySummary: (date) => request(`/pos/reports/daily-summary${date ? `?date=${date}` : ''}`),
}
