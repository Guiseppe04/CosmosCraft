import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { useCart } from '../../context/CartContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Trash2 } from 'lucide-react'
import { SelectableCartItemRow } from './SelectableCartItemRow.jsx'

export function CartDrawer() {
  const {
    cart,
    isOpen,
    setIsOpen,
    updateQuantity,
    removeFromCart,
    getTotalPrice,
    selectedItemIds,
    toggleItemSelection,
    toggleSelectAllItems,
    getSelectedItemIds,
  } = useCart()
  const { isAuthenticated, openLogin } = useAuth()
  const navigate = useNavigate()

  const selectedCartItemIds = getSelectedItemIds()
  const selectedCount = selectedCartItemIds.length
  const allItemsSelected = cart.length > 0 && cart.every(item => selectedCartItemIds.includes(String(item.id)))

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
                      isSelected={selectedCartItemIds.includes(String(item.id))}
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

