function normalizeRole(role) {
  if (role === 'super_admin') return 'admin';
  return role;
}

function hasRole(userRole, ...allowedRoles) {
  const normalizedUserRole = normalizeRole(userRole);
  return allowedRoles.some((role) => normalizeRole(role) === normalizedUserRole);
}

module.exports = {
  normalizeRole,
  hasRole,
};
