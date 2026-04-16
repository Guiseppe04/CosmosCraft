import { useEffect, useRef, useState } from 'react'
import {
  LogOut,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useAuth } from '../../context/AuthContext'

/**
 * Topbar Component for Admin Dashboard
 * Provides search, notifications, and user menu
 */
export function Topbar({ 
  title = 'Dashboard', 
  userRole = 'admin'
}) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef(null)
  const { theme, toggleTheme, mounted } = useTheme()
  const { user, logout } = useAuth()
  const displayName =
    user?.name?.firstName && user?.name?.lastName
      ? `${user.name.firstName} ${user.name.lastName}`
      : user?.name?.firstName || user?.firstName || user?.email?.split('@')[0] || 'User'
  const initials = [user?.name?.firstName, user?.name?.lastName]
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'U'

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="bg-[var(--bg-primary)] backdrop-blur-md border-b border-[var(--border)]">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Page Title */}
          <div>
            <h1 className="text-lg font-bold text-white">{title}</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {displayName}
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          {!mounted ? (
            <div className="w-9 h-9" />
          ) : (
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--gold-primary)]/40 hover:text-white"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[var(--gold-primary)]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          )}

       

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex min-w-[240px] max-w-[320px] items-center justify-between gap-4 rounded-[24px] border border-white/15 bg-white/5 px-4 py-3 transition-all duration-200 hover:border-[var(--gold-primary)]/40 hover:bg-white/10"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/70 bg-[var(--gold-primary)] text-sm font-bold text-[var(--text-dark)] shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                {initials}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold leading-tight text-white">
                  {displayName}
                </p>
                <p className="mt-0.5 truncate text-xs leading-tight text-[var(--text-muted)]">
                  {user?.email || 'user@cosmoscraft.com'}
                </p>
              </div>
              <ChevronDown className={`w-5 h-5 flex-shrink-0 text-[var(--text-muted)] transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-xl">
                <div className="p-4 border-b border-[var(--border)]">
                  <p className="text-white font-medium">
                    {displayName}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {user?.email || 'user@cosmoscraft.com'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : user?.role === 'staff' ? 'Staff' : user?.role || userRole}
                  </p>
                </div>
                <div className="p-2">
                  <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors duration-200"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Topbar
