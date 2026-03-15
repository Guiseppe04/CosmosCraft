// API Configuration - Dynamically selects URL based on environment

/**
 * Get the correct API URL based on environment
 * Priority:
 * 1. VITE_API_URL_PROD (production API URL) - must be set in Netlify/Render
 * 2. VITE_API_URL (development API URL) - must be set in .env
 * 
 * No fallback defaults - environment variables must be properly configured
 */
export const getApiUrl = () => {
  const prodApiUrl = import.meta.env.VITE_API_URL_PROD;
  const devApiUrl = import.meta.env.VITE_API_URL;
  
  // In production build, use VITE_API_URL_PROD
  if (prodApiUrl) {
    return prodApiUrl;
  }
  
  // In development, use VITE_API_URL
  if (devApiUrl) {
    return devApiUrl;
  }
  
  // Error if no environment variable is set
  throw new Error('API URL not configured. Set VITE_API_URL for development or VITE_API_URL_PROD for production.');
};

// Shortcut to use directly in components
export const API = getApiUrl();
