const helmet = require('helmet');
const { permissionsPolicy, referrerPolicy } = require('../../shared/securityPolicy.cjs');

const headers = helmet({
  // Express serves JSON and uploaded files, not the React application document.
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"], objectSrc: ["'none'"], baseUri: ["'none'"],
      formAction: ["'none'"], frameAncestors: ["'none'"],
    },
  },
  strictTransportSecurity: false,
  referrerPolicy: { policy: referrerPolicy },
  xFrameOptions: { action: 'deny' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
});
const hsts = helmet.strictTransportSecurity({ maxAge: 31536000, includeSubDomains: false, preload: false });

function securityHeaders(req, res, next) {
  headers(req, res, () => {
    res.setHeader('Permissions-Policy', permissionsPolicy);
    // Public legacy uploads are embedded by the separate frontend origin.
    const requestPath = req.path || (req.url || '/').split('?')[0];
    if (requestPath === '/uploads' || requestPath.startsWith('/uploads/')) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    if (process.env.NODE_ENV === 'production' && (req.secure || req.socket.encrypted)) return hsts(req, res, next);
    next();
  });
}

module.exports = { securityHeaders };
