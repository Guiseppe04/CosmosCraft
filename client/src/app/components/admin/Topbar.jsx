import { useEffect, useRef, useState } from 'react'
import {
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  ShoppingCart,
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
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.email?.split('@')[0] || 'User'
  const initials = displayName
    .split(' ')
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
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Page Title */}
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {userRole === 'admin' ? 'Manage your CosmosCraft operations' : 'View and manage your tasks'}
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
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--gold-primary)]/40 hover:text-white"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-[var(--gold-primary)]" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          )}

          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--gold-primary)]/40 hover:text-white"
            aria-label="Cart"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--gold-primary)] px-1 text-[10px] font-bold text-[var(--text-dark)]">
              1
            </span>
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex min-w-[320px] items-center justify-between gap-4 rounded-[24px] border border-white/15 bg-white/5 px-5 py-4 transition-all duration-200 hover:border-[var(--gold-primary)]/40 hover:bg-white/10"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-white/70 bg-[var(--gold-primary)] text-xl font-bold text-[var(--text-dark)] shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                {initials}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[1.1rem] font-bold leading-tight text-white">
                  {displayName}
                </p>
                <p className="mt-1 truncate text-base leading-tight text-[var(--text-muted)]">
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
                  <p className="mt-1 text-xs capitalize text-[var(--text-muted)]">
                    {user?.role?.replace('_', ' ') || userRole}
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
