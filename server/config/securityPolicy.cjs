// Keep the API deployment self-contained. Shared values are checked against
// client/securityPolicy.cjs by the security headers tests.
module.exports = {
  permissionsPolicy: 'geolocation=()',
  referrerPolicy: 'strict-origin-when-cross-origin',
};
