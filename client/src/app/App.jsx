import { RouterProvider } from 'react-router'
import { router } from './routes.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { SocketProvider } from './context/SocketContext.jsx'
import ToastProvider from './components/ui/Toast.jsx'

/**
 * Main App Component
 * Ref: fromFigma/App - Root application wrapper with routing and context
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <CartProvider>
              <RouterProvider router={router} />
            </CartProvider>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
