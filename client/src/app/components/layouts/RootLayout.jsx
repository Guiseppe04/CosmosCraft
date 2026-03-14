import { Outlet } from 'react-router'
import { Header } from '../Header.jsx'
import { LoginModal } from '../auth/LoginModal.jsx'
import { CartDrawer } from '../cart/CartDrawer.jsx'

/**
 * RootLayout Component (fromFigma)
 * Main layout wrapper that applies the global dark background
 */
export function RootLayout() {
  return (
    <div className="min-h-screen bg-[var(--black-deep)]">
      <Header />
      <main>
        <Outlet />
      </main>
      <LoginModal />
      <CartDrawer />
    </div>
  )
}
