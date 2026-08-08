import { RouterProvider } from 'react-router'
import { router } from './routes.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import ToastProvider from './components/ui/Toast.jsx'

/**
 * Main App Component
 * Ref: fromFigma/App - Root application wrapper with routing and context
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
