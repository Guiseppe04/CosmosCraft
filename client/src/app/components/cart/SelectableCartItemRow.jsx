import { motion } from 'motion/react'
import { Check, Guitar, Minus, Plus, Trash2 } from 'lucide-react'
import CustomBuildThumbnail from '../customize/CustomBuildThumbnail.jsx'
import { BuilderConfigurationPanel } from '../customize/BuilderConfigurationPanel.jsx'
import { getCustomBuildSummaryLines } from '../../utils/customBuildSummary.js'

export function SelectableCartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
  isSelected,
  onToggleSelect,
  selectionEnabled = true,
  showQuantityControls = true,
  showRemove = true,
  className = '',
}) {
  const parsedStock = item.stock == null ? NaN : Number(item.stock)
  const hasStockValue = Number.isFinite(parsedStock) && parsedStock >= 0
  const itemStock = hasStockValue ? parsedStock : null
  const atStockLimit = hasStockValue && item.quantity >= itemStock
  const outOfStock = hasStockValue && itemStock === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 p-4 transition-all duration-200 hover:border-[var(--gold-primary)]/30 hover:bg-[var(--surface-elevated)] ${className}`}
    >
      <div className="flex items-center gap-4">
        {selectionEnabled && (
          <label className={`flex-shrink-0 ${outOfStock ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={!outOfStock && Boolean(isSelected)}
              disabled={outOfStock}
              aria-label={`Select ${item.name}`}
              onChange={() => onToggleSelect(item.id)}
              className="sr-only"
            />
            <div
              className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                isSelected
                  ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-[var(--text-dark)]'
                  : 'border-[var(--border)] bg-[var(--bg-primary)] text-transparent'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </div>
          </label>
        )}

        <div className="w-20 h-20 rounded-lg bg-[var(--bg-primary)] border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
          {item.customization ? <CustomBuildThumbnail item={item} /> : item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.src = '/assets/placeholder.jpg'
              }}
            />
          ) : (
            <Guitar className="w-8 h-8 text-[var(--gold-primary)]" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[var(--text-light)] truncate">{item.name}</h3>
            {outOfStock && <p className="mt-1 text-xs font-semibold text-red-400">Out of Stock</p>}
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-[var(--text-muted)] tracking-wide uppercase">{item.category || 'Product'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            {showQuantityControls && (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 bg-[var(--bg-primary)] border border-white/10 rounded-full px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    disabled={item.quantity <= 1}
                    className="text-[var(--text-muted)] hover:text-white p-0.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-semibold w-5 text-center text-white">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    disabled={atStockLimit}
                    className="text-[var(--text-muted)] hover:text-[var(--gold-primary)] p-0.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {hasStockValue && (
                  <span className="text-[10px] text-[var(--text-muted)]">Stock: {itemStock}</span>
                )}
              </div>
            )}

            <div className="w-24 text-right">
              <p className="font-bold text-white text-sm tracking-tight">
                ₱{(item.price * item.quantity).toLocaleString('en-PH')}
              </p>
            </div>

            {showRemove && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="p-2 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                aria-label="Remove item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      {item.customization && (
        <details className="mt-3 text-xs text-[var(--text-muted)]">
          <summary className="cursor-pointer text-[var(--gold-primary)]">Review customization and price breakdown</summary>
          <div className="mt-3 space-y-3">
            <div className="h-56"><CustomBuildThumbnail item={item} /></div>
            {item.customization.lineItems?.length ? (
              <BuilderConfigurationPanel lineItems={item.customization.lineItems} configurationTotal={item.price} />
            ) : getCustomBuildSummaryLines(item).map(line => <p key={line}>{line}</p>)}
            <p>Quantity: {item.quantity} · Total: ₱{(item.price * item.quantity).toLocaleString('en-PH')}</p>
          </div>
        </details>
      )}
    </motion.div>
  )
}
