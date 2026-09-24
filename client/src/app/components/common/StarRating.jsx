import React from 'react'
import { Star } from 'lucide-react'

/**
 * Reusable StarRating component with precise partial fill support.
 * Complies with CosmosCraft design system (gold accents & dark mode).
 */
export function StarRating({
  rating = 0,
  maxStars = 5,
  size = 'w-4 h-4',
  showScore = false,
  reviewCount = null,
  showCount = false,
  readOnly = true,
  className = '',
}) {
  const numericRating = Number(rating) || 0

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5" aria-label={`Rating: ${numericRating.toFixed(1)} out of ${maxStars}`}>
        {Array.from({ length: maxStars }).map((_, idx) => {
          const starValue = idx + 1
          const fillPercentage = Math.max(0, Math.min(100, (numericRating - idx) * 100))

          if (fillPercentage >= 100) {
            // Fully filled star
            return (
              <Star
                key={idx}
                className={`${size} fill-[var(--gold-primary)] text-[var(--gold-primary)] flex-shrink-0`}
              />
            )
          } else if (fillPercentage > 0) {
            // Partially filled star with CSS clip-path
            return (
              <div key={idx} className={`relative ${size} flex-shrink-0`}>
                {/* Background empty star */}
                <Star
                  className={`absolute inset-0 ${size} text-zinc-600 fill-zinc-800/60`}
                />
                {/* Foreground clipped gold star */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fillPercentage}%` }}
                >
                  <Star
                    className={`${size} fill-[var(--gold-primary)] text-[var(--gold-primary)]`}
                  />
                </div>
              </div>
            )
          } else {
            // Empty star
            return (
              <Star
                key={idx}
                className={`${size} text-zinc-600 fill-zinc-800/40 flex-shrink-0`}
              />
            )
          }
        })}
      </div>

      {showScore && numericRating > 0 && (
        <span className="text-xs font-bold text-[var(--gold-primary)] tracking-wide">
          {numericRating.toFixed(1)}
        </span>
      )}

      {showCount && reviewCount !== null && (
        <span className="text-xs text-[var(--text-muted)]">
          ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
        </span>
      )}
    </div>
  )
}

export default StarRating
