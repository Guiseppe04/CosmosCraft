// Kept inside the frontend deployment context; the API imports this via shared/.
const permissionsPolicy = 'geolocation=()';
const referrerPolicy = 'strict-origin-when-cross-origin';
const documentBaseline = "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const documentMetaBaseline = "object-src 'none'; base-uri 'self'; form-action 'self'";

function originOf(value) {
  const url = new URL(value);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Security policy resource origins must use HTTP(S) or WS(S) without credentials.');
  }
  return url.origin;
}

function createFrontendPolicy(env = {}, { development = false, documentOrigin } = {}) {
  const api = development
    ? env.VITE_API_URL || 'http://localhost:5000'
    : env.VITE_API_URL_PROD || env.VITE_API_URL;
  const connections = new Set(["'self'", 'https://api.cloudinary.com', 'https://res.cloudinary.com']);
  const images = new Set(["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://images.unsplash.com', 'https://ui-avatars.com']);
  const addConnection = value => {
    const origin = originOf(value);
    connections.add(origin);
    connections.add(origin.replace(/^http/, 'ws'));
  };
  if (api) {
    addConnection(api);
    images.add(originOf(api)); // Legacy /uploads and API-hosted guitar assets.
    if (development && documentOrigin) {
      const resolvedApi = new URL(api);
      const documentUrl = new URL(documentOrigin);
      if (resolvedApi.hostname === 'localhost' && !['localhost', '127.0.0.1'].includes(documentUrl.hostname)) {
        resolvedApi.hostname = documentUrl.hostname;
        addConnection(resolvedApi.href);
        images.add(resolvedApi.origin);
      }
    }
  }
  if (env.VITE_SOCKET_URL) addConnection(env.VITE_SOCKET_URL);
  if (documentOrigin) addConnection(documentOrigin); // Vite HMR and same-origin WebSocket connections.

  return {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    // React style props, Motion, Emotion and generated print styles require inline CSS.
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': [...images],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'connect-src': [...connections],
    'media-src': ["'self'", 'blob:', 'https://res.cloudinary.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'frame-src': ["'self'"], // Existing same-origin receipt-print frames.
  };
}

function serializePolicy(directives) {
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

function createFrontendHeaders(env, options) {
  return {
    'Content-Security-Policy': documentBaseline,
    'Content-Security-Policy-Report-Only': serializePolicy(createFrontendPolicy(env, options)),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': referrerPolicy,
    'Permissions-Policy': permissionsPolicy,
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

module.exports = { permissionsPolicy, referrerPolicy, documentBaseline, documentMetaBaseline, createFrontendPolicy, createFrontendHeaders, serializePolicy };
