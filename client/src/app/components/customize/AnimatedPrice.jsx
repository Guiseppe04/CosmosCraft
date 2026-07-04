import { useMemo } from 'react'

export function AnimatedPrice({ price, className = '' }) {
  const displayPrice = useMemo(() => price.toLocaleString('en-PH'), [price])

  return (
    <span
      className={`font-bold tracking-tight transition-all duration-300 ${
        price > 0
          ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] via-[#f4d03f] to-[#d4af37]'
          : 'text-white/30'
      } ${className}`}
    >
      ₱{displayPrice}
    </span>
  )
}
