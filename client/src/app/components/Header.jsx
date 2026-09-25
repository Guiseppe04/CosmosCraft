import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  Guitar,
  Menu,
  X,
  User,
  ShoppingCart,
  ChevronDown,
  Settings,
  LogOut,
  LayoutDashboard,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ThemeToggle } from './ThemeToggle.jsx'
import { ConfirmModal } from './ui/ConfirmModal.jsx'
import { GUITAR_TYPE_OPTIONS } from '../lib/guitarBuilderData.js'
import { hasRole } from '../utils/roles.js'

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const [mobileProfileDropdownOpen, setMobileProfileDropdownOpen] = useState(false)
  const [activeHomeSection, setActiveHomeSection] = useState('')

  const customizeRef = useRef(null)
  const profileMenuRef = useRef(null)
  const mobileProfileRef = useRef(null)
  const { getCartCount, setIsOpen: setCartOpen } = useCart()
  const { isAuthenticated, user, openLogin, logout } = useAuth()
  const cartCount = getCartCount()

  const isAdminOrStaff =
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff')
  const isLanding = location.pathname === '/'

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (customizeRef.current && !customizeRef.current.contains(event.target)) {
        setCustomizeOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
      if (mobileProfileRef.current && !mobileProfileRef.current.contains(event.target)) {
        setMobileProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setCustomizeOpen(false)
        setProfileMenuOpen(false)
        setMobileProfileDropdownOpen(false)
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveHomeSection('')
      return
    }
    const hash = (location.hash || '').replace('#', '')
    if (hash && ['services', 'about', 'contact'].includes(hash)) {
      setActiveHomeSection(hash)
    } else if (!hash) {
      setActiveHomeSection('')
    }
  }, [location.pathname, location.hash])

  const handleSelectGuitarType = (guitarType) => {
    if (guitarType === 'bass') {
      navigate('/customize-bass')
    } else {
      navigate(`/customize?type=${guitarType}`)
    }
    setCustomizeOpen(false)
    setMobileMenuOpen(false)
  }

  const isCustomizeActive =
    location.pathname === '/customize' || location.pathname === '/customize-bass'

  const currentGuitarType =
    location.pathname === '/customize-bass'
      ? 'bass'
      : new URLSearchParams(location.search).get('type') || 'electric'

  const profileName =
    user?.name?.firstName && user?.name?.lastName
      ? `${user.name.firstName} ${user.name.lastName}`
      : user?.name?.firstName || user?.email || 'Guest'

  const profileInitials =
    [user?.name?.firstName, user?.name?.lastName]
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || (user?.email || 'G').charAt(0).toUpperCase()

  const userAvatar = user?.avatar || user?.avatarUrl || user?.avatar_url || ''

  // ============================================================
  // NEW NAV ORDER: Home | Services | About Us | Contact Us | Shop | Customize | Appointment
  // ============================================================
  const navLinksBeforeCustomize = [
    { label: 'Home', to: '/' },
    { label: 'Services', to: '/#services' },
    { label: 'About Us', to: '/#about' },
    { label: 'Contact Us', to: '/#contact' },
    { label: 'Shop', to: '/shop' },
  ]
  const navLinksAfterCustomize = [
    { label: 'Appointment', to: '/appointments' },
  ]

  const navLinkClasses = (isActive) =>
    `rounded-full px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
      isActive
        ? 'text-[var(--gold-primary)]'
        : 'text-[var(--text-muted)] hover:text-[var(--gold-primary)]'
    }`

  // Compute whether a nav link is active based on route + hash
  const isNavLinkActive = (to) => {
    // Home: active only when on "/" AND no home section is highlighted
    if (to === '/') {
      return location.pathname === '/' && !activeHomeSection
    }

    // Hash links like "/#services"
    if (to.startsWith('/#')) {
      const targetId = to.replace('/#', '')
      // On the home page, active if the current hash or tracked section matches
      if (location.pathname === '/') {
        const hash = (location.hash || '').replace('#', '')
        return hash === targetId || activeHomeSection === targetId
      }
      return false
    }

    // Regular route (e.g. "/shop", "/appointments")
    return location.pathname === to
  }

  const scrollToSection = (id) => {
    const target = document.getElementById(id)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleNavClick = (event, to) => {
    if (to === '/') {
      setActiveHomeSection('')
      if (location.pathname === '/') {
        event.preventDefault()
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setMobileMenuOpen(false)
      }
      return
    }

    if (!to.startsWith('/#')) return
    event.preventDefault()
    const id = to.replace('/#', '')
    setActiveHomeSection(id)
    setMobileMenuOpen(false)

    if (location.pathname === '/') {
      scrollToSection(id)
      return
    }

    navigate('/')
    window.setTimeout(() => {
      scrollToSection(id)
    }, 80)
  }

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false)
    setProfileMenuOpen(false)
    setMobileMenuOpen(false)
    setMobileProfileDropdownOpen(false)
    logout()
    navigate('/')
  }

  const handleMobileNav = (path, state = null) => {
    setMobileMenuOpen(false)
    setMobileProfileDropdownOpen(false)
    navigate(path, state ? { state } : undefined)
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'border-b border-[var(--border)] bg-[var(--bg-primary)]/90 backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* --- MOBILE/TABLET HEADER --- */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="rounded-lg p-2 text-[var(--text-light)] transition-colors duration-200 hover:bg-[var(--surface-elevated)] lg:hidden"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        <Link to="/" className="flex items-center gap-2 lg:hidden">
          <img src="/logo-cosmos.png" alt="CosmosCraft Logo" className="h-8 w-auto object-contain" />
        </Link>

        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <div className="mobile-theme-toggle">
            <ThemeToggle />
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mobile-header-icon-btn relative"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--gold-primary)] px-1 text-[10px] font-bold text-[var(--text-dark)]">
                {cartCount}
              </span>
            )}
          </button>

          <div className="relative" ref={mobileProfileRef}>
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => setMobileProfileDropdownOpen((prev) => !prev)}
                  className="rounded-full border border-[var(--border)] p-1 text-[var(--text-light)] transition-colors duration-200 hover:bg-[var(--surface-elevated)]"
                  aria-label="Open profile menu"
                >
                  {userAvatar ? (
                    <img src={userAvatar} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gold-primary)] text-xs font-bold text-[var(--text-dark)]">
                      {profileInitials.slice(0, 1)}
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {mobileProfileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute right-0 top-[calc(100%+12px)] z-50 w-[280px] overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-dark)] p-6 shadow-2xl"
                    >
                      <div className="flex flex-col items-center mb-6">
                        {userAvatar ? (
                          <img
                            src={userAvatar}
                            alt="Profile"
                            className="h-16 w-16 rounded-full border-2 border-[var(--border)] object-cover mb-3"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--gold-primary)] text-2xl font-bold text-[var(--text-dark)] mb-3">
                            {profileInitials}
                          </div>
                        )}
                        <p className="text-base font-bold text-[var(--text-light)] text-center">
                          {profileName}
                        </p>
                      </div>

                      <div className="space-y-1">
                        {hasRole(user?.role, 'admin', 'staff') && (
                          <button
                            type="button"
                            onClick={() => handleMobileNav(hasRole(user?.role, 'admin') ? '/admin' : '/staff')}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[var(--text-light)] transition-colors hover:bg-white/5"
                          >
                            <LayoutDashboard className="h-5 w-5 text-[var(--gold-primary)]" />
                            Admin Dashboard
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleMobileNav('/dashboard', { section: 'profile' })}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[var(--text-light)] transition-colors hover:bg-white/5"
                        >
                          <Settings className="h-5 w-5 text-[var(--gold-primary)]" />
                          Settings
                        </button>

                        <div className="border-t border-[var(--border)] my-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowLogoutConfirm(true)
                              setMobileProfileDropdownOpen(false)
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                          >
                            <LogOut className="h-5 w-5" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <button
                type="button"
                onClick={openLogin}
                className="rounded-full p-2 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-elevated)] hover:text-[var(--gold-primary)]"
                aria-label="Login"
              >
                <User className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* --- DESKTOP HEADER --- */}
        <Link to="/" className="hidden lg:flex items-center gap-2">
          <img src="/logo-cosmos.png" alt="CosmosCraft Logo" className="h-9 w-auto object-contain" />
          <span className="text-lg font-semibold text-[var(--text-light)]">
            Cosmos Craft
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {!isAdminOrStaff && (
            <>
              {/* Home | Services | About Us | Contact Us | Shop */}
              {navLinksBeforeCustomize.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={(event) => handleNavClick(event, link.to)}
                  className={navLinkClasses(isNavLinkActive(link.to))}
                >
                  {link.label}
                </Link>
              ))}

              {/* Customize dropdown */}
              <div className="relative" ref={customizeRef}>
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={customizeOpen}
                  onClick={() => setCustomizeOpen((prev) => !prev)}
                  className={navLinkClasses(isCustomizeActive)}
                >
                  <span>Customize</span>
                  <ChevronDown
                    className={`ml-1 inline-block h-3 w-3 transition-transform ${
                      customizeOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {customizeOpen && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-xl">
                    <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      Select Guitar Type
                    </div>
                    {GUITAR_TYPE_OPTIONS.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleSelectGuitarType(type.id)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 ${
                          isCustomizeActive && currentGuitarType === type.id
                            ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]'
                            : 'text-[var(--text-light)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        <Guitar className="h-4 w-4" />
                        <span className="text-sm font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Appointment */}
              {navLinksAfterCustomize.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={(event) => handleNavClick(event, link.to)}
                  className={navLinkClasses(isNavLinkActive(link.to))}
                >
                  {link.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {!isAuthenticated && <ThemeToggle />}

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative rounded-full p-2 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-elevated)] hover:text-[var(--gold-primary)]"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--gold-primary)] px-1.5 text-xs font-bold text-[var(--text-dark)]">
                {cartCount}
              </span>
            )}
          </button>

          {isAuthenticated ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full bg-[var(--surface-elevated)] px-3 py-1.5 text-[var(--text-light)] transition-colors duration-200 hover:text-[var(--gold-primary)]"
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="Profile" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gold-primary)] text-xs font-bold text-[var(--text-dark)]">
                    {profileInitials.slice(0, 1)}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
                  >
                    <div className="flex items-center gap-3 px-5 py-5">
                      {userAvatar ? (
                        <img
                          src={userAvatar}
                          alt="Profile"
                          className="h-14 w-14 rounded-full border border-[var(--border)] object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--gold-primary)] text-xl font-bold text-[var(--text-dark)]">
                          {profileInitials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-[var(--text-light)]">{profileName}</p>
                        <p className="truncate text-sm text-[var(--text-muted)]">
                          {user?.email || 'user@cosmoscraft.com'}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-[var(--border)] p-3">
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-[var(--text-muted)]">Theme</span>
                          <ThemeToggle />
                        </div>
                      </div>

                      {(hasRole(user?.role, 'admin', 'staff')) && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false)
                            navigate(hasRole(user?.role, 'admin') ? '/admin' : '/staff')
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[var(--text-light)] transition-colors hover:bg-[var(--surface-elevated)]"
                        >
                          <LayoutDashboard className="h-4 w-4 text-[var(--gold-primary)]" />
                          <span className="text-sm font-medium">Admin Dashboard</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false)
                          navigate('/dashboard', { state: { section: 'profile' } })
                        }}
                        className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[var(--text-light)] transition-colors hover:bg-[var(--surface-elevated)]"
                      >
                        <Settings className="h-4 w-4 text-[var(--gold-primary)]" />
                        <span className="text-sm font-medium">My Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowLogoutConfirm(true)
                        }}
                        className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="text-sm font-medium">Logout</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              {isLanding ? (
                <button
                  type="button"
                  onClick={openLogin}
                  className="rounded-full bg-[var(--gold-primary)] px-5 py-2 text-sm font-semibold text-[var(--text-dark)] transition-colors duration-200 hover:bg-[var(--gold-secondary)]"
                >
                  Sign Up
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openLogin}
                  className="rounded-full p-2 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-elevated)] hover:text-[var(--gold-primary)]"
                >
                  <User className="h-5 w-5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={showLogoutConfirm}
        title="Logout"
        description="Are you sure you want to log out?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-[var(--border)] bg-[var(--bg-primary)] lg:hidden"
          >
            <nav className="space-y-2 px-4 py-4">
              {!isAdminOrStaff && (
                <>
                  {/* Home */}
                  <Link
                    to="/"
                    onClick={(event) => handleNavClick(event, '/')}
                    className={`${navLinkClasses(location.pathname === '/')} block w-full`}
                  >
                    Home
                  </Link>

                  {/* Services */}
                  <Link
                    to="/#services"
                    onClick={(event) => handleNavClick(event, '/#services')}
                    className={`${navLinkClasses(false)} block w-full`}
                  >
                    Services
                  </Link>

                  {/* About Us */}
                  <Link
                    to="/#about"
                    onClick={(event) => handleNavClick(event, '/#about')}
                    className={`${navLinkClasses(false)} block w-full`}
                  >
                    About Us
                  </Link>

                  {/* Contact Us */}
                  <Link
                    to="/#contact"
                    onClick={(event) => handleNavClick(event, '/#contact')}
                    className={`${navLinkClasses(false)} block w-full`}
                  >
                    Contact Us
                  </Link>

                  {/* Shop */}
                  <Link
                    to="/shop"
                    onClick={(event) => handleNavClick(event, '/shop')}
                    className={`${navLinkClasses(location.pathname === '/shop')} block w-full`}
                  >
                    Shop
                  </Link>

                  {/* Customize — expanded list */}
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-2">
                    <p className="px-2 pb-2 text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">
                      Customize
                    </p>
                    {GUITAR_TYPE_OPTIONS.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleSelectGuitarType(type.id)}
                        className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isCustomizeActive && currentGuitarType === type.id
                            ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]'
                            : 'text-[var(--text-light)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        <Guitar className="h-4 w-4" />
                        {type.label}
                      </button>
                    ))}
                  </div>

                  {/* Appointment */}
                  <Link
                    to="/appointments"
                    onClick={(event) => handleNavClick(event, '/appointments')}
                    className={`${navLinkClasses(location.pathname === '/appointments')} block w-full`}
                  >
                    Appointment
                  </Link>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}