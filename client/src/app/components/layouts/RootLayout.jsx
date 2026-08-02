import { Outlet, useLocation } from 'react-router'
import { Header } from '../Header.jsx'
import { LoginModal } from '../auth/LoginModal.jsx'
import { CartDrawer } from '../cart/CartDrawer.jsx'

/**
 * RootLayout Component (fromFigma)
 * Main layout wrapper that applies the global dark background
 */
export function RootLayout() {
  const location = useLocation()
  const isAdminOrStaff = location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff') || location.pathname.startsWith('/staff/')

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
