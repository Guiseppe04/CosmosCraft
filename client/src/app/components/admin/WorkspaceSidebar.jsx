import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'

export function WorkspaceSidebar({ tabs, activeTab, onTabChange, collapsed, onToggle, user, roleLabel, navigationLabel, onLogout }) {
  const displayName = user?.first_name || user?.firstName || user?.name?.firstName || user?.email?.split('@')[0] || 'CosmosCraft'

  return (
    <aside className="admin-sidebar fixed left-0 top-0 h-screen border-r transition-all duration-300 z-40 flex flex-col">
      <div className="admin-brand flex items-center justify-between relative">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
          className="admin-sidebar-toggle absolute -right-3 top-6 w-6 h-6 border rounded-full flex items-center justify-center hover:bg-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 text-[var(--text-light)]" /> : <ChevronLeft className="w-4 h-4 text-[var(--text-light)]" />}
        </button>
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'mx-auto' : ''}`}>
          <span className="admin-brand-mark">
            <img src="/logo-cosmos.png" alt="CosmosCraft" className="admin-brand-logo" />
          </span>
          {!collapsed && <div className="admin-brand-copy min-w-0"><p className="admin-brand-name">CosmosCraft</p></div>}
        </div>
      </div>

      <nav className="admin-nav space-y-0.5 overflow-y-auto flex-1" aria-label={navigationLabel}>
        {!collapsed && <p className="admin-workspace-label">WORKSPACE</p>}
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              title={tab.label}
              className={`admin-nav-item ${activeTab === tab.id ? 'admin-nav-item--active' : ''}`}
            >
              <Icon />
              {!collapsed && <span className="admin-nav-label truncate">{tab.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <div className={`admin-sidebar-profile ${collapsed ? 'justify-center' : ''}`}>
          <span className="admin-profile-avatar" aria-hidden="true">CC</span>
          {!collapsed && (
            <div className="admin-profile-copy min-w-0 flex-1">
              <p className="admin-profile-name">{displayName}</p>
              <p className="admin-profile-role">{roleLabel}</p>
            </div>
          )}
          <button type="button" onClick={onLogout} className="admin-logout-button" title="Log out" aria-label="Log out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
