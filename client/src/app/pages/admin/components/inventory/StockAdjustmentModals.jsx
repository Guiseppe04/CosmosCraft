import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { ADJUSTMENT_TYPE_LABELS } from '../../constants/stockAdjustment'
import { ProductSearchSelector } from './ProductSearchSelector'
import { QuantityStepper } from './QuantityStepper'
import { StockVisualizer } from './StockVisualizer'
import { ConfirmModal } from '../../../../components/ui/ConfirmModal'
import { formatCurrency } from '../../../../utils/formatCurrency'

// ─── Shared Sub-Components ───────────────────────────────────────────────────

function FormField({ label, required = false, error, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold text-[var(--text-muted)]">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      </div>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

function AdjustmentTypeSelector({ value, onChange, error }) {
  return (
    <FormField label="Adjustment Type" required error={error}>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, { label, color, icon: Icon }]) => {
          const isActive = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`relative py-3 px-2 rounded-xl text-sm font-medium transition-all border flex flex-col items-center gap-1 ${
                isActive
                  ? 'bg-[var(--gold-primary)] text-black border-[var(--gold-primary)] shadow-lg shadow-[var(--gold-primary)]/20'
                  : 'bg-[var(--bg-primary)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--gold-primary)]/50 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-black' : color}`} />
              <span className="text-[10px] leading-tight">{label}</span>
            </button>
          )
        })}
      </div>
    </FormField>
  )
}

function ActionButtons({ onCancel, onSubmit, isSaving, canSubmit }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-[var(--border)]">
      <button
        onClick={onCancel}
        disabled={isSaving}
        className="w-full sm:flex-1 py-3 rounded-xl bg-[var(--bg-primary)] text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50 order-2 sm:order-1"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={!canSubmit || isSaving}
        className="w-full sm:flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-bold hover:shadow-[0_8px_25px_rgba(212,175,55,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Confirm Adjustment
          </span>
        )}
      </button>
    </div>
  )
}

// ─── Shared Logic Hook ───────────────────────────────────────────────────────

function useStockAdjustment({ initialProduct, currentStock: externalCurrentStock, form, setForm, setFormErrors, saveFn }) {
  const adjustmentType = form.change_type
  const rawQuantity = String(form.quantity ?? '').trim()
  const quantity = rawQuantity === '' ? 0 : (parseInt(rawQuantity, 10) || 0)
  const currentStock = Number(externalCurrentStock ?? 0)

  const calculatedNewStock = useMemo(() => {
    if (!adjustmentType) return null
    // Manual Set uses the quantity field as the absolute new stock level,
    // so 0 is a valid target (used to mark an item out of stock).
    if (adjustmentType === 'adjustment') return quantity
    if (!quantity) return null
    if (adjustmentType === 'stock_in') return currentStock + quantity
    if (adjustmentType === 'stock_out') return Math.max(currentStock - quantity, 0)
    return currentStock
  }, [adjustmentType, currentStock, quantity])

  const canSubmit = useMemo(() => {
    if (!initialProduct || !adjustmentType) return false
    if (adjustmentType === 'adjustment') {
      // A manual set is a no-op when the target equals the current stock.
      return quantity >= 0 && quantity !== currentStock
    }
    return quantity > 0
  }, [initialProduct, adjustmentType, quantity, currentStock])

  const validateForm = useCallback(() => {
    const errors = {}

    if (!initialProduct) errors.product_id = 'Please select a product'
    if (!adjustmentType) errors.change_type = 'Please select adjustment type'

    if (adjustmentType === 'adjustment') {
      if (rawQuantity === '' || quantity < 0) {
        errors.quantity = 'Enter the new stock level (0 or higher)'
      } else if (quantity === currentStock) {
        errors.quantity = `Stock is already set to ${currentStock}`
      }
    } else if (quantity < 1) {
      errors.quantity = 'Quantity must be greater than 0'
    }

    if (adjustmentType === 'stock_out' && quantity > currentStock) {
      errors.quantity = `Insufficient stock. Available: ${currentStock}`
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [initialProduct, adjustmentType, quantity, rawQuantity, currentStock, setFormErrors])

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return

    // Pass the authoritative current stock along so the parent's save handler
    // never derives the manual-set delta from a stale Products-tab list.
    await saveFn({
      change_type: adjustmentType,
      quantity,
      current_stock: currentStock,
    })
  }, [validateForm, adjustmentType, quantity, currentStock, saveFn])

  return {
    adjustmentType,
    quantity,
    currentStock,
    calculatedNewStock,
    canSubmit,
    validateForm,
    handleSubmit,
  }
}

// ─── Confirmation Summary Text ───────────────────────────────────────────────

function buildAdjustmentSummaryText({ itemName, adjustmentType, quantity, currentStock, newStock }) {
  const typeLabel = ADJUSTMENT_TYPE_LABELS[adjustmentType]?.label || 'Stock Adjustment'
  const noun = itemName || 'this item'
  if (adjustmentType === 'adjustment') {
    return `Manual Set: "${noun}" will be set to exactly ${newStock} unit${newStock === 1 ? '' : 's'}. Current stock: ${currentStock}.`
  }
  const action = adjustmentType === 'stock_in' ? 'added to' : 'removed from'
  return `${typeLabel}: ${quantity} unit${quantity === 1 ? '' : 's'} of "${noun}" will be ${action} stock. Stock will change from ${currentStock} to ${newStock}.`
}

// ─── Keyboard Shortcuts Hook ─────────────────────────────────────────────────

function useKeyboardShortcuts({ onEscape, enabled = true }) {
  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onEscape?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onEscape])
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function ModalSkeleton() {
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 w-40 bg-white/10 rounded-lg" />
        <div className="h-9 w-9 bg-white/10 rounded-lg" />
      </div>
      <div className="space-y-5">
        <div>
          <div className="h-4 w-20 bg-white/10 rounded mb-2" />
          <div className="h-12 w-full bg-white/10 rounded-xl" />
        </div>
        <div className="h-32 w-full bg-white/10 rounded-xl" />
        <div>
          <div className="h-4 w-28 bg-white/10 rounded mb-2" />
          <div className="h-12 w-full bg-white/10 rounded-xl" />
        </div>
        <div>
          <div className="h-4 w-16 bg-white/10 rounded mb-2" />
          <div className="h-12 w-full bg-white/10 rounded-xl" />
        </div>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--border)]">
        <div className="flex-1 h-12 bg-white/10 rounded-xl" />
        <div className="flex-1 h-12 bg-white/10 rounded-xl" />
      </div>
    </div>
  )
}

// ─── AdjustStockModal ────────────────────────────────────────────────────────

export function AdjustStockModal({ visibleProducts, modal, form, setForm, formErrors, setFormErrors, closeModal, isSaving, saveStockAdjust, showToast, formatCurrency: formatCurrencyOverride }) {
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  const preSelectedId = modal.data?.product_id

  useEffect(() => {
    if (visibleProducts) {
      const timer = setTimeout(() => setIsLoading(false), 200)
      return () => clearTimeout(timer)
    }
  }, [visibleProducts])

  useEffect(() => {
    if (preSelectedId && !selectedProduct) {
      const product = visibleProducts?.find((item) => item.product_id === preSelectedId)
      if (product) {
        setSelectedProduct(product)
        setForm((next) => ({ ...next, product_id: preSelectedId, current_stock: product.stock }))
      }
    }
  }, [preSelectedId, selectedProduct, setForm, visibleProducts])

  const {
    adjustmentType, quantity,
    currentStock, calculatedNewStock,
    canSubmit,
    validateForm,
    handleSubmit,
  } = useStockAdjustment({
    initialProduct: selectedProduct,
    currentStock: selectedProduct?.stock || 0,
    form, setForm, setFormErrors,
    saveFn: saveStockAdjust,
  })

  const handleProductSelect = useCallback((productId, product) => {
    const resolved = product || visibleProducts?.find((item) => item.product_id === productId)
    setSelectedProduct(resolved)
    setForm((next) => ({
      ...next,
      product_id: productId,
      current_stock: resolved?.stock || next.current_stock,
      change_type: '',
      quantity: '',
    }))
    setFormErrors((errors) => ({ ...errors, product_id: null }))
  }, [visibleProducts, setForm, setFormErrors])

  useKeyboardShortcuts({ onEscape: closeModal, enabled: !confirming })

  if (isLoading && !visibleProducts) {
    return <ModalSkeleton />
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h2 className="text-white text-lg sm:text-xl font-bold truncate">Adjust Stock</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Update inventory levels for a product</p>
        </div>
        <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0">
          <X className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Product Selection */}
        <FormField label="Product" required error={formErrors.product_id}>
          <ProductSearchSelector
            products={visibleProducts}
            value={form.product_id}
            onChange={handleProductSelect}
            placeholder="Search by name or SKU..."
          />
        </FormField>

        {selectedProduct && (
          <div className="bg-[var(--bg-primary)]/30 rounded-xl p-3 sm:p-4 border border-[var(--border)]/50">
            <StockVisualizer
              currentStock={selectedProduct.stock || 0}
              newStock={calculatedNewStock}
              threshold={selectedProduct.low_stock_threshold || 10}
              maxStock={selectedProduct.max_stock || 0}
            />
          </div>
        )}

        {/* Adjustment Type */}
        <AdjustmentTypeSelector
          value={adjustmentType}
          onChange={(value) => {
            // For Manual Set the quantity field is the target stock, so seed it
            // with the current stock (a no-op the user then edits up/down).
            if (value === 'adjustment' && !form.quantity && currentStock !== null && currentStock !== undefined) {
              setForm((next) => ({ ...next, change_type: value, quantity: currentStock }))
            } else {
              setForm((next) => ({ ...next, change_type: value }))
            }
            setFormErrors((errors) => ({ ...errors, change_type: null }))
          }}
          error={formErrors.change_type}
        />

        {/* Quantity */}
        <FormField label="Quantity" required error={formErrors.quantity}>
          <QuantityStepper
            value={quantity}
            onChange={(value) => {
              setForm((next) => ({ ...next, quantity: value }))
              setFormErrors((errors) => ({ ...errors, quantity: null }))
            }}
            minValue={adjustmentType === 'adjustment' ? 0 : 1}
            maxValue={adjustmentType === 'stock_out' ? currentStock : undefined}
            disabled={!selectedProduct || !adjustmentType}
          />
        </FormField>
      </div>

      <ActionButtons
        onCancel={closeModal}
        onSubmit={() => {
          if (validateForm()) setConfirming(true)
        }}
        isSaving={isSaving}
        canSubmit={canSubmit}
      />

      <ConfirmModal
        open={confirming}
        title="Confirm Stock Adjustment?"
        description={buildAdjustmentSummaryText({
          itemName: selectedProduct?.name,
          adjustmentType,
          quantity,
          currentStock,
          newStock: calculatedNewStock ?? currentStock,
        })}
        confirmLabel="Yes, adjust stock"
        cancelLabel="Go back"
        variant={adjustmentType === 'stock_in' ? 'info' : 'warning'}
        isBusy={isSaving}
        onConfirm={async () => {
          setConfirming(false)
          await handleSubmit()
        }}
        onCancel={() => setConfirming(false)}
      />
    </motion.div>
  )
}

// ─── AdjustPartStockModal ────────────────────────────────────────────────────

export function AdjustPartStockModal({ modal, form, setForm, formErrors, setFormErrors, closeModal, isSaving, savePartStockAdjust, formatCurrency: formatCurrencyOverride }) {
  const [confirming, setConfirming] = useState(false)
  const selectedPart = modal.data || null
  const currentStock = Number(selectedPart?.stock ?? selectedPart?.quantity ?? form.current_stock ?? 0) || 0

  const {
    adjustmentType, quantity,
    calculatedNewStock,
    canSubmit,
    validateForm,
    handleSubmit,
  } = useStockAdjustment({
    initialProduct: selectedPart,
    currentStock,
    form, setForm, setFormErrors,
    saveFn: savePartStockAdjust,
  })

  useKeyboardShortcuts({ onEscape: closeModal, enabled: !confirming })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h2 className="text-white text-lg sm:text-xl font-bold truncate">Adjust Guitar Part Stock</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Update inventory levels for a guitar part</p>
        </div>
        <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0">
          <X className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Part Info */}
        <div className="bg-[var(--bg-primary)]/30 rounded-xl p-3 sm:p-4 border border-[var(--border)]/50">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Guitar Part</p>
            <p className="text-white font-semibold">{selectedPart?.name || 'Unknown part'}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {selectedPart?.type_mapping || 'No SKU'} &bull; {formatCurrency(Number(selectedPart?.price || 0))}
            </p>
            {formErrors.part_id && (
              <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {formErrors.part_id}
              </p>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--border)]/50">
            <StockVisualizer
              currentStock={currentStock}
              newStock={calculatedNewStock}
              threshold={10}
              maxStock={0}
            />
          </div>
        </div>

        {/* Adjustment Type */}
        <AdjustmentTypeSelector
          value={adjustmentType}
          onChange={(value) => {
            // For Manual Set the quantity field is the target stock, so seed it
            // with the current stock (a no-op the user then edits up/down).
            if (value === 'adjustment' && !form.quantity && currentStock !== null && currentStock !== undefined) {
              setForm((next) => ({ ...next, change_type: value, quantity: currentStock }))
            } else {
              setForm((next) => ({ ...next, change_type: value }))
            }
            setFormErrors((errors) => ({ ...errors, change_type: null }))
          }}
          error={formErrors.change_type}
        />

        {/* Quantity */}
        <FormField label="Quantity" required error={formErrors.quantity}>
          <QuantityStepper
            value={quantity}
            onChange={(value) => {
              setForm((next) => ({ ...next, quantity: value }))
              setFormErrors((errors) => ({ ...errors, quantity: null }))
            }}
            minValue={adjustmentType === 'adjustment' ? 0 : 1}
            maxValue={adjustmentType === 'stock_out' ? currentStock : undefined}
            disabled={!selectedPart?.part_id || !adjustmentType}
          />
        </FormField>
      </div>

      <ActionButtons
        onCancel={closeModal}
        onSubmit={() => {
          if (validateForm()) setConfirming(true)
        }}
        isSaving={isSaving}
        canSubmit={canSubmit}
      />

      <ConfirmModal
        open={confirming}
        title="Confirm Stock Adjustment?"
        description={buildAdjustmentSummaryText({
          itemName: selectedPart?.name,
          adjustmentType,
          quantity,
          currentStock,
          newStock: calculatedNewStock ?? currentStock,
        })}
        confirmLabel="Yes, adjust stock"
        cancelLabel="Go back"
        variant={adjustmentType === 'stock_in' ? 'info' : 'warning'}
        isBusy={isSaving}
        onConfirm={async () => {
          setConfirming(false)
          await handleSubmit()
        }}
        onCancel={() => setConfirming(false)}
      />
    </motion.div>
  )
}

export default { AdjustStockModal, AdjustPartStockModal }