import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  CheckCircle2,
  Phone,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { ImageWithFallback } from '../components/figma/ImageWithFallback.jsx'
import { TestimonialCarousel } from '../components/TestimonialCarousel.jsx'
import { FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon, SocialMediaLink } from '../components/social/SocialMediaIcons.jsx'
import { API } from '../utils/apiConfig'
import { formatContactPhone } from '../utils/contactDisplay'
import { useSiteContact } from '../hooks/useSiteContact'

const LANDING_SERVICES_STORAGE_KEY = 'cosmoscraft.landing.services'

const defaultServiceCards = [
  {
    title: 'Setup & Intonation',
    text: 'Precision setup for optimal action, tuning stability, and accurate intonation.',
    image: '/assets/landing/480706588_1131061512149778_5794129601486897065_n.jpg',
    href: '/appointments?step=1&service=setup%20and%20intonation&serviceName=Setup%20%26%20Intonation',
  },
  {
    title: 'Refinishing',
    text: 'Professional refinishing services to restore and elevate your instrument look.',
    image: '/assets/landing/499948200_1197883048800957_5172319103702371821_n.jpg',
    href: '/appointments?step=1&service=refinishing&serviceName=Refinishing',
  },
  {
    title: 'Repair & Restoration',
    text: 'Reliable structural and cosmetic restoration handled by skilled technicians.',
    image: '/assets/landing/615157658_1389213549667905_4695629074825690570_n.jpg',
    href: '/appointments?step=1&service=repair%20and%20restoration&serviceName=Repair%20%26%20Restoration',
  },
  {
    title: 'Electronics Upgrades',
    text: 'Pickup, wiring, and hardware electronics upgrades for improved tone and control.',
    image: '/assets/landing/480473076_1131061492149780_4368555505559771502_n.jpg',
    href: '/appointments?step=1&service=electronics%20upgrades&serviceName=Electronics%20Upgrades',
  },
]

const readLandingServiceCards = () => {
  if (typeof window === 'undefined') return defaultServiceCards

  try {
    const raw = window.localStorage.getItem(LANDING_SERVICES_STORAGE_KEY)
    if (!raw) return defaultServiceCards

    const stored = JSON.parse(raw)
    if (!Array.isArray(stored)) return defaultServiceCards

    const normalized = stored
      .filter((item) => item && item.enabled !== false)
      .map((item, index) => {
        const title = item.title || defaultServiceCards[index % defaultServiceCards.length]?.title || 'Service'
        const text = item.text || item.description || 'Premium service tailored for your instrument.'
        const image = item.image || item.image_url || defaultServiceCards[index % defaultServiceCards.length]?.image || ''
        const href = item.href || defaultServiceCards[index % defaultServiceCards.length]?.href || '/appointments'

        return {
          serviceId: item.serviceId ?? item.id ?? null,
          title,
          text,
          image,
          href,
          order: Number(item.order ?? index + 1),
        }
      })
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))

    return normalized
  } catch {
    return defaultServiceCards
  }
}

const loadLandingServiceCards = async () => {
  const localCards = readLandingServiceCards()
  const localCardByTitle = new Map(localCards.map((card) => [card.title.toLowerCase(), card]))

  try {
    const response = await fetch(`${API}/api/services?is_active=true&limit=100&sort=name&order=asc`)
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'Failed to load services')

    return (Array.isArray(result.data) ? result.data : [])
      .filter((service) => service?.is_active !== false)
      .map((service, index) => {
        const localCard = localCardByTitle.get(String(service.name || '').toLowerCase())
        const slug = String(service.name || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
        return {
          serviceId: service.service_id,
          title: service.name || localCard?.title || 'Service',
          text: localCard?.text || service.description || 'Premium service tailored for your instrument.',
          image: service.image_url || localCard?.image || defaultServiceCards[index % defaultServiceCards.length]?.image || '',
          href: localCard?.href || `/appointments?step=1&service=${encodeURIComponent(slug)}&serviceName=${encodeURIComponent(service.name || 'Service')}`,
          order: localCard?.order ?? index + 1,
        }
      })
      .sort((a, b) => a.order - b.order)
  } catch {
    return localCards
  }
}

const footerGroups = [
  {
    title: 'Services',
    links: [],
  },
  {
    title: 'Social Media',
    links: [
      { label: 'Facebook', url: 'https://www.facebook.com/CosmosGuitars' },
      { label: 'Instagram', url: 'https://www.instagram.com/CosmosGuitars' },
      { label: 'Tiktok', url: 'https://www.tiktok.com/@CosmosGuitars' },
      { label: 'Youtube', url: 'https://www.youtube.com/@CosmosGuitars' },
    ],
  },
]

export function LandingPage() {
  const { isAuthenticated, user } = useAuth()
  const contactInfo = useSiteContact()
  const [serviceCards, setServiceCards] = useState(() => readLandingServiceCards())
  const footerGroupsForPage = footerGroups.map((group) => group.title === 'Services'
    ? { ...group, links: serviceCards.map(({ title, href }) => ({ label: title, href })) }
    : group)
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    message: '',
  })
  const servicesScrollRef = useRef(null)
  const [isSendingContact, setIsSendingContact] = useState(false)
  const [contactSubmissionMessage, setContactSubmissionMessage] = useState('')
  const [contactSubmissionError, setContactSubmissionError] = useState(false)
  const [showContactSuccess, setShowContactSuccess] = useState(false)
  const contactModalCloseRef = useRef(null)

  const submitContactForm = async (event) => {
    event.preventDefault()
    setIsSendingContact(true)
    setContactSubmissionMessage('')
    setContactSubmissionError(false)

    try {
      const response = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not send your message')
      setShowContactSuccess(true)
      setContactForm((previous) => ({ ...previous, message: '' }))
    } catch (error) {
      setContactSubmissionError(true)
      setContactSubmissionMessage(error.message || 'We could not send your message right now. Please try again later.')
    } finally {
      setIsSendingContact(false)
    }
  }

  useEffect(() => {
    if (!showContactSuccess) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setShowContactSuccess(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    contactModalCloseRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showContactSuccess])

  useEffect(() => {
    if (window.location.hash !== '#contact') return

    requestAnimationFrame(() => {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setContactForm((prev) => ({
        ...prev,
        firstName: '',
        lastName: '',
        email: '',
      }))
      return
    }

    const firstName = user.name?.firstName || user.firstName || user.first_name || ''
    const lastName = user.name?.lastName || user.lastName || user.last_name || ''
    const email = user.email || user.primary_email || ''

    setContactForm((prev) => ({
      ...prev,
      firstName,
      lastName,
      email,
    }))
  }, [isAuthenticated, user])

  useEffect(() => {
    const el = servicesScrollRef.current
    if (!el) return

    const mq = window.matchMedia('(max-width: 767px)')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduceMotion.matches) return

    const SPEED = 30
    const RESUME_DELAY = 2000

    let rafId = null
    let resumeTimer = null
    let paused = false
    let touching = false
    let hoverActive = false
    let direction = 1
    let lastTime = null
    let pos = Math.max(0, el.scrollWidth - el.clientWidth)

    const disableSnap = () => { el.style.scrollSnapType = 'none' }
    const enableSnap = () => { el.style.scrollSnapType = '' }
    disableSnap()

    const resume = () => {
      if (touching || hoverActive) return
      pos = el.scrollLeft
      lastTime = null
      paused = false
      disableSnap()
    }

    const pauseForUser = (event) => {
      const target = event?.target
      if (target && target !== el && !el.contains(target)) {
        return
      }

      paused = true
      enableSnap()
      clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => {
        if (!touching && !hoverActive) {
          resume()
        }
      }, RESUME_DELAY)
    }

    const onTouchStart = (event) => {
      if (event?.target && event.target !== el && !el.contains(event.target)) {
        return
      }
      touching = true
      pauseForUser(event)
    }
    const onTouchEnd = (event) => {
      if (event?.target && event.target !== el && !el.contains(event.target)) {
        return
      }
      touching = false
      pauseForUser(event)
    }
    const onPointerEnter = () => {
      hoverActive = true
      pauseForUser()
    }
    const onPointerLeave = () => {
      hoverActive = false
      pauseForUser()
    }

    const step = (time) => {
      if (lastTime === null) lastTime = time
      const dt = time - lastTime
      lastTime = time

      if (!paused && mq.matches && dt < 100) {
        const max = el.scrollWidth - el.clientWidth
        if (max > 0) {
          pos += direction * SPEED * (dt / 1000)

          if (pos >= max) {
            pos = max
            direction = -1
          } else if (pos <= 0) {
            pos = 0
            direction = 1
          }

          el.scrollLeft = pos
        }
      }
      rafId = requestAnimationFrame(step)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    el.addEventListener('wheel', pauseForUser, { passive: true })
    el.addEventListener('mousedown', pauseForUser)
    el.addEventListener('pointerenter', onPointerEnter)
    el.addEventListener('pointerleave', onPointerLeave)
    rafId = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(resumeTimer)
      enableSnap()
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('wheel', pauseForUser)
      el.removeEventListener('mousedown', pauseForUser)
      el.removeEventListener('pointerenter', onPointerEnter)
      el.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [serviceCards])

  useEffect(() => {
    let isMounted = true
    const refreshLandingServices = () => {
      loadLandingServiceCards().then((cards) => {
        if (isMounted) setServiceCards(cards)
      })
    }
    refreshLandingServices()

    const onStorage = (event) => {
      if (event.key === LANDING_SERVICES_STORAGE_KEY) {
        refreshLandingServices()
      }
    }

    const onLandingServicesUpdated = () => {
      refreshLandingServices()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('cosmoscraft-landing-services-updated', onLandingServicesUpdated)

    return () => {
      isMounted = false
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('cosmoscraft-landing-services-updated', onLandingServicesUpdated)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-light)]">
<section className="pt-16">
  <div className="w-full overflow-hidden">
    <div className="relative min-h-[100svh] sm:min-h-[500px] md:min-h-[560px] lg:min-h-[calc(100vh-4rem)]">
      <ImageWithFallback
        src="/assets/landing/481276950_1131367962119133_3906163079916357258_n.jpg"
        alt="Hero guitar"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(10,10,10,0.9)] via-[rgba(16,16,16,0.68)] to-[rgba(18,18,18,0.28)]" />
      <div className="absolute inset-0 bg-[rgba(10,10,10,0.28)]" />

      <div className="relative z-10 flex min-h-[100svh] items-center justify-center px-4 py-8 sm:min-h-[500px] sm:px-8 sm:py-10 md:min-h-[560px] lg:min-h-[calc(100vh-4rem)] lg:justify-start lg:px-24 lg:py-10">
        <div className="max-w-[22rem] text-center sm:max-w-[30rem] md:max-w-[34rem] lg:max-w-[42rem] lg:text-left">
          <h1 className="text-[2.8rem] font-bold leading-[0.9] tracking-[-0.05em] !text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.75)] sm:text-[4rem] md:text-[4.8rem] lg:text-[6.2rem]">
            Turn Your Guitar Ideas into Reality
          </h1>
          <p className="mx-auto mt-4 max-w-[18rem] text-sm leading-relaxed !text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)] sm:mt-5 sm:max-w-[25rem] sm:text-base md:max-w-[29rem] lg:mx-0 lg:max-w-[34rem] lg:text-xl">
            Customize your dream guitar, and let our platform bring it to life with stunning, quality 2D visualizations.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3 sm:mt-7 lg:justify-start">
            <Link
              to="/customize"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold-primary)] px-6 py-3 text-[0.7rem] font-bold uppercase tracking-wide text-[var(--text-dark)] transition-colors hover:bg-[var(--gold-secondary)] sm:px-8 sm:py-4 sm:text-sm"
            >
              Start Customize
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center rounded-xl border border-white/35 bg-[rgba(30,30,30,0.28)] px-6 py-3 text-[0.7rem] font-bold uppercase tracking-wide !text-white transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] sm:px-8 sm:py-4 sm:text-sm"
            >
              Explore Shop
            </Link>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
      <section id="services" className="scroll-mt-24 bg-[var(--black-deep)] px-3 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold uppercase tracking-wide text-white sm:text-5xl">Our Services</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--text-muted)] sm:text-lg">
              Comprehensive guitar services from maintenance to complete custom builds
            </p>
          </div>

<div ref={servicesScrollRef} className="services-scroll scrollbar-hide mt-8 flex gap-3 overflow-x-auto pb-2 sm:mt-10 sm:gap-4 md:grid md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-4 lg:gap-5">
  {serviceCards.map((card) => (
    <article
      key={card.title}
      className="min-w-[220px] flex-none overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] transition-all duration-200 hover:-translate-y-1 hover:border-white/40 sm:min-w-[240px] sm:rounded-2xl md:min-w-0 md:flex-none lg:min-w-0"
    >
      <div className="relative h-24 overflow-hidden sm:h-28 md:h-32 lg:h-56">
        <ImageWithFallback
          src={card.image}
          alt={card.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[rgba(28,28,28,0.95)] to-transparent sm:h-14 lg:h-16" />
      </div>
      <div className="p-3 sm:p-4 lg:p-6">
        <h3 className="text-xs font-semibold text-white sm:text-sm md:text-base lg:text-xl xl:text-2xl">
          {card.title}
        </h3>
        <p className="mt-1.5 line-clamp-3 text-[10px] leading-relaxed text-[var(--text-muted)] sm:mt-2 sm:text-[11px] md:text-xs lg:mt-3 lg:text-sm xl:text-base">
          {card.text}
        </p>
        <Link
          to={card.href}
          className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[var(--gold-primary)] transition-colors hover:text-[var(--gold-secondary)] sm:mt-4 sm:gap-2 sm:text-[10px] lg:text-sm"
        >
          Learn More
          <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
        </Link>
      </div>
    </article>
  ))}
</div>
        </div>
      </section>
      <section id="about" className="scroll-mt-24 px-3 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl sm:rounded-[34px] border border-[var(--border)] bg-[var(--surface-dark)] p-4 sm:p-8 lg:p-12">
          <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
            <div>
              <h2 className="text-2xl sm:text-4xl font-semibold text-[var(--text-light)] lg:text-5xl">About Us</h2>
              <p className="mt-3 sm:mt-5 max-w-2xl text-xs sm:text-base leading-relaxed text-[var(--text-muted)]">
                At CosmosCraft, we believe every instrument journey should feel personal and memorable. Whether you're
                seeking custom builds, restoration, or reliable setup work, we design every step around what matters to you.
              </p>
              <p className="mt-3 sm:mt-4 max-w-2xl text-xs sm:text-base leading-relaxed text-[var(--text-muted)]">
                With expert planning, trusted craftsmanship, and a passion for quality tone, we make guitar services
                effortless, inspiring, and dependable.
              </p>

              <a
                href="https://www.facebook.com/CosmosGuitars"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center justify-center rounded-full bg-[var(--gold-secondary)] px-6 py-3 text-sm font-semibold text-[var(--text-dark)] transition-colors hover:bg-[var(--gold-primary)]"
              >
                More About
              </a>
            </div>

            <div className="relative mx-auto w-full max-w-[420px] h-auto">
              <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl">
                <ImageWithFallback
                  src="/assets/landing/481447234_1131367952119134_4042649922426111342_n.jpg"
                  alt="About visual primary"
                  className="h-[200px] sm:h-[260px] md:h-[320px] w-full object-cover"
                />
              </article>

              <article className="hidden sm:block absolute -bottom-8 -right-4 w-[58%] rotate-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl sm:-right-8">
                <ImageWithFallback
                  src="/assets/landing/480692297_1131061212149808_7300796434822753967_n.jpg"
                  alt="About visual secondary"
                  className="h-[160px] w-full object-cover sm:h-[190px]"
                />
              </article>
            </div>
          </div>

          <div className="mt-10 sm:mt-16 border-t border-dashed border-[var(--border)] pt-6 sm:pt-7"></div>
        </div>
      </section>

      <section className="px-3 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl sm:rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 sm:p-8">
          <div className="mb-4 sm:mb-5 flex items-center justify-between gap-2 sm:gap-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-light)] lg:text-3xl">What Our Customers Say</h2>
            <Sparkles className="h-5 w-5 text-[var(--gold-primary)]" />
          </div>
          <TestimonialCarousel />
        </div>
      </section>

      <footer id="contact" className="scroll-mt-24 bg-[var(--black-deep)] px-3 pb-4 pt-8 sm:px-6 sm:pb-8 sm:pt-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl sm:rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 sm:p-8 lg:p-10">
            <div className="grid gap-6 sm:gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="flex flex-col justify-center text-left sm:text-left md:text-left lg:text-left">
                <h2 className="text-2xl font-semibold leading-tight text-[var(--text-light)] text-center sm:text-left sm:text-4xl lg:text-5xl">Get in touch with us</h2>
                <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-[var(--text-muted)] text-center sm:mx-0 sm:mt-4 sm:text-sm lg:text-base sm:text-left">
                  We're here to help. Whether you have a question about our services, need assistance with your account,
                  or want to provide feedback, our team is ready to assist you.
                </p>
                <div className="mt-5 text-center sm:mt-6 sm:text-left">
                  <p className="text-xs sm:text-sm text-[var(--text-muted)]">Email:</p>
                  <p className="text-lg sm:text-xl font-semibold text-[var(--text-light)] break-words">{contactInfo.email}</p>
                </div>
                <div className="mt-3 text-center sm:mt-4 sm:text-left">
                  <p className="text-xs sm:text-sm text-[var(--text-muted)]">Phone:</p>
                  <p className="text-xl sm:text-2xl font-semibold text-[var(--text-light)]">{formatContactPhone(contactInfo.phone)}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)] text-center sm:text-left">Available Monday to Friday, 9 AM - 6 PM GMT</p>
              </div>

              <form onSubmit={submitContactForm} className="rounded-2xl sm:rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 sm:p-6">
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    First Name
                    <input
                      type="text"
                      value={contactForm.firstName}
                                            required
                                            maxLength={100}
                      onChange={(event) => setContactForm((prev) => ({ ...prev, firstName: event.target.value }))}
                      placeholder="Enter your first name..."
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
                    />
                  </label>
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    Last Name
                    <input
                      type="text"
                      value={contactForm.lastName}
                                            required
                                            maxLength={100}
                      onChange={(event) => setContactForm((prev) => ({ ...prev, lastName: event.target.value }))}
                      placeholder="Enter your last name..."
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
                    />
                  </label>
                </div>

                <label className="mt-4 block text-xs font-medium text-[var(--text-muted)]">
                  Email
                  <input
                    type="email"
                    value={contactForm.email}
                                        required
                                        maxLength={254}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="Enter your email address..."
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
                  />
                </label>

                <label className="mt-4 block text-xs font-medium text-[var(--text-muted)]">
                  How can we help you?
                  <textarea
                    rows="6"
                    value={contactForm.message}
                                        required
                                        maxLength={5000}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, message: event.target.value }))}
                    placeholder="Enter your message..."
                    className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
                  />
                </label>

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSendingContact}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--gold-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-dark)] transition-colors hover:bg-[var(--gold-secondary)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSendingContact ? 'Sending...' : 'Send Message'}
                    {!isSendingContact && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
                {contactSubmissionError && contactSubmissionMessage && (
                  <p role="alert" aria-live="assertive" className="mt-3 text-sm text-red-600">
                    {contactSubmissionMessage}
                  </p>
                )}
              </form>
            </div>
          </div>

<div className="mt-8 sm:mt-12 grid grid-cols-1 gap-6 sm:gap-8 border-b border-[var(--border)] pb-6 sm:pb-8 sm:grid-cols-2 lg:grid-cols-5">
  <div className="text-center sm:text-left lg:col-span-2">
    <h3 className="text-2xl sm:text-3xl font-semibold text-[var(--text-light)]">CosmosCraft</h3>
    <p className="mx-auto mt-2 sm:mx-0 sm:mt-3 max-w-sm text-xs sm:text-base text-[var(--text-muted)]">
      Start by customizing your dream guitar or booking a repair and setup service.
    </p>
    <p className="mt-2 sm:mt-3 flex items-center justify-center gap-2 text-xs sm:justify-start sm:text-sm text-[var(--text-muted)]">
      <Phone className="h-4 w-4 text-[var(--gold-primary)]" />
      {contactInfo.email}
    </p>
  </div>

  {footerGroupsForPage.map((group) => (
    <div key={group.title} className="text-center sm:text-left">
      <h4 className="text-xs sm:text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-light)]">{group.title}</h4>
      {group.title === 'Social Media' ? (
        <div className="mt-2 sm:mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <SocialMediaLink icon={FacebookIcon} label="Facebook" url="https://www.facebook.com/CosmosGuitars" />
          <SocialMediaLink icon={InstagramIcon} label="Instagram" url="https://www.instagram.com/CosmosGuitars" />
          <SocialMediaLink icon={TikTokIcon} label="TikTok" url="https://www.tiktok.com/@CosmosGuitars" />
          <SocialMediaLink icon={YouTubeIcon} label="YouTube" url="https://www.youtube.com/@CosmosGuitars" />
        </div>
                ) : (
                  <ul className="mt-2 sm:mt-3 space-y-1 sm:space-y-2 text-xs sm:text-sm text-[var(--text-muted)]">
                    {group.links.map((item) => {
                      const label = typeof item === 'string' ? item : item.label;
                      const url = typeof item === 'object' ? item.url : null;
                      const href = typeof item === 'object' ? item.href : null;

                      if (href) {
                        return (
                          <li key={label}>
                            <Link to={href} className="hover:text-[var(--gold-primary)] transition-colors">
                              {label}
                            </Link>
                          </li>
                        );
                      }

                      if (url) {
                        return (
                          <li key={label}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--gold-primary)] transition-colors">
                              {label}
                            </a>
                          </li>
                        );
                      }
                      return <li key={label}>{label}</li>;
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="py-6 text-center text-xs text-[var(--text-muted)]">2026 CosmosCraft. All rights reserved.</div>
        </div>
      </footer>
          {showContactSuccess && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              onClick={(event) => {
                if (event.target === event.currentTarget) setShowContactSuccess(false)
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="contact-success-title"
                aria-describedby="contact-success-description"
                className="relative w-full max-w-md rounded-2xl border border-[var(--gold-primary)] bg-[var(--surface-dark)] p-7 text-center shadow-2xl sm:p-8"
              >
                <button
                  ref={contactModalCloseRef}
                  type="button"
                  onClick={() => setShowContactSuccess(false)}
                  aria-label="Close confirmation"
                  className="absolute right-4 top-4 rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold-primary)]/15">
                  <CheckCircle2 className="h-9 w-9 text-[var(--gold-primary)]" />
                </div>
                <h3 id="contact-success-title" className="text-2xl font-bold text-white">Message sent</h3>
                <p id="contact-success-description" className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
                  Your message has been sent. Thanks for reaching out to CosmosCraft. We’ll get back to you soon.
                </p>
                <button
                  type="button"
                  onClick={() => setShowContactSuccess(false)}
                  className="mt-7 w-full rounded-xl bg-[var(--gold-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-dark)] transition-colors hover:bg-[var(--gold-secondary)]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
    </div>
  )
}

