import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Guitar } from 'lucide-react'
import { feedbackService } from '../services/feedbackService'
import { StarRating } from './common/StarRating.jsx'

const CARD_WIDTH = 340 // px (mobile card width)
const CARD_GAP = 24 // px (mr-6)
const MIN_SET_WIDTH = 2600 // px - one set must be wider than any screen
const SPEED = 50 // px per second

export function TestimonialCarousel() {
  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadTestimonials() {
      try {
        setLoading(true)
        const response = await feedbackService.getPublicTestimonials(12)
        const items = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : []

        // Only guitar customization feedback
        const customizationOnly = items.filter(
          (item) => item.feedback_type === 'customization' || !item.feedback_type
        )

        if (isMounted) setTestimonials(customizationOnly)
      } catch (err) {
        console.error('Failed to fetch public customization testimonials:', err)
        if (isMounted) setTestimonials([])
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadTestimonials()
    return () => {
      isMounted = false
    }
  }, [])

  // Repeat real items until one "set" is wide enough to fill the screen,
  // then render that set twice so translateX(-50%) loops seamlessly.
  const { singleSet, animationDuration } = useMemo(() => {
    if (testimonials.length === 0) return { singleSet: [], animationDuration: 0 }

    const cardFullWidth = CARD_WIDTH + CARD_GAP
    const copies = Math.max(1, Math.ceil(MIN_SET_WIDTH / (testimonials.length * cardFullWidth)))
    const set = Array.from({ length: copies }, () => testimonials).flat()

    return {
      singleSet: set,
      animationDuration: Math.max(20, (set.length * cardFullWidth) / SPEED),
    }
  }, [testimonials])

  if (loading) {
    return (
      <div className="relative overflow-hidden py-4">
        <div className="flex gap-6 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="flex-shrink-0 w-[340px] sm:w-[400px] h-[220px] bg-[var(--surface-elevated)]/40 border border-white/5 rounded-2xl p-6 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-4 w-28 bg-white/10 rounded" />
                <div className="h-3 w-full bg-white/10 rounded" />
                <div className="h-3 w-4/5 bg-white/10 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 bg-white/10 rounded" />
                  <div className="h-2.5 w-16 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // No real testimonials -> render nothing
  if (singleSet.length === 0) return null

  const renderCard = (item, index, setKey) => {
    const initial = item.customer_name ? item.customer_name.charAt(0).toUpperCase() : 'C'
    return (
      <div
        key={`${setKey}-${item.id}-${index}`}
        className="flex-shrink-0 mr-6 w-[340px] sm:w-[400px] bg-gradient-to-br from-[var(--surface-dark)] to-[var(--surface-elevated)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)] hover:shadow-[0_0_25px_rgba(212,175,55,0.18)] transition-all duration-300 flex flex-col justify-between select-none cursor-pointer"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <StarRating rating={item.rating || 5} size="w-4 h-4" />
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--gold-primary)] bg-[var(--gold-primary)]/10 px-2.5 py-1 rounded-md border border-[var(--gold-primary)]/20 truncate max-w-[200px]">
              <Guitar className="w-3 h-3 flex-shrink-0 text-[var(--gold-primary)]" />
              <span className="truncate">{item.target_name || 'Custom Guitar Build'}</span>
            </span>
          </div>

          <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-6 italic line-clamp-4">
            "{item.comment}"
          </p>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-white/5">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface-dark)] border border-white/10 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
            {item.user_avatar ? (
              <img
                src={item.user_avatar}
                alt={item.customer_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span className="text-[var(--gold-primary)]">{initial}</span>
            )}
          </div>
          <div className="truncate">
            <h4 className="font-semibold text-white text-sm truncate">
              {item.customer_name || 'Verified Customer'}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[var(--gold-primary)] inline" />
              Customization Client
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden py-2">
      <style>{`
        @keyframes scrollCustomizationMarquee {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
        .customization-carousel-track {
          display: flex;
          width: max-content;
          animation: scrollCustomizationMarquee ${animationDuration}s linear infinite;
          will-change: transform;
        }
        .customization-carousel-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Left/Right Gradient Fades */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-[var(--surface-dark)] to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-[var(--surface-dark)] to-transparent z-10" />

      <div className="overflow-hidden">
        <div className="customization-carousel-track">
          {/* Set A */}
          {singleSet.map((item, i) => renderCard(item, i, 'a'))}
          {/* Set B (duplicate for seamless loop) */}
          {singleSet.map((item, i) => renderCard(item, i, 'b'))}
        </div>
      </div>
    </div>
  )
}

export default TestimonialCarousel