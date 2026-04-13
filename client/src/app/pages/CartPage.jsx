import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react'

/**
 * CartPage - Shopping Cart
 * Theme: Dark theme with gold accents (matching LandingPage)
 */
export function CartPage() {
  const { cart, removeFromCart, updateQuantity, getTotalPrice } = useCart()
  const { isAuthenticated, openLogin } = useAuth()
  const navigate = useNavigate()

  const handleCheckout = () => {
    if (!isAuthenticated) openLogin(() => navigate('/checkout'))
    else navigate('/checkout')
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pt-24">
        <div className="page text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center w-24 h-24 bg-[var(--surface-dark)] border border-[var(--border)] rounded-full mb-4"
          >
            <ShoppingBag className="w-12 h-12 text-[var(--gold-primary)]" />
          </motion.div>
          <h1 className="text-5xl font-bold text-white">Your Cart is Empty</h1>
          <p className="text-lg text-[var(--text-muted)]">Start shopping to add items to your cart</p>
          <Link 
            to="/shop" 
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200"
          >
            Continue Shopping
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24">
      <div className="page">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-5xl font-bold text-white mb-12"
        >
          Shopping Cart
        </motion.h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 flex justify-between items-center hover:border-[var(--gold-primary)]/50 transition-all duration-300"
              >
                <div className="flex-grow">
                  <h3 className="text-xl font-bold text-white">{item.name}</h3>
                  <p className="text-[var(--text-muted)] mt-1">₱{item.price.toLocaleString('en-PH')}</p>
                  {item.metadata && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(item.metadata).map(([k, v]) => 
                        v && typeof v === 'string' ? (
                          <span key={k} className="text-xs px-2.5 py-1 rounded-md bg-white/5 border border-[var(--border)] text-white/80 capitalize">
                            {v}
                          </span>
                        ) : null
                      ).filter(Boolean).slice(0, 6)}
                    </div>
                  )}
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-4 mx-6">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-2 hover:bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg transition-all duration-200 hover:border-[var(--gold-primary)]"
                  >
                    <Minus className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                  <span className="w-8 text-center font-bold text-white">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-2 hover:bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg transition-all duration-200 hover:border-[var(--gold-primary)]"
                  >
                    <Plus className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                </div>

                {/* Subtotal */}
                <div className="w-24 text-right">
                  <p className="text-lg font-bold text-[var(--gold-primary)]">₱{(item.price * item.quantity).toLocaleString('en-PH')}</p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 ml-4 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 rounded-lg transition-all duration-200 text-red-400 hover:text-red-300"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </div>

          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8 h-fit space-y-6 sticky top-24"
          >
            <h2 className="text-2xl font-bold text-white">Order Summary</h2>

            <div className="space-y-3 border-t border-[var(--border)] pt-6">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Subtotal</span>
                <span className="font-bold text-white">₱{getTotalPrice().toLocaleString('en-PH')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Shipping</span>
                <span className="font-bold text-white"></span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Tax</span>
                <span className="font-bold text-white">₱{(getTotalPrice() * 0.1).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-6 flex justify-between items-center">
              <span className="text-xl font-bold text-white">Total</span>
              <span className="text-3xl font-bold bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] bg-clip-text text-transparent">
                ₱{(getTotalPrice() * 1.1).toLocaleString('en-PH', { maximumFractionDigits: 2 })}
              </span>
            </div>

            <button 
              onClick={handleCheckout} 
              className="block w-full px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200 text-center"
            >
              Proceed to Checkout
            </button>

            <Link 
              to="/shop" 
              className="block w-full px-8 py-4 border-2 border-[var(--border)] text-white rounded-xl font-semibold hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all duration-200 text-center"
            >
              Continue Shopping
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
