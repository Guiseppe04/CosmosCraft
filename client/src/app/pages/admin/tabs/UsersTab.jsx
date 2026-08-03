import { motion } from 'motion/react'
import { Search, Filter, RefreshCw, Users } from 'lucide-react'
import { StatusBadge } from '../components/shared/StatusBadge'
import { EmptyState } from '../components/shared/EmptyState'
import { AdminTable } from '../components/shared/AdminTable'
import { VALID_ROLES } from '../constants/adminOptions'

export function UsersTab({
  visibleUsers,
  searchQuery,
  setSearchQuery,
  userRoleFilter,
  setUserRoleFilter,
  userStatusFilter,
  setUserStatusFilter,
  handleRefresh,
  isLoading,
  isSuperAdmin,
  changeUserRole,
  toggleUserStatus,
}) {
  return (
    <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="p-4 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative min-w-0 flex-[1.7]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[50px] pl-11 pr-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row xl:flex-nowrap gap-3 xl:items-center">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 h-[50px] min-w-[150px] shrink-0">
              <Filter className="w-4 h-4 text-[var(--gold-primary)] shrink-0" />
              <span className="text-white text-sm font-medium whitespace-nowrap">Filters:</span>
            </div>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="w-full sm:w-[220px] h-[50px] bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl px-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)] shrink-0"
            >
              <option value="all">All Roles</option>
              {VALID_ROLES.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
              ))}
            </select>
            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
              className="w-full sm:w-[220px] h-[50px] bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl px-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)] shrink-0"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              onClick={handleRefresh}
              className="h-[50px] w-[50px] flex items-center justify-center border border-[var(--border)] rounded-2xl hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all shrink-0"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      <AdminTable
        columns={['User', 'Role', 'Status', 'Joined', 'Actions']}
        rows={visibleUsers}
        renderRow={(u) => (
          <>
            <td className="py-4 px-6">
              <p className="text-white font-semibold">{u.first_name} {u.last_name}</p>
              <p className="text-[var(--text-muted)] text-xs">{u.email}</p>
            </td>
            <td className="py-4 px-6">
              {isSuperAdmin ? (
                <select
                  value={u.role}
                  onChange={(e) => changeUserRole(u.user_id, e.target.value)}
                  className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                >
                  {VALID_ROLES.map((r) => (
                    <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                  ))}
                </select>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 capitalize">
                  {u.role?.replace('_', ' ')}
                </span>
              )}
            </td>
            <td className="py-4 px-6"><StatusBadge variant={u.is_active ? 'active' : 'inactive'} value={u.is_active ? 'Active' : 'Inactive'} /></td>
            <td className="py-4 px-6 text-[var(--text-muted)] text-sm">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
            <td className="py-4 px-6">
              <button
                onClick={() => toggleUserStatus(u.user_id, u.is_active, `${u.first_name} ${u.last_name}`)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${u.is_active
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30'
                }`}
              >
                {u.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </td>
          </>
        )}
        empty={<EmptyState icon={Users} label="No users found" />}
      />
    </motion.div>
  )
}
