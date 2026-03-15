// API Configuration - Dynamically selects URL based on environment

/**
 * Get the correct API URL based on environment
 * In production (build), use VITE_API_URL_PROD
 * In development, use VITE_API_URL
 */
export const getApiUrl = () => {
  // Check if running in production mode
  if (import.meta.env.PROD || import.meta.env.VITE_ENV === 'production') {
    return import.meta.env.VITE_API_URL_PROD || 'https://cosmoscraft-production.up.railway.app';
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

// Shortcut to use directly in components
export const API = getApiUrl();
