import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { ADJUSTMENT_REASONS, ADJUSTMENT_TYPE_LABELS } from '../../constants/stockAdjustment'
import { ProductSearchSelector } from './ProductSearchSelector'
import { QuantityStepper } from './QuantityStepper'
import { ReasonSelector } from './ReasonSelector'
import { StockVisualizer } from './StockVisualizer'
import { formatCurrency } from '../../../../utils/formatCurrency'

export function AdjustStockModal({ visibleProducts, modal, form, setForm, formErrors, setFormErrors, closeModal, isSaving, saveStockAdjust, showToast, formatCurrency: formatCurrencyOverride }) {
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [localNotes, setLocalNotes] = useState('')

  const preSelectedId = modal.data?.product_id

  useEffect(() => {
    if (preSelectedId) {
      const product = visibleProducts?.find((item) => item.product_id === preSelectedId)
      if (product) {
        setSelectedProduct(product)
        setForm((next) => ({ ...next, product_id: preSelectedId, current_stock: product.stock }))
      }
    }
  }, [preSelectedId, setForm, visibleProducts])

  const handleProductSelect = (productId, product) => {
    setSelectedProduct(product || visibleProducts?.find((item) => item.product_id === productId))
    setForm((next) => ({
      ...next,
      product_id: productId,
      current_stock: product?.stock || next.current_stock,
      change_type: '',
      quantity: '',
    }))
    setFormErrors((errors) => ({ ...errors, product_id: null }))
  }

  const adjustmentType = form.change_type
  const quantity = parseInt(form.quantity, 10) || 0

  const calculatedNewStock = useMemo(() => {
    if (!selectedProduct || !adjustmentType || !quantity) return null
    const current = selectedProduct.stock || 0
    if (adjustmentType === 'stock_in') return current + quantity
    if (adjustmentType === 'stock_out') return current - quantity
    if (adjustmentType === 'adjustment') return quantity
    return current
  }, [adjustmentType, quantity, selectedProduct])

  const canSubmit = selectedProduct && adjustmentType && quantity > 0
  const selectedReason = ADJUSTMENT_REASONS.find((reason) => reason.value === form.reason)
  const needsNotes = selectedReason?.requiresNotes

  const handleSubmit = async () => {
    const errors = {}

    if (!selectedProduct) errors.product_id = 'Please select a product'
    if (!adjustmentType) errors.change_type = 'Please select adjustment type'
    if (!quantity || quantity < 1) errors.quantity = 'Quantity must be greater than 0'
    if (adjustmentType === 'stock_out' && quantity > selectedProduct?.stock) {
      errors.quantity = `Insufficient stock. Available: ${selectedProduct?.stock || 0}`
    }
    if (adjustmentType === 'stock_out' && calculatedNewStock < 0) {
      errors.quantity = 'Stock cannot be negative'
    }
    if (needsNotes && !localNotes.trim()) {
      errors.notes = 'Notes are required for this reason'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    await saveStockAdjust({ reason: form.reason, notes: localNotes })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-xl font-bold">Adjust Stock</h2>
        <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Product *</label>
          <ProductSearchSelector
            products={visibleProducts}
            value={form.product_id}
            onChange={handleProductSelect}
            placeholder="Search by name or SKU..."
          />
          {formErrors.product_id && <p className="mt-1 text-xs text-red-400">{formErrors.product_id}</p>}
        </div>

        {selectedProduct && (
          <div className="p-4 bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border)]">
            <StockVisualizer
              currentStock={selectedProduct.stock || 0}
              newStock={calculatedNewStock}
              threshold={selectedProduct.low_stock_threshold || 10}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Adjustment Type *</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, { label }]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setForm((next) => ({ ...next, change_type: key }))
                  setFormErrors((errors) => ({ ...errors, change_type: null }))
                }}
                className={`py-3 px-3 rounded-xl text-sm font-medium transition-all border ${
                  adjustmentType === key
                    ? 'bg-[var(--gold-primary)] text-black border-[var(--gold-primary)]'
                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {formErrors.change_type && <p className="mt-1 text-xs text-red-400">{formErrors.change_type}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Quantity *</label>
          <QuantityStepper
            value={quantity}
            onChange={(value) => {
              setForm((next) => ({ ...next, quantity: value }))
              setFormErrors((errors) => ({ ...errors, quantity: null }))
            }}
            maxValue={adjustmentType === 'stock_out' ? selectedProduct?.stock : undefined}
            disabled={!selectedProduct || !adjustmentType}
          />
          {formErrors.quantity && <p className="mt-1 text-xs text-red-400">{formErrors.quantity}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Reason *</label>
          <ReasonSelector
            value={form.reason || ''}
            onChange={(value) => {
              setForm((next) => ({ ...next, reason: value }))
              setFormErrors((errors) => ({ ...errors, reason: null }))
            }}
          />
          {formErrors.reason && <p className="mt-1 text-xs text-red-400">{formErrors.reason}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">
            Notes {needsNotes && <span className="text-red-400">*</span>}
          </label>
          <textarea
            value={localNotes}
            onChange={(event) => {
              setLocalNotes(event.target.value)
              setFormErrors((errors) => ({ ...errors, notes: null }))
            }}
            placeholder={needsNotes ? 'Please provide additional details...' : 'Add any additional details (optional)'}
            className="w-full h-20 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
          {formErrors.notes && <p className="mt-1 text-xs text-red-400">{formErrors.notes}</p>}
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--border)]">
        <button
          onClick={closeModal}
          disabled={isSaving}
          className="flex-1 py-3 rounded-xl bg-[var(--bg-primary)] text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSaving}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-bold hover:shadow-[0_8px_25px_rgba(212,175,55,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Processing...' : 'Confirm Adjustment'}
        </button>
      </div>
    </motion.div>
  )
}

export function AdjustPartStockModal({ modal, form, setForm, formErrors, setFormErrors, closeModal, isSaving, savePartStockAdjust, formatCurrency: formatCurrencyOverride }) {
  const [localNotes, setLocalNotes] = useState('')
  const selectedPart = modal.data || null
  const adjustmentType = form.change_type
  const quantity = parseInt(form.quantity, 10) || 0
  const currentStock = Number(selectedPart?.stock ?? selectedPart?.quantity ?? form.current_stock ?? 0) || 0

  const calculatedNewStock = useMemo(() => {
    if (!adjustmentType || !quantity) return null
    if (adjustmentType === 'stock_in') return currentStock + quantity
    if (adjustmentType === 'stock_out') return currentStock - quantity
    if (adjustmentType === 'adjustment') return quantity
    return currentStock
  }, [adjustmentType, currentStock, quantity])

  const canSubmit = Boolean(selectedPart?.part_id && adjustmentType && quantity > 0)
  const selectedReason = ADJUSTMENT_REASONS.find((reason) => reason.value === form.reason)
  const needsNotes = selectedReason?.requiresNotes

  const handleSubmit = async () => {
    const errors = {}

    if (!selectedPart?.part_id) errors.part_id = 'No guitar part selected'
    if (!adjustmentType) errors.change_type = 'Please select adjustment type'
    if (!quantity || quantity < 1) errors.quantity = 'Quantity must be greater than 0'
    if (adjustmentType === 'stock_out' && quantity > currentStock) {
      errors.quantity = `Insufficient stock. Available: ${currentStock}`
    }
    if (adjustmentType === 'stock_out' && calculatedNewStock < 0) {
      errors.quantity = 'Stock cannot be negative'
    }
    if (needsNotes && !localNotes.trim()) {
      errors.notes = 'Notes are required for this reason'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    await savePartStockAdjust({ reason: form.reason, notes: localNotes })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-xl font-bold">Adjust Guitar Part Stock</h2>
        <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4">
          <p className="text-sm font-semibold text-[var(--text-muted)] mb-1">Guitar Part</p>
          <p className="text-white font-semibold">{selectedPart?.name || 'Unknown part'}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {selectedPart?.type_mapping || 'No SKU'} • {formatCurrency(Number(selectedPart?.price || 0))}
          </p>
          {formErrors.part_id && <p className="mt-2 text-xs text-red-400">{formErrors.part_id}</p>}
        </div>

        <div className="p-4 bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border)]">
          <StockVisualizer currentStock={currentStock} newStock={calculatedNewStock} threshold={10} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Adjustment Type *</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, { label }]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setForm((next) => ({ ...next, change_type: key }))
                  setFormErrors((errors) => ({ ...errors, change_type: null }))
                }}
                className={`py-3 px-3 rounded-xl text-sm font-medium transition-all border ${
                  adjustmentType === key
                    ? 'bg-[var(--gold-primary)] text-black border-[var(--gold-primary)]'
                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {formErrors.change_type && <p className="mt-1 text-xs text-red-400">{formErrors.change_type}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Quantity *</label>
          <QuantityStepper
            value={quantity}
            onChange={(value) => {
              setForm((next) => ({ ...next, quantity: value }))
              setFormErrors((errors) => ({ ...errors, quantity: null }))
            }}
            maxValue={adjustmentType === 'stock_out' ? currentStock : undefined}
            disabled={!selectedPart?.part_id || !adjustmentType}
          />
          {formErrors.quantity && <p className="mt-1 text-xs text-red-400">{formErrors.quantity}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Reason *</label>
          <ReasonSelector
            value={form.reason || ''}
            onChange={(value) => {
              setForm((next) => ({ ...next, reason: value }))
              setFormErrors((errors) => ({ ...errors, reason: null }))
            }}
          />
          {formErrors.reason && <p className="mt-1 text-xs text-red-400">{formErrors.reason}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">
            Notes {needsNotes && <span className="text-red-400">*</span>}
          </label>
          <textarea
            value={localNotes}
            onChange={(event) => {
              setLocalNotes(event.target.value)
              setFormErrors((errors) => ({ ...errors, notes: null }))
            }}
            placeholder={needsNotes ? 'Please provide additional details...' : 'Add any additional details (optional)'}
            className="w-full h-20 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
          {formErrors.notes && <p className="mt-1 text-xs text-red-400">{formErrors.notes}</p>}
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--border)]">
        <button
          onClick={closeModal}
          disabled={isSaving}
          className="flex-1 py-3 rounded-xl bg-[var(--bg-primary)] text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSaving}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-bold hover:shadow-[0_8px_25px_rgba(212,175,55,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Processing...' : 'Confirm Adjustment'}
        </button>
      </div>
    </motion.div>
  )
}

export default { AdjustStockModal, AdjustPartStockModal }
