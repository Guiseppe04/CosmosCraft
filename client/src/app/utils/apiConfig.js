// API Configuration - Set VITE_API_URL in .env (uncomment appropriate value for dev or prod)

// In production builds, prefer the production API URL. In development, use the dev URL.
const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;
const rawApiUrl = isProd
  ? (import.meta.env.VITE_API_URL_PROD || import.meta.env.VITE_API_URL || '')
  : (import.meta.env.VITE_API_URL || '');
export const API = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : window.location.origin;

export async function listBuilderAssets({ guitarType, group, subgroup, model } = {}) {
  const params = new URLSearchParams()
  if (guitarType) params.set('guitarType', guitarType)
  if (group) params.set('group', group)
  if (subgroup) params.set('subgroup', subgroup)
  if (model) params.set('model', model)
  const url = `${API}/api/builder-parts/assets${params.toString() ? `?${params.toString()}` : ''}`
  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache', Expires: '0' } })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Asset listing failed: ${response.status} ${text}`)
  }
  return response.json()
}
