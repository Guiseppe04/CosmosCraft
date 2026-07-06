export function normalizeRole(role) {
  return role === 'super_admin' ? 'admin' : role
}

export function hasRole(userRole, ...allowedRoles) {
  const normalizedUserRole = normalizeRole(userRole)
  return allowedRoles.some((role) => normalizeRole(role) === normalizedUserRole)
}

export function getRoleLabel(role) {
  const normalizedRole = normalizeRole(role)

  if (normalizedRole === 'admin') return 'Admin'
  if (normalizedRole === 'staff') return 'Staff'
  if (normalizedRole === 'customer') return 'Customer'
  return role || ''
}
