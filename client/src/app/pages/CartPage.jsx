import { Link, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, AlertTriangle, Package, Zap, ShieldCheck, Truck } from 'lucide-react'
import { useState, useEffect } from 'react'

export function CartPage() {
  const { cart, removeFromCart, updateQuantity, getTotalPrice, clearCart } = useCart()
  const { isAuthenticated, openLogin } = useAuth()
  const navigate = useNavigate()
  const [removingItem, setRemovingItem] = useState(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleCheckout = () => {
    const hasOutOfStock = cart.some(item => item.stock === 0)
    if (hasOutOfStock) return
    if (!isAuthenticated) openLogin(() => navigate('/checkout'))
    else navigate('/checkout')
  }

  const handleRemoveItem = (itemId) => {
    setRemovingItem(itemId)
    setTimeout(() => {
      removeFromCart(itemId)
      setRemovingItem(null)
    }, 300)
  }

  const handleClearCart = () => {
    clearCart()
    setShowClearConfirm(false)
  }

  const subtotal = getTotalPrice()
  const shipping = subtotal >= 5000 ? 0 : 150
  const taxRate = 0.1
  const tax = subtotal * taxRate
  const discount = 0
  const total = subtotal + shipping + tax - discount
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const hasOutOfStock = cart.some(item => item.stock === 0)
  const hasLowStock = cart.some(item => item.stock > 0 && item.stock <= 5)

  const products = cart.filter(item => !item.isCustomBuild)
  const customBuilds = cart.filter(item => item.isCustomBuild)

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-12">
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

  const CartItemCard = ({ item, index }) => {
    const isOutOfStock = item.stock === 0
    const isLowStock = item.stock > 0 && item.stock <= 5
    const isMaxQuantity = item.quantity >= item.stock

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.4, delay: index * 0.1 }}
        className={`group relative bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-[var(--gold-primary)]/30 transition-all duration-300 ${isOutOfStock ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <img 
              src={item.image} 
              alt={item.name}
              className="w-20 h-20 object-cover rounded-lg border border-[var(--border)]"
            />
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-red-400">Out of Stock</span>
              </div>
            )}
          </div>

          <div className="flex-grow min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{item.name}</h3>
                {item.category && (
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">{item.category}</p>
                )}
              </div>
              <button
                onClick={() => handleRemoveItem(item.id)}
                disabled={removingItem === item.id}
                className="p-2 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 rounded-lg transition-all duration-200 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                aria-label="Remove item"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {item.metadata && Object.entries(item.metadata).map(([k, v]) => 
                v && typeof v === 'string' ? (
                  <span key={k} className="text-xs px-2.5 py-1 rounded-md bg-white/5 border border-[var(--border)] text-white/80 capitalize">
                    {v}
                  </span>
                ) : null
              ).filter(Boolean).slice(0, 4)}
            </div>

            {isLowStock && !isOutOfStock && (
              <div className="mt-2 flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Only {item.stock} left</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-1">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                disabled={item.quantity <= 1 || isOutOfStock}
                className="p-2.5 hover:bg-[var(--surface-dark)] rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                <Minus className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              <span className="w-10 text-center font-bold text-white">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                disabled={isMaxQuantity || isOutOfStock}
                className="p-2.5 hover:bg-[var(--surface-dark)] rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          <div className="w-28 text-right">
            <p className="text-lg font-bold text-[var(--gold-primary)]">₱{(item.price * item.quantity).toLocaleString('en-PH')}</p>
            {item.quantity > 1 && (
              <p className="text-xs text-[var(--text-muted)]">₱{item.price.toLocaleString('en-PH')} each</p>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  const CartSection = ({ title, icon: Icon, items }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold text-white">
        <Icon className="w-5 h-5 text-[var(--gold-primary)]" />
        {title}
        <span className="text-sm text-[var(--text-muted)] font-normal">({items.length})</span>
      </div>
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {items.map((item, idx) => (
            <CartItemCard key={item.id} item={item} index={idx} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-32 lg:pb-12">
      <div className="page">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8"
        >
          <h1 className="text-4xl lg:text-5xl font-bold text-white">Shopping Cart</h1>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl">
              <ShoppingBag className="w-5 h-5 text-[var(--gold-primary)]" />
              <span className="text-white font-medium">{totalItems} Items</span>
              <span className="text-[var(--text-muted)]">|</span>
              <span className="text-[var(--gold-primary)] font-bold">₱{subtotal.toLocaleString('en-PH')}</span>
            </div>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 rounded-xl transition-all duration-200"
            >
              Clear Cart
            </button>
          </div>
        </motion.div>

        {hasOutOfStock && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">Some items are out of stock. Please remove them before checkout.</p>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {products.length > 0 && (
              <CartSection title="Products" icon={Package} items={products} />
            )}
            {customBuilds.length > 0 && (
              <CartSection title="Custom Builds" icon={Zap} items={customBuilds} />
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 space-y-5 sticky top-24">
              <h2 className="text-2xl font-bold text-white">Order Summary</h2>

              <div className="space-y-3 border-t border-b border-[var(--border)] py-4">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Subtotal</span>
                  <span className="font-bold text-white">₱{subtotal.toLocaleString('en-PH')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Shipping</span>
                  <span className="font-bold text-white">
                    {shipping === 0 ? (
                      <span className="text-green-400">FREE</span>
                    ) : (
                      `₱${shipping.toLocaleString('en-PH')}`
                    )}
                  </span>
                </div>
                {subtotal < 5000 && (
                  <p className="text-xs text-[var(--text-muted)]">Free shipping on orders over ₱5,000</p>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Tax (10%)</span>
                  <span className="font-bold text-white">₱{tax.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-green-400">Discount</span>
                    <span className="font-bold text-green-400">-₱{discount.toLocaleString('en-PH')}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-white">Total</span>
                <span className="text-3xl font-bold bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] bg-clip-text text-transparent">
                  ₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                </span>
              </div>

              <button 
                onClick={handleCheckout}
                disabled={hasOutOfStock}
                className="w-full px-6 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200 text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
              >
                Proceed to Checkout
                <ArrowRight className="w-5 h-5" />
              </button>

              <Link 
                to="/shop" 
                className="block w-full px-6 py-4 border-2 border-[var(--border)] text-white rounded-xl font-semibold hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all duration-200 text-center"
              >
                Continue Shopping
              </Link>

              <div className="pt-4 border-t border-[var(--border)] space-y-2">
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                  <span>Secure Checkout</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Package className="w-4 h-4 text-green-400" />
                  <span>Cash on Delivery Available</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Truck className="w-4 h-4 text-green-400" />
                  <span>Fast Delivery (1–3 days)</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Clear Cart?</h3>
              <p className="text-[var(--text-muted)] mb-6">This will remove all items from your cart. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-3 border border-[var(--border)] text-white rounded-xl font-medium hover:bg-white/5 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearCart}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all duration-200"
                >
                  Clear Cart
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface-dark)] border-t border-[var(--border)] p-4 z-40">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--text-muted)]">Total ({totalItems} items)</p>
            <p className="text-2xl font-bold text-[var(--gold-primary)]">₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</p>
          </div>
          <button
            onClick={handleCheckout}
            disabled={hasOutOfStock}
            className="px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  )
}
