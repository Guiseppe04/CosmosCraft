import { Outlet, useLocation, useNavigate } from 'react-router'
import { Header } from '../Header.jsx'
import { LoginModal } from '../auth/LoginModal.jsx'
import { CartDrawer } from '../cart/CartDrawer.jsx'
import { useEffect } from 'react'
import { useToast } from '../ui/Toast.jsx'
import { useRef } from 'react'

/**
 * RootLayout Component (fromFigma)
 * Main layout wrapper that applies the global dark background
 */
export function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const handledSearchRef = useRef(new Set())
  const isAdminOrStaff = location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff') || location.pathname.startsWith('/staff/')

  // Show structured OAuth errors passed as query params (auth_error, auth_code)
  useEffect(() => {
    try {
      const search = location.search || ''
      if (!search) return
      // avoid repeating for the same query (handles StrictMode double-render)
      if (handledSearchRef.current.has(search)) return

      const params = new URLSearchParams(search)
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
        // mark handled and clear query params to avoid repeated toasts
        handledSearchRef.current.add(search)
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
