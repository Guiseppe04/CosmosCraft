import { useState } from 'react'
import { Link } from 'react-router'
import {
  Search,
  Bell,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

/**
 * Topbar Component for Admin Dashboard
 * Provides search, notifications, and user menu
 */
export function Topbar({ 
  title = 'Dashboard', 
  userRole = 'admin',
  onMenuClick,
  showMenuButton = false 
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { theme, toggleTheme, mounted } = useTheme()

  // Mock notifications
  const notifications = [
    { id: 1, title: 'New Order Received', message: 'Michael Chen placed an order for Custom Les Paul', time: '2 min ago', unread: true },
    { id: 2, title: 'Project Completed', message: 'Custom Telecaster build is ready for delivery', time: '15 min ago', unread: true },
    { id: 3, title: 'New Message', message: 'Sarah Williams sent a message about pickup selection', time: '1 hour ago', unread: false },
    { id: 4, title: 'Low Stock Alert', message: 'Seymour Duncan Pickups running low on stock', time: '2 hours ago', unread: false },
  ]

  const unreadCount = notifications.filter(n => n.unread).length

  return (
    <header className="bg-[var(--bg-primary)] backdrop-blur-md border-b border-[var(--border)]">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {showMenuButton && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 hover:bg-[var(--surface-dark)] rounded-lg transition-colors duration-200"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
          )}
          
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
          {/* Search */}
          <div className="relative">
            {showSearch ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
                  autoFocus
                />
                <button
                  onClick={() => setShowSearch(false)}
                  className="p-2 hover:bg-[var(--surface-dark)] rounded-lg transition-colors duration-200"
                >
                  <X className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="p-2 hover:bg-[var(--surface-dark)] rounded-lg transition-colors duration-200"
              >
                <Search className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            )}
          </div>

          {/* Theme Toggle */}
          {!mounted ? (
            <div className="w-9 h-9" />
          ) : (
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-[var(--surface-dark)] rounded-lg transition-colors duration-200"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-[var(--text-muted)]" />
              ) : (
                <Sun className="w-5 h-5 text-[var(--gold-primary)]" />
              )}
            </button>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-[var(--surface-dark)] rounded-lg transition-colors duration-200 relative"
            >
              <Bell className="w-5 h-5 text-[var(--text-muted)]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-[var(--border)]">
                  <h3 className="font-semibold text-white">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-[var(--border)] hover:bg-[var(--bg-primary)]/50 transition-colors duration-200 cursor-pointer ${
                        notification.unread ? 'bg-[var(--gold-primary)]/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {notification.unread && (
                          <div className="w-2 h-2 bg-[var(--gold-primary)] rounded-full mt-2 flex-shrink-0" />
                        )}
                        <div className={notification.unread ? '' : 'ml-5'}>
                          <p className="text-white font-medium text-sm">{notification.title}</p>
                          <p className="text-[var(--text-muted)] text-xs mt-1">{notification.message}</p>
                          <p className="text-[var(--text-muted)] text-xs mt-2">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-[var(--border)]">
                  <button className="w-full py-2 text-center text-[var(--gold-primary)] text-sm font-medium hover:text-[var(--gold-secondary)] transition-colors duration-200">
                    View All Notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-2 hover:bg-[var(--surface-dark)] rounded-xl transition-colors duration-200"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center">
                <User className="w-5 h-5 text-[var(--text-dark)]" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-white font-medium text-sm">
                  {userRole === 'admin' ? 'Admin User' : 'Staff Member'}
                </p>
                <p className="text-[var(--text-muted)] text-xs capitalize">{userRole}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-[var(--border)]">
                  <p className="text-white font-medium">
                    {userRole === 'admin' ? 'admin@cosmoscraft.com' : 'staff@cosmoscraft.com'}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs mt-1 capitalize">{userRole} Account</p>
                </div>
                <div className="p-2">
                  <Link
                    to={`/${userRole}/profile`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white transition-colors duration-200"
                  >
                    <User className="w-5 h-5" />
                    Profile
                  </Link>
                  <Link
                    to={`/${userRole}/settings`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white transition-colors duration-200"
                  >
                    <Settings className="w-5 h-5" />
                    Settings
                  </Link>
                </div>
                <div className="p-2 border-t border-[var(--border)]">
                  <button
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
