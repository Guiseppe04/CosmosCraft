import {
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useAuth } from '../../context/AuthContext'

/**
 * Topbar Component for Admin Dashboard
 * Provides page title, search, and theme toggle
 */
export function Topbar({ 
  title = 'Dashboard', 
  userRole = 'admin',
  workspace = false,
  search = null,
}) {
  const { theme, toggleTheme, mounted } = useTheme()
  const { user } = useAuth()
  const displayName =
    user?.name?.firstName && user?.name?.lastName
      ? `${user.name.firstName} ${user.name.lastName}`
      : user?.name?.firstName || user?.firstName || user?.email?.split('@')[0] || 'User'

  return (
    <header className="admin-topbar bg-[var(--bg-primary)] backdrop-blur-md border-b border-[var(--border)]">
      <div className="admin-topbar-inner flex items-center justify-between px-4 py-3">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {!workspace && <img src="/logo-cosmos.png" alt="CosmosCraft Logo" className="h-8 w-auto object-contain" />}
          {/* Page Title */}
          <div>
            {workspace && <p className="admin-breadcrumb">Workspace / <span>{title}</span></p>}
            <h1 className="admin-page-title text-lg font-bold text-white">{title}</h1>
            {!workspace && <p className="text-xs text-[var(--text-muted)]">
              {displayName}
            </p>}
          </div>
        </div>

        {/* Right Section */}
        <div className="admin-topbar-actions flex items-center gap-3">
          {search}
          {/* Theme Toggle */}
          {!mounted ? (
            <div className="w-9 h-9" />
          ) : (
            <button
              onClick={toggleTheme}
              className="admin-theme-toggle flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--gold-primary)]/40 hover:text-white"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[var(--gold-primary)]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          )}

        </div>
      </div>
    </header>
  )
}

export default Topbar
