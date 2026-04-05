import { NavLink } from 'react-router'
import {
  BarChart3,
  Users,
  Package,
  ShoppingBag,
  Calendar,
  Settings,
  MessageSquare,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  User,
} from 'lucide-react'
import { useState } from 'react'

const adminNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/admin' },
  { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
  { id: 'products', label: 'Products', icon: Package, path: '/admin/products' },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, path: '/admin/orders' },
  { id: 'projects', label: 'Projects', icon: Briefcase, path: '/admin/projects' },
  { id: 'appointments', label: 'Appointments', icon: Calendar, path: '/admin/appointments' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/admin/messages', badge: 5 },
]

const staffNavItems = [
  { id: 'mytasks', label: 'My Tasks', icon: BarChart3, path: '/staff' },
  { id: 'myprojects', label: 'My Projects', icon: Briefcase, path: '/staff/projects' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/staff/messages', badge: 3 },
  { id: 'schedule', label: 'Schedule', icon: Calendar, path: '/staff/schedule' },
]

/**
 * Sidebar Component for Admin Dashboard
 * Provides navigation with role-based menu items
 */
export function Sidebar({ userRole = 'admin', collapsed = false, onToggle }) {
  const navItems = userRole === 'staff' ? staffNavItems : adminNavItems

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#1E201E] border-r-2 border-white/30 transition-all duration-300 z-40 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 w-6 h-6 bg-[#1E201E] border border-white/30 rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all duration-200"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-[var(--text-muted)]" />
        )}
      </button>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="font-medium">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </>
            )}
            {collapsed && item.badge && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Profile (at bottom) */}
      <div className={`absolute bottom-4 left-0 right-0 px-4 ${collapsed ? 'text-center' : ''}`}>
        <div className={`flex items-center gap-3 p-3 rounded-xl bg-[#1E201E] border border-white/30 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-[var(--text-dark)]" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">
                {userRole === 'admin' ? 'Admin User' : 'Staff Member'}
              </p>
              <p className="text-[var(--text-muted)] text-xs capitalize">{userRole}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
