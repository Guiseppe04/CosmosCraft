import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Guitar, Menu, X, User, ShoppingCart, ChevronDown, UserCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ThemeToggle } from './ThemeToggle.jsx'
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
  const customizeRef = useRef(null)
  const { getCartCount, setIsOpen: setCartOpen } = useCart()
  const { isAuthenticated, user, openLogin } = useAuth()
  const cartCount = getCartCount()

  // Check if we're on admin or staff routes
  const isAdminOrStaff = location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff')

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (customizeRef.current && !customizeRef.current.contains(event.target)) {
        setCustomizeOpen(false)
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
                    className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                      location.pathname === link.path
                        ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                      isCustomizeActive
                        ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'
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
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    location.pathname === '/shop'
                      ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  Shop
                </Link>
              </>
            )}
          </nav>

          {/* User Actions */}
          <div className="hidden md:flex items-center gap-3 relative">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] transition-all duration-200"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center bg-[var(--gold-primary)] text-[var(--text-dark)] text-xs font-bold px-1.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]/80 transition-all duration-200"
              >
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt="Profile" 
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[var(--gold-primary)] text-[var(--text-dark)] flex items-center justify-center text-xs font-bold">
                    {(user?.name?.firstName || user?.email || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium max-w-[120px] truncate">
                  {user?.name?.firstName && user?.name?.lastName
                    ? `${user.name.firstName} ${user.name.lastName}`
                    : user?.name?.firstName
                    ? user.name.firstName
                    : user?.email || 'Guest'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openLogin}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] transition-all duration-200"
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
                      : 'text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]'
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
                  className="block w-full text-left px-4 py-3 rounded-lg text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] transition-all duration-200"
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
