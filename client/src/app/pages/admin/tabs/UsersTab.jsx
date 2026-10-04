import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Filter, Users, X, ChevronLeft, ChevronRight, ChevronDown, UserPlus } from 'lucide-react'
import { StatusBadge } from '../components/shared/StatusBadge'
import { ConfirmModal } from '../../../components/ui/ConfirmModal'
import { FormField } from '../components/shared/FormField'
import { ModalHeader } from '../components/shared/ModalHeader'
import { ModalFooter } from '../components/shared/ModalFooter'
import { VALID_ROLES } from '../constants/adminOptions'

const SUPER_ADMIN_PATTERN = /super[\s_-]*admin/i
const SUPER_ADMIN_LABEL_KEYS = ['role', 'role_name', 'role_label', 'label', 'name', 'title']
const PAGE_SIZE_VALUES = [10, 25, 50, 100]

const EMPTY_STAFF_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'staff',
  password: '',
  confirmPassword: '',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,64}$/

// Mirrors the server-side signup/account password rules.
const validateStaffForm = (form) => {
  const errors = {}
  if (!form.firstName?.trim()) errors.firstName = 'First name is required'
  if (!form.lastName?.trim()) errors.lastName = 'Last name is required'
  if (!form.email?.trim()) errors.email = 'Email is required'
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Please provide a valid email address'
  if (!form.password) errors.password = 'Password is required'
  else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters'
  else if (!PASSWORD_PATTERN.test(form.password)) errors.password = 'Password must include uppercase, lowercase, and special character'
  if (!form.confirmPassword) errors.confirmPassword = 'Confirm password is required'
  else if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match'
  return errors
}

const isSuperAdminText = (value) => (typeof value === 'string' ? SUPER_ADMIN_PATTERN.test(value.trim()) : false)

const isSuperAdminOption = (option) => {
  if (isSuperAdminText(option)) return true
  if (!option || typeof option !== 'object') return false
  return SUPER_ADMIN_LABEL_KEYS.some((key) => isSuperAdminText(option[key]))
}

const withoutSuperAdmin = (options) => (Array.isArray(options) ? options : []).filter((option) => !isSuperAdminOption(option))

const SELECTABLE_ROLES = withoutSuperAdmin(VALID_ROLES)

const formatRoleLabel = (role) => role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())

export function UsersTab({
  visibleUsers,
  searchQuery,
  setSearchQuery,
  userRoleFilter,
  setUserRoleFilter,
  userStatusFilter,
  setUserStatusFilter,
  isLoading,
  isSuperAdmin,
  changeUserRole,
  toggleUserStatus,
  appointmentCapacity,
  createStaffAccount,
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [pendingRoleChange, setPendingRoleChange] = useState(null)
  const [isRoleChangeBusy, setIsRoleChangeBusy] = useState(false)
  const filterDropdownRef = useRef(null)

  // Add Staff modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF_FORM)
  const [staffFormErrors, setStaffFormErrors] = useState({})
  const [isStaffSaving, setIsStaffSaving] = useState(false)

  const totalRecords = visibleUsers?.length || 0
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const currentPage = Math.min(page, totalPages)

  // Back to the first page whenever the search or a filter changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery, userRoleFilter, userStatusFilter])

  // Keep the stored page valid when filtering shrinks the result set
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // Click-outside listener to close the filter dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterMenuOpen(false)
      }
    }
    if (filterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [filterMenuOpen])

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return (visibleUsers || []).slice(start, start + pageSize)
  }, [visibleUsers, currentPage, pageSize])

  const activeFilterList = useMemo(() => {
    const list = []
    if (searchQuery?.trim()) {
      list.push({ key: 'search', label: `Search: ${searchQuery.trim()}`, onRemove: () => setSearchQuery('') })
    }
    if (userRoleFilter && userRoleFilter !== 'all') {
      list.push({ key: 'role', label: `Role: ${formatRoleLabel(userRoleFilter)}`, onRemove: () => setUserRoleFilter('all') })
    }
    if (userStatusFilter && userStatusFilter !== 'all') {
      list.push({ key: 'status', label: `Status: ${userStatusFilter === 'active' ? 'Active' : 'Inactive'}`, onRemove: () => setUserStatusFilter('all') })
    }
    return list
  }, [searchQuery, userRoleFilter, userStatusFilter, setSearchQuery, setUserRoleFilter, setUserStatusFilter])

  const clearAllFilters = () => {
    setSearchQuery('')
    setUserRoleFilter('all')
    setUserStatusFilter('all')
  }

  const requestRoleChange = (user, nextRole) => {
    if (!nextRole || nextRole === user.role) return
    setPendingRoleChange({ user, nextRole })
  }

  const confirmRoleChange = async () => {
    if (!pendingRoleChange) return
    const { user, nextRole } = pendingRoleChange
    setIsRoleChangeBusy(true)
    try {
      await changeUserRole(user.user_id, nextRole)
      setPendingRoleChange(null)
    } finally {
      setIsRoleChangeBusy(false)
    }
  }

  const cancelRoleChange = () => {
    setPendingRoleChange(null)
  }

  // ── Add Staff handlers ─────────────────────────────────────────────────────
  const openAddStaffModal = () => {
    setStaffForm(EMPTY_STAFF_FORM)
    setStaffFormErrors({})
    setShowAddStaffModal(true)
  }

  const closeAddStaffModal = () => {
    if (isStaffSaving) return
    setShowAddStaffModal(false)
    setStaffForm(EMPTY_STAFF_FORM)
    setStaffFormErrors({})
  }

  const updateStaffField = (field, value) => {
    setStaffForm((prev) => ({ ...prev, [field]: value }))
  }

  const confirmAddStaff = async () => {
    const errors = validateStaffForm(staffForm)
    setStaffFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsStaffSaving(true)
    try {
      await createStaffAccount({
        firstName: staffForm.firstName.trim(),
        middleName: staffForm.middleName.trim(),
        lastName: staffForm.lastName.trim(),
        email: staffForm.email.trim(),
        phone: staffForm.phone.trim(),
        role: staffForm.role,
        password: staffForm.password,
        confirmPassword: staffForm.confirmPassword,
      })
      setShowAddStaffModal(false)
      setStaffForm(EMPTY_STAFF_FORM)
    } catch {
      // Keep the modal open — AdminPage has already surfaced the error via toast.
    } finally {
      setIsStaffSaving(false)
    }
  }

  return (
    <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="p-4 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl shadow-sm">
        <div className="flex items-center gap-3" role="status" aria-live="polite">
          <Users className="h-5 w-5 shrink-0 text-[var(--gold-primary)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-light)]">Appointment capacity</p>
            <p className="text-xs text-[var(--text-muted)]">
              {appointmentCapacity
                ? `${appointmentCapacity.active_staff_count} active staff · ${appointmentCapacity.appointment_capacity} appointments per day`
                : 'Loading current capacity...'}
            </p>
          </div>
        </div>
      </div>

      <div className={`relative bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl shadow-sm ${filterMenuOpen ? 'z-30 overflow-visible' : 'overflow-hidden'}`}>
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-[var(--border)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[var(--surface-dark)]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-light)] uppercase tracking-wider">
              User Records
            </span>
            {/* <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--bg-primary)] text-[var(--text-light)] border border-[var(--gold-primary)]/40">
              {totalRecords} found
            </span> */}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Add Staff Button */}
            <button
              type="button"
              onClick={openAddStaffModal}
              className="inline-flex h-9 sm:h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-3.5 text-sm font-bold text-[var(--text-dark)] transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] shadow-sm"
              title="Create a staff account"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Staff</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                aria-label="Search users"
                className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg pl-9 pr-9 py-2 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none w-48 sm:w-60 shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-light)] transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdown Button */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => setFilterMenuOpen((open) => !open)}
                aria-expanded={filterMenuOpen}
                aria-haspopup="true"
                className="inline-flex h-9 sm:h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-semibold text-[var(--text-light)] transition-colors hover:border-[var(--gold-primary)] shadow-sm"
              >
                <Filter className="h-4 w-4 text-[var(--text-light)]" />
                <span className="text-[var(--text-light)] font-semibold">Filters</span>
                {activeFilterList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-[var(--gold-primary)] text-[var(--text-dark)]">
                    {activeFilterList.length}
                  </span>
                )}
                <ChevronDown className="h-4 w-4 text-[var(--text-light)]" />
              </button>

              {filterMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,22rem)] overflow-y-auto max-h-[75vh] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl p-4 text-[var(--text-light)]">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-light)]">Filters</p>

                    <label className="text-xs font-semibold text-[var(--text-light)] block">
                      Role
                      <select
                        value={userRoleFilter}
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:outline-none focus:border-[var(--gold-primary)]"
                      >
                        <option value="all" className="text-[var(--text-light)] bg-[var(--surface-dark)]">All Roles</option>
                        {SELECTABLE_ROLES.map((r) => (
                          <option key={r} value={r} className="text-[var(--text-light)] bg-[var(--surface-dark)]">{formatRoleLabel(r)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-semibold text-[var(--text-light)] block">
                      Status
                      <select
                        value={userStatusFilter}
                        onChange={(e) => setUserStatusFilter(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-2.5 py-2 text-sm text-[var(--text-light)] focus:outline-none focus:border-[var(--gold-primary)]"
                      >
                        <option value="all" className="text-[var(--text-light)] bg-[var(--surface-dark)]">All Statuses</option>
                        <option value="active" className="text-[var(--text-light)] bg-[var(--surface-dark)]">Active</option>
                        <option value="inactive" className="text-[var(--text-light)] bg-[var(--surface-dark)]">Inactive</option>
                      </select>
                    </label>

                    <div className="pt-2 border-t border-[var(--border)]">
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="w-full py-2 px-3 text-xs font-bold text-[var(--text-light)] bg-[var(--surface-dark)] hover:bg-[var(--bg-primary)] rounded-lg transition-colors border border-[var(--border)]"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Badges */}
        {activeFilterList.length > 0 && (
          <div className="px-5 py-2.5 bg-[var(--surface-dark)] border-b border-[var(--border)] flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
              Active:
            </span>
            {activeFilterList.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[var(--gold-primary)]/15 text-[var(--text-light)] border border-[var(--gold-primary)]/40"
              >
                <span className="text-[var(--text-light)]">{item.label}</span>
                <button
                  type="button"
                  onClick={item.onRemove}
                  className="text-[var(--text-muted)] hover:text-[var(--text-light)] transition-colors"
                  title="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-light)] underline ml-2 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-bold border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/50">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Users className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
                    <p className="text-sm font-semibold text-[var(--text-light)]">No users found</p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u, index) => (
                  <tr key={u.user_id ?? index} className="hover:bg-[var(--bg-primary)]/40 transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-[var(--text-light)] font-semibold">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      {isSuperAdmin && !isSuperAdminOption(u) ? (
                        <select
                          value={u.role}
                          onChange={(e) => requestRoleChange(u, e.target.value)}
                          className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-light)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                        >
                          {SELECTABLE_ROLES.map((r) => (
                            <option key={r} value={r} className="bg-[var(--surface-dark)] text-[var(--text-light)]">{formatRoleLabel(r)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gold-primary)]/20 text-[var(--text-light)] border border-[var(--gold-primary)]/40 capitalize">
                          {u.role?.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4"><StatusBadge variant={u.is_active ? 'active' : 'inactive'} value={u.is_active ? 'Active' : 'Inactive'} /></td>
                    <td className="py-3 px-4 text-[var(--text-muted)] font-medium whitespace-nowrap">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleUserStatus(u.user_id, u.is_active, `${u.first_name} ${u.last_name}`)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${u.is_active
                          ? 'bg-red-500/15 text-[var(--text-light)] hover:bg-red-500/25 border border-red-500/40'
                          : 'bg-green-500/15 text-[var(--text-light)] hover:bg-green-500/25 border border-green-500/40'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-[var(--surface-dark)]">
          <div className="flex items-center gap-3">
            <span className="text-[var(--text-muted)]">
              Showing page <strong className="text-[var(--text-light)]">{currentPage}</strong> of <strong className="text-[var(--text-light)]">{totalPages}</strong> ({totalRecords} total records)
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[var(--text-muted)] text-xs">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="bg-[var(--surface-elevated)] text-[var(--text-light)] border border-[var(--border)] rounded px-2 py-0.5 text-xs font-semibold focus:outline-none"
              >
                {PAGE_SIZE_VALUES.map((size) => (
                  <option key={size} value={size} className="text-[var(--text-light)] bg-[var(--surface-elevated)]">{size}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)] hover:border-[var(--gold-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-light)] hover:border-[var(--gold-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!pendingRoleChange}
        title="Change user role?"
        description={pendingRoleChange
          ? `Change ${pendingRoleChange.user.first_name} ${pendingRoleChange.user.last_name}'s role from ${formatRoleLabel(pendingRoleChange.user.role)} to ${formatRoleLabel(pendingRoleChange.nextRole)}? This updates the user's permissions immediately.`
          : ''}
        confirmLabel="Change Role"
        cancelLabel="Cancel"
        variant="warning"
        isBusy={isRoleChangeBusy}
        onConfirm={confirmRoleChange}
        onCancel={cancelRoleChange}
      />

      {/* Add Staff Account Modal */}
      {createPortal(
        <AnimatePresence>
          {showAddStaffModal && (
            <motion.div
              key="add-staff-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
              onClick={(e) => { if (e.target === e.currentTarget && !isStaffSaving) closeAddStaffModal() }}
            >
              <motion.div
                key="add-staff-panel"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                role="dialog"
                aria-modal="true"
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-8 shadow-2xl"
              >
                <ModalHeader title="Add Staff Account" onClose={closeAddStaffModal} />
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Create a staff account. The new user can sign in right away with the password you set.
                </p>

                <div className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="First Name"
                      required
                      error={staffFormErrors.firstName}
                      value={staffForm.firstName}
                      onChange={(value) => updateStaffField('firstName', value)}
                      placeholder="Juan"
                    />
                    <FormField
                      label="Last Name"
                      required
                      error={staffFormErrors.lastName}
                      value={staffForm.lastName}
                      onChange={(value) => updateStaffField('lastName', value)}
                      placeholder="Dela Cruz"
                    />
                  </div>

                  <FormField
                    label="Middle Name"
                    value={staffForm.middleName}
                    onChange={(value) => updateStaffField('middleName', value)}
                    placeholder="Optional"
                  />

                  <FormField
                    label="Email Address"
                    required
                    type="email"
                    error={staffFormErrors.email}
                    value={staffForm.email}
                    onChange={(value) => updateStaffField('email', value)}
                    placeholder="juan@example.com"
                  />

                  <FormField
                    label="Phone Number"
                    type="tel"
                    value={staffForm.phone}
                    onChange={(value) => updateStaffField('phone', value)}
                    placeholder="+63 9XX XXX XXXX (optional)"
                  />

                  <FormField label="Role" required>
                    <select
                      value={staffForm.role}
                      onChange={(e) => updateStaffField('role', e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm"
                    >
                      <option value="staff" className="bg-[var(--surface-dark)] text-[var(--text-light)]">Staff</option>
                      <option value="admin" className="bg-[var(--surface-dark)] text-[var(--text-light)]">Admin</option>
                    </select>
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Password"
                      required
                      type="password"
                      error={staffFormErrors.password}
                      value={staffForm.password}
                      onChange={(value) => updateStaffField('password', value)}
                      placeholder="Min 8 chars"
                    />
                    <FormField
                      label="Confirm Password"
                      required
                      type="password"
                      error={staffFormErrors.confirmPassword}
                      value={staffForm.confirmPassword}
                      onChange={(value) => updateStaffField('confirmPassword', value)}
                      placeholder="Re-enter password"
                    />
                  </div>

                  <p className="text-xs text-[var(--text-muted)]">
                    Password must be at least 8 characters with an uppercase letter, lowercase letter, and special character.
                  </p>
                </div>

                <ModalFooter
                  onCancel={closeAddStaffModal}
                  onSave={confirmAddStaff}
                  isSaving={isStaffSaving}
                  disabled={isStaffSaving}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  )
}
