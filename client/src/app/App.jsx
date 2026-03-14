import { RouterProvider } from 'react-router'
import { router } from './routes.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

/**
 * Main App Component
 * Ref: fromFigma/App - Root application wrapper with routing and context
 */
export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  )
}
