import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Guitar, Menu, X, User, ShoppingCart } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Header Component (fromFigma)
 * Fixed, blurred header with active link highlight and animated mobile menu.
 */
export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { getCartCount, setIsOpen: setCartOpen } = useCart()
  const { isAuthenticated, user, openLogin } = useAuth()
  const cartCount = getCartCount()

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/customize', label: 'Customize' },
    { path: '/shop', label: 'Shop' },
    { path: '/appointments', label: 'Appointments' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--surface-dark)]/95 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-gradient-to-br from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-lg group-hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-200">
              <Guitar className="w-5 h-5 text-[var(--text-dark)]" />
            </div>
            <span className="text-xl font-semibold bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-accent)] bg-clip-text text-transparent">
              CosmosCraft
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
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
          </nav>

          {/* User Actions */}
          <div className="hidden md:flex items-center gap-3 relative">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)]/80 transition-all duration-200"
              >
                <div className="w-7 h-7 rounded-full bg-[var(--gold-primary)] text-[var(--text-dark)] flex items-center justify-center text-xs font-bold">
                  {(user?.name?.firstName || user?.email || 'G').charAt(0).toUpperCase()}
                </div>
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
              {navLinks.map((link) => (
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
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
