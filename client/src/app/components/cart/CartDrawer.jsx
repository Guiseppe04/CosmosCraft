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
            className="w-full max-w-md h-full shadow-2xl flex flex-col bg-[var(--bg-primary)]"
          >
            <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-[var(--surface-dark)] to-[var(--surface-dark)]">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-light)]">Shopping Cart</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-[var(--text-light)] transition-colors"
              >
                <span className="flex items-center justify-center w-6 h-6 text-xl">×</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[var(--surface-dark)] flex items-center justify-center mb-3">
                    <Trash2 className="w-8 h-8 text-[var(--text-muted)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-light)] mb-1">Your cart is empty</p>
                  <p className="text-xs text-[var(--text-muted)]">Add items to get started</p>
                </div>
              ) : (
                cart.map(item => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-3 hover:border-[var(--gold-primary)]/50 transition-all"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg border border-[var(--border)]"
                          onError={(e) => { e.target.src = '/assets/placeholder.jpg' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-light)] truncate">{item.name}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          ₱{item.price.toLocaleString('en-PH')} each
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-light)] hover:bg-[var(--bg-primary)] transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <div className="px-2.5 py-1 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)]">
                            <span className="text-xs font-bold text-[var(--text-light)]">{item.quantity}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-light)] hover:bg-[var(--bg-primary)] transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-right flex flex-col justify-between">
                        <div>
                          <p className="text-sm font-bold text-[var(--gold-primary)]">
                            ₱{(item.price * item.quantity).toLocaleString('en-PH')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="mt-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="border-t border-[var(--border)] px-5 py-5 space-y-4 bg-[var(--surface-dark)]/50">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-muted)]">Subtotal</span>
                  <span className="font-semibold text-[var(--text-light)]">
                    ₱{getTotalPrice().toLocaleString('en-PH')}
                  </span>
                </div>
                <div className="h-px bg-[var(--border)]" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--text-light)]">Total</span>
                  <span className="text-lg font-bold text-[var(--gold-primary)]">
                    ₱{getTotalPrice().toLocaleString('en-PH')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleCheckout}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] text-sm font-bold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
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

