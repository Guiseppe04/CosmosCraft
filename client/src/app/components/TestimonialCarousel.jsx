import { motion } from 'motion/react'
import { Star } from 'lucide-react'

const testimonials = [
  {
    id: 1,
    name: 'Marcus Reed',
    role: 'Professional Guitarist',
    avatar: 'https://i.pravatar.cc/150?img=12',
    rating: 5,
    review:
      'CosmosCraft transformed my vintage Les Paul into a modern masterpiece. The attention to detail is incredible!',
  },
  {
    id: 2,
    name: 'Sarah Mitchell',
    role: 'Studio Musician',
    avatar: 'https://i.pravatar.cc/150?img=5',
    rating: 5,
    review:
      "Best guitar customization service I've ever used. The virtual 2D tool made designing my dream guitar so easy.",
  },
  {
    id: 3,
    name: 'David Chen',
    role: 'Music Teacher',
    avatar: 'https://i.pravatar.cc/150?img=33',
    rating: 5,
    review:
      'Outstanding craftsmanship and customer service. My custom Stratocaster sounds and looks better than I imagined!',
  },
  {
    id: 4,
    name: 'Elena Rodriguez',
    role: 'Band Member',
    avatar: 'https://i.pravatar.cc/150?img=9',
    rating: 5,
    review:
      'The repair service is top-notch. They brought my 1970s acoustic back to life with expert restoration work.',
  },
  {
    id: 5,
    name: 'James Thompson',
    role: 'Session Player',
    avatar: 'https://i.pravatar.cc/150?img=15',
    rating: 5,
    review:
      'Fast turnaround, fair pricing, and exceptional quality. CosmosCraft is now my go-to for all guitar needs.',
  },
  {
    id: 6,
    name: 'Amanda Foster',
    role: 'Concert Performer',
    avatar: 'https://i.pravatar.cc/150?img=20',
    rating: 5,
    review:
      'Professional service from start to finish. The team really understands what musicians need from their instruments.',
  },
  {
    id: 7,
    name: 'Michael Brooks',
    role: 'Guitar Collector',
    avatar: 'https://i.pravatar.cc/150?img=13',
    rating: 5,
    review:
      'I have had several guitars customized here. Each one has been perfect. Highly recommended for serious players!',
  },
  {
    id: 8,
    name: 'Lisa Wang',
    role: 'Recording Artist',
    avatar: 'https://i.pravatar.cc/150?img=29',
    rating: 5,
    review:
      'The customization options are endless and the quality is exceptional. My signature guitar is truly one-of-a-kind.',
  },
]

const duplicatedTestimonials = [...testimonials, ...testimonials]

export function TestimonialCarousel() {
  return (
    <div className="relative overflow-hidden">
      {/* Gradient Overlays */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[var(--black-deep)] to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[var(--black-deep)] to-transparent z-10" />

      {/* Scrolling Container */}
      <div className="group">
        <motion.div
          className="flex gap-6"
          animate={{
            x: [0, -1920],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 40,
              ease: 'linear',
            },
          }}
          style={{
            willChange: 'transform',
          }}
          whileHover={{
            animationPlayState: 'paused',
          }}
        >
          {duplicatedTestimonials.map((testimonial, index) => (
            <div
              key={`${testimonial.id}-${index}`}
              className="flex-shrink-0 w-[400px] bg-gradient-to-br from-[var(--surface-dark)] to-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--gold-primary)] hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all duration-300"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-[var(--gold-primary)] text-[var(--gold-primary)]"
                  />
                ))}
              </div>

              {/* Review Text */}
              <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-6">
                "{testimonial.review}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--surface-elevated)] flex-shrink-0">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-semibold text-[var(--text-light)]">{testimonial.name}</h4>
                  <p className="text-xs text-[var(--text-muted)]">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

