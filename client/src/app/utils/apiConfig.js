// API Configuration - Set VITE_API_URL in .env (uncomment appropriate value for dev or prod)

// In production builds, prefer the production API URL. In development, use the dev URL.
const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;
const getResolvedApiUrl = () => {
  const rawApiUrl = isProd
    ? (import.meta.env.VITE_API_URL_PROD || import.meta.env.VITE_API_URL || '')
    : (import.meta.env.VITE_API_URL || '');

  if (!rawApiUrl) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  let cleaned = rawApiUrl.replace(/\/+$/, '');
  // In development, if browsing from another device (e.g. mobile/tablet over LAN IP like 192.168.x.x)
  // replace 'localhost' with the actual host so requests route to the backend server rather than the device itself.
  if (!isProd && typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1' && cleaned.includes('localhost')) {
      cleaned = cleaned.replace('localhost', currentHost);
    }
  }
  return cleaned;
};

export const API = getResolvedApiUrl();

/**
 * Retrieve the current access token stored in localStorage (if any).
 */
export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('cosmoscraft_token') || window.localStorage.getItem('authToken') || null;
}

/**
 * Persist or clear the access token in localStorage.
 */
export function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem('cosmoscraft_token', token);
    window.localStorage.setItem('authToken', token);
  } else {
    window.localStorage.removeItem('cosmoscraft_token');
    window.localStorage.removeItem('authToken');
  }
}

export function removeAuthToken() {
  setAuthToken(null);
}

/**
 * Merge Authorization: Bearer <token> into headers if an access token is available.
 */
export function getAuthHeaders(headers = {}) {
  const token = getAuthToken();
  const merged = { ...headers };
  if (token && !merged['Authorization'] && !merged['authorization']) {
    merged['Authorization'] = `Bearer ${token}`;
  }
  return merged;
}


export function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${API}${cleanPath}`;
}

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
