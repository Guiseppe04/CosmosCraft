import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { useCart } from '../../context/CartContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Trash2, Plus, Minus } from 'lucide-react'

export function CartDrawer() {
  const { cart, isOpen, setIsOpen, updateQuantity, removeFromCart, getTotalPrice } = useCart()
  const { isAuthenticated, openLogin } = useAuth()
  const navigate = useNavigate()

  const handleCheckout = () => {
    setIsOpen(false)
    if (!isAuthenticated) openLogin(() => navigate('/checkout'))
    else navigate('/checkout')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="w-full max-w-md h-full shadow-2xl flex flex-col bg-[var(--surface-elevated)]"
          >
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-light)]">Shopping Cart</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--gold-primary)] text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {cart.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] mt-4">Your cart is empty.</p>
              ) : (
                cart.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border border-[var(--border)] rounded-xl px-3 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-light)] truncate">{item.name}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        ${item.price.toLocaleString('en-PH')} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-[var(--text-light)]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--text-light)]">
                        ₱{(item.price * item.quantity).toLocaleString('en-PH')}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[var(--border)] px-6 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Subtotal</span>
                <span className="font-semibold text-[var(--text-light)]">
                  ${getTotalPrice().toLocaleString('en-PH')}
                </span>
              </div>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleCheckout}
                className="w-full py-2.5 rounded-lg bg-[var(--gold-primary)] text-[var(--text-dark)] text-sm font-semibold hover:bg-[var(--gold-secondary)] transition disabled:opacity-60"
              >
                Proceed to Checkout
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

