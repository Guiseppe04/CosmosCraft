// API Configuration - Dynamically selects URL based on environment

/**
 * Get the correct API URL based on environment
 * Priority:
 * 1. VITE_API_URL_PROD (production API URL) - use this in Netlify
 * 2. VITE_API_URL (development API URL) - use this locally
 * 3. Fallback to localhost
 */
export const getApiUrl = () => {
  // In production build on Netlify, VITE_API_URL_PROD will be set
  const prodApiUrl = import.meta.env.VITE_API_URL_PROD;
  const devApiUrl = import.meta.env.VITE_API_URL;
  
  // If VITE_API_URL_PROD is explicitly set (even to empty string), prefer it
  // This allows Netlify env vars to override
  if (prodApiUrl !== undefined) {
    // If it's set to a real URL (not localhost), use it
    if (prodApiUrl && !prodApiUrl.includes('localhost')) {
      return prodApiUrl;
    }
  }
  
  // If VITE_API_URL is set and doesn't contain localhost, use it
  if (devApiUrl && !devApiUrl.includes('localhost')) {
    return devApiUrl;
  }
  
  // Fallback to localhost for development
  return devApiUrl || 'http://localhost:5000';
};

// Shortcut to use directly in components
export const API = getApiUrl();
