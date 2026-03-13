import { Outlet, useLocation } from 'react-router'
import { Header } from '../Header.jsx'
import { LoginModal } from '../auth/LoginModal.jsx'
import { CartDrawer } from '../cart/CartDrawer.jsx'

/**
 * RootLayout Component (fromFigma)
 * Main layout wrapper that applies the global dark background
 * and conditionally hides the header on the login page.
 */
export function RootLayout() {
  const location = useLocation()
  const hideHeader = location.pathname === '/login'

  return (
    <div className="min-h-screen bg-[var(--black-deep)]">
      {!hideHeader && <Header />}
      <main>
        <Outlet />
      </main>
      <LoginModal />
      <CartDrawer />
    </div>
  )
}
