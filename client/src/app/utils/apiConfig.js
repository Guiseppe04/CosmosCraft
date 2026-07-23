// API Configuration - Set VITE_API_URL in .env (uncomment appropriate value for dev or prod)

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

export async function listBuilderAssets({ guitarType, group, subgroup, model } = {}) {
  const params = new URLSearchParams()
  if (guitarType) params.set('guitarType', guitarType)
  if (group) params.set('group', group)
  if (subgroup) params.set('subgroup', subgroup)
  if (model) params.set('model', model)
  const url = `${API}/builder-parts/assets${params.toString() ? `?${params.toString()}` : ''}`
  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache', Expires: '0' } })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Asset listing failed: ${response.status} ${text}`)
  }
  return response.json()
}
