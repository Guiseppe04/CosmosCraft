import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Guitar, Menu, X, User, ShoppingCart, ChevronDown, Settings, LogOut, Sun, Moon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ThemeToggle } from './ThemeToggle.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { GUITAR_TYPE_OPTIONS } from '../lib/guitarBuilderData.js'

/**
 * Header Component (fromFigma)
 * Fixed, blurred header with active link highlight and animated mobile menu.
 */
export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const customizeRef = useRef(null)
  const profileMenuRef = useRef(null)
  const { getCartCount, setIsOpen: setCartOpen } = useCart()
  const { isAuthenticated, user, openLogin, logout } = useAuth()
  const { theme, toggleTheme, mounted } = useTheme()
  const cartCount = getCartCount()

  // Check if we're on admin or staff routes
  const isAdminOrStaff = location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff')

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (customizeRef.current && !customizeRef.current.contains(event.target)) {
        setCustomizeOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setCustomizeOpen(false)
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelectGuitarType = (guitarType) => {
    if (guitarType === 'bass') {
      navigate('/customize-bass')
    } else {
      navigate(`/customize?type=${guitarType}`)
    }
    setCustomizeOpen(false)
  }

  const isCustomizeActive = location.pathname === '/customize' || location.pathname === '/customize-bass'
  const currentGuitarType = location.pathname === '/customize-bass' ? 'bass' : new URLSearchParams(location.search).get('type') || 'electric'
  const profileName =
    user?.name?.firstName && user?.name?.lastName
      ? `${user.name.firstName} ${user.name.lastName}`
      : user?.name?.firstName || user?.email || 'Guest'
  const profileInitials = [user?.name?.firstName, user?.name?.lastName]
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || (user?.email || 'G').charAt(0).toUpperCase()

  const navLinks = [
    { path: '/', label: 'Home' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--surface-dark)]/95 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img 
              src="/logo-cosmos.png" 
              alt="CosmosCraft Logo" 
              className="h-10 w-auto group-hover:scale-105 transition-transform duration-200" 
            />
            <span className="text-xl font-semibold bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-accent)] bg-clip-text text-transparent hidden sm:block">
              CosmosCraft
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {!isAdminOrStaff && (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      location.pathname === link.path
                        ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                        : 'text-[var(--text-light)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                
                {/* Customize Dropdown */}
                <div className="relative" ref={customizeRef}>
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={customizeOpen}
                    aria-label="Customize guitar - select guitar type"
                    onClick={() => setCustomizeOpen(!customizeOpen)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setCustomizeOpen(true)
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      isCustomizeActive
                        ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                        : 'text-[var(--text-light)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'
                    }`}
                  >
                    <span className="text-sm font-medium">Customize</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${customizeOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {customizeOpen && (
                    <div 
                      role="menu"
                      className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg overflow-hidden z-50"
                    >
                      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] border-b border-[var(--border)]">
                        Select Guitar Type
                      </div>
                      {GUITAR_TYPE_OPTIONS.map((type) => (
                        <button
                          key={type.id}
                          role="menuitem"
                          type="button"
                          onClick={() => handleSelectGuitarType(type.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              handleSelectGuitarType(type.id)
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 ${
                            isCustomizeActive && currentGuitarType === type.id
                              ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]'
                              : 'text-[var(--text-muted)] hover:bg-[var(--surface-dark)] hover:text-[var(--text-light)]'
                          }`}
                        >
                          <Guitar className="w-4 h-4" />
                          <span className="text-sm font-medium">{type.label}</span>
                          <span className="text-xs ml-auto">Customization</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <Link
                  to="/shop"
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    location.pathname === '/shop'
                      ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                      : 'text-[var(--text-light)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  Shop
                </Link>
                <Link
                  to="/appointments"
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    location.pathname === '/appointments'
                      ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                      : 'text-[var(--text-light)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  Appointments
                </Link>
              </>
            )}
          </nav>

          {/* User Actions */}
          <div className="hidden md:flex items-center gap-3 relative">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-lg text-[var(--text-light)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] transition-all duration-200"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center bg-[var(--gold-primary)] text-[var(--text-dark)] text-xs font-bold px-1.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
            {isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[var(--text-light)] transition-all duration-200 ${
                    profileMenuOpen
                      ? 'bg-[var(--surface-elevated)]/90 ring-1 ring-white/10'
                      : 'bg-[var(--surface-elevated)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]/80'
                  }`}
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt="Profile"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--gold-primary)] text-[var(--text-dark)] flex items-center justify-center text-xs font-bold">
                      {profileInitials.slice(0, 1)}
                    </div>
                  )}
                  <span className="text-xs font-medium max-w-[120px] truncate">
                    {profileName}
                  </span>
                </button>

                <AnimatePresence>
                  {profileMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] overflow-hidden rounded-[24px] border border-white/10 bg-[var(--surface-dark)] shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
                    >
                      <div className="flex items-center gap-3 px-5 py-5">
                        {user?.avatar ? (
                          <img
                            src={user.avatar}
                            alt="Profile"
                            className="h-14 w-14 rounded-full border border-white/70 object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/70 bg-[var(--gold-primary)] text-xl font-bold text-[var(--text-dark)]">
                            {profileInitials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-bold text-white">{profileName}</p>
                          <p className="truncate text-sm text-[var(--text-muted)]">{user?.email || 'user@cosmoscraft.com'}</p>
                        </div>
                        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
                      </div>

                      <div className="border-t border-white/10 p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false)
                            navigate('/dashboard', { state: { section: 'profile' } })
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white transition-colors hover:bg-[var(--surface-elevated)]"
                        >
                          <Settings className="h-4 w-4 text-[var(--gold-primary)]" />
                          <span className="text-sm font-medium">Edit Profile</span>
                        </button>
                        <div className="mt-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-white transition-colors hover:bg-[var(--surface-elevated)]">
                          <div className="flex items-center gap-3">
                            {theme === 'dark' ? (
                              <Moon className="h-4 w-4 text-[var(--gold-primary)]" />
                            ) : (
                              <Sun className="h-4 w-4 text-[var(--gold-primary)]" />
                            )}
                            <span className="text-sm font-medium">
                              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            </span>
                          </div>
                          {!mounted ? (
                            <div className="h-6 w-11 rounded-full bg-white/10" />
                          ) : (
                            <button
                              type="button"
                              onClick={toggleTheme}
                              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                theme === 'dark' ? 'bg-[var(--gold-primary)]' : 'bg-white/15'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false)
                            logout()
                            navigate('/')
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
              <button
                type="button"
                onClick={openLogin}
                className="p-2 rounded-lg text-[var(--text-light)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] transition-all duration-200"
              >
                <User className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] transition-all duration-200"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[var(--border)] bg-[var(--surface-dark)]"
          >
            <nav className="px-4 py-4 space-y-2">
              {!isAdminOrStaff && navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-lg transition-all duration-200 ${
                    location.pathname === link.path
                      ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                      : 'text-[var(--text-light)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    openLogin()
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full text-left px-4 py-3 rounded-lg text-[var(--text-light)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] transition-all duration-200"
                >
                  Login
                </button>
              )}
              <div className="px-4 py-2">
                <ThemeToggle />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
