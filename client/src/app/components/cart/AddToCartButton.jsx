import { Check, ShoppingCart, PackageX } from 'lucide-react'

export function AddToCartButton({ state = 'add', onClick }) {
  const unavailable = state === 'out_of_stock' || state === 'max_limit'
  const added = state === 'item_added'
  const Icon = added ? Check : unavailable ? PackageX : ShoppingCart
  const label = {
    out_of_stock: 'Out of Stock',
    max_limit: 'Stock Limit Reached',
    item_added: 'Added to Cart',
    in_cart: 'Add More',
  }[state] || 'Add to Cart'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={unavailable}
      className={`flex flex-1 min-w-0 items-center justify-center gap-2 px-3 py-3 rounded-full border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-dark)] ${
        unavailable
          ? 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] cursor-not-allowed'
          : added
            ? 'border-green-500/40 bg-green-500/10 text-green-400'
            : 'border-[var(--gold-primary)]/50 bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)] hover:text-[var(--text-dark)]'
      }`}
    >
      <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
      <span aria-live="polite">{label}</span>
    </button>
  )
}
