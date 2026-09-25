import { AnimatedPrice } from './AnimatedPrice.jsx'

export function BuilderCheckoutSection({ price }) {
  return (
    <div className="border-t border-[var(--border)] p-5 flex-shrink-0">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Your Build Total</p>
      <AnimatedPrice price={price} className="text-3xl sm:text-4xl" />
    </div>
  )
}