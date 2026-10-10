import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { useCart } from '../../context/CartContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { ShoppingBag, X, ArrowRight } from 'lucide-react'
import { SelectableCartItemRow } from './SelectableCartItemRow.jsx'
import { useState, useEffect } from 'react'

export function CartDrawer() {
  const {
    cart,
    isOpen,
    setIsOpen,
    updateQuantity,
    removeFromCart,
    getTotalPrice,
    toggleItemSelection,
    toggleSelectAllItems,
    getSelectedItemIds,
    waitForCartUpdates,
  } = useCart()
  const { isAuthenticated, openLogin } = useAuth()
  const navigate = useNavigate()
  const [checkoutError, setCheckoutError] = useState('')

  const selectedProductIds = getSelectedItemIds()
  const selectedCount = selectedProductIds.length
  const allItemsSelected = cart.length > 0 && cart.every(item => selectedProductIds.includes(String(item.id)))

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = event => { if (event.key === 'Escape') setIsOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isOpen, setIsOpen])

  const handleCheckout = async () => {
    if (selectedProductIds.length === 0) {
      setCheckoutError('Please select at least one item to proceed to checkout.')
      return
    }
    if (!await waitForCartUpdates()) {
      setCheckoutError('Cart quantity could not be saved. Please try again.')
      return
    }
    const selectedItems = cart.filter(item => selectedProductIds.includes(String(item.id)))
    const cartItemIds = selectedItems.map(item => item.cart_item_id).filter(Boolean)
    if (isAuthenticated && cartItemIds.length !== selectedItems.length) {
      setCheckoutError('Your cart is still syncing. Please try checkout again in a moment.')
      return
    }
    setCheckoutError('')
    setIsOpen(false)
    const cartProductIds = selectedItems.map(item => String(item.id))
    if (!isAuthenticated) openLogin(() => navigate('/checkout', { state: { cartProductIds } }))
    else navigate('/checkout', { state: { cartItemIds, cartProductIds } })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={event => { if (event.target === event.currentTarget) setIsOpen(false) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            className="w-full max-w-lg h-[100dvh] shadow-2xl flex flex-col bg-[var(--bg-primary)] border-l border-[var(--border)]"
          >
            <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-[var(--surface-dark)] to-[var(--surface-dark)]">
              <div>
                <h2 id="cart-drawer-title" className="text-xl font-bold text-[var(--text-light)]">Your Cart</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                type="button"
                aria-label="Close cart"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-[var(--surface-dark)] text-[var(--text-muted)] hover:text-[var(--text-light)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[var(--surface-dark)] flex items-center justify-center mb-3">
                    <ShoppingBag className="w-8 h-8 text-[var(--gold-primary)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-light)] mb-1">Your cart is empty</p>
                  <p className="text-xs text-[var(--text-muted)]">Add items to get started</p>
                  <button type="button" onClick={() => { setIsOpen(false); navigate('/shop') }} className="mt-5 rounded-xl bg-[var(--gold-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-dark)]">Browse Shop</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2">
                    <div className="text-xs text-[var(--text-muted)]">
                      {selectedCount} of {cart.length} item{cart.length !== 1 ? 's' : ''} selected
                    </div>
                    <button
                      type="button"
                      onClick={toggleSelectAllItems}
                      className="text-xs font-semibold text-[var(--gold-primary)] hover:text-white transition-colors"
                    >
                      {allItemsSelected ? 'Clear Selection' : 'Select All'}
                    </button>
                  </div>

                  {cart.map(item => (
                    <SelectableCartItemRow
                      key={item.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeFromCart}
                      isSelected={selectedProductIds.includes(String(item.id))}
                      onToggleSelect={toggleItemSelection}
                      selectionEnabled
                      showQuantityControls
                      showRemove
                    />
                  ))}
                </>
              )}
            </div>

            <div className="border-t border-[var(--border)] px-5 py-5 space-y-4 bg-[var(--surface-dark)]/50">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-muted)]">Selected subtotal ({selectedCount} {selectedCount === 1 ? 'item' : 'items'})</span>
                  <span className="font-semibold text-[var(--text-light)]">
                    ₱{getTotalPrice().toLocaleString('en-PH')}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Delivery fees are calculated at checkout.</p>
              </div>
              <button
                type="button"
                disabled={cart.length === 0 || selectedCount === 0}
                onClick={handleCheckout}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] text-sm font-bold flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </button>
              {cart.length > 0 && <button type="button" onClick={() => { setIsOpen(false); navigate('/cart') }} className="w-full py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--gold-primary)]">View Full Cart</button>}
              {checkoutError && <p role="alert" className="text-sm text-red-400">{checkoutError}</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

