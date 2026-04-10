// API Configuration - Set VITE_API_URL in .env (uncomment appropriate value for dev or prod)

const rawApiUrl = import.meta.env.VITE_API_URL || '';
export const API = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
