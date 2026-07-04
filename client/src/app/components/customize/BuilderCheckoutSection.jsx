import { ShoppingCart } from 'lucide-react'
import { AnimatedPrice } from './AnimatedPrice.jsx'

export function BuilderCheckoutSection({ price, basePrice, onAddToCart }) {
  return (
    <div className="border-t border-white/10 p-5 flex-shrink-0 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Your Build Total</p>
        <AnimatedPrice price={price} className="text-3xl sm:text-4xl" />
        <p className="mt-1 text-xs text-white/30">
          Base price: ₱{(basePrice ?? 0).toLocaleString('en-PH')}
        </p>
      </div>

      <button
        type="button"
        onClick={onAddToCart}
        className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f4d03f] to-[#d4af37] px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-[#d4af37]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#d4af37]/40 hover:scale-[1.02] active:scale-[0.98]"
      >
        <ShoppingCart className="h-4 w-4" />
        Add to Cart
      </button>
    </div>
  )
}
