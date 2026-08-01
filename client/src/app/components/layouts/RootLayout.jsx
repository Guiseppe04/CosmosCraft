import { Outlet, useLocation, useNavigate } from 'react-router'
import { Header } from '../Header.jsx'
import { LoginModal } from '../auth/LoginModal.jsx'
import { CartDrawer } from '../cart/CartDrawer.jsx'
import { useEffect } from 'react'
import { useToast } from '../ui/Toast.jsx'

/**
 * RootLayout Component (fromFigma)
 * Main layout wrapper that applies the global dark background
 */
export function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const isAdminOrStaff = location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff') || location.pathname.startsWith('/staff/')

  // Show structured OAuth errors passed as query params (auth_error, auth_code)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search)
      const authError = params.get('auth_error')
      const authCode = params.get('auth_code')
      if (authError || authCode) {
        // Map known codes to friendly messages
        const codeMap = {
          AUTH_CODE_USED: 'Authorization code already used. Please try signing in again.',
          OAUTH_ERROR: authError || 'Authentication failed. Please try again.',
          EMAIL_EXISTS: 'This email is already registered. Try signing in instead.',
        }
        const message = authCode ? (codeMap[authCode] || authError || 'Authentication failed.') : authError
        toast.error(message || 'Authentication failed')
        // Clear query params to avoid repeated toasts
        navigate(location.pathname, { replace: true })
      }
    } catch (e) {
      // ignore
    }
  }, [location.search, location.pathname, navigate, toast])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] transition-colors duration-300">
      {!isAdminOrStaff && <Header />}
      <main className={isAdminOrStaff ? 'pt-0' : ''}>
        <Outlet />
      </main>
      <LoginModal />
      <CartDrawer />
    </div>
  )
}
