import { Link } from 'react-router'
import {
  ArrowRight,
  Phone,
  Sparkles,
} from 'lucide-react'
import { ImageWithFallback } from '../components/figma/ImageWithFallback.jsx'
import { TestimonialCarousel } from '../components/TestimonialCarousel.jsx'
import { FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon, SocialMediaLink } from '../components/social/SocialMediaIcons.jsx'

const serviceCards = [
  {
    title: 'Setup & Intonation',
    text: 'Precision setup for optimal action, tuning stability, and accurate intonation.',
    image: '/assets/landing/480706588_1131061512149778_5794129601486897065_n.jpg',
  },
  {
    title: 'Refinishing',
    text: 'Professional refinishing services to restore and elevate your instrument look.',
    image: '/assets/landing/499948200_1197883048800957_5172319103702371821_n.jpg',
  },
  {
    title: 'Repair & Restoration',
    text: 'Reliable structural and cosmetic restoration handled by skilled technicians.',
    image: '/assets/landing/615157658_1389213549667905_4695629074825690570_n.jpg',
  },
  {
    title: 'Electronics Upgrades',
    text: 'Pickup, wiring, and hardware electronics upgrades for improved tone and control.',
    image: '/assets/landing/480473076_1131061492149780_4368555505559771502_n.jpg',
  },
]

const footerGroups = [
  {
    title: 'Services',
    links: ['Setup & Intonation', 'Refinishing', 'Repair & Restoration', 'Electronics Upgrades'],
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
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-light)]">
      <section className="pt-16">
        <div className="w-full overflow-hidden">
          <div className="relative min-h-[calc(100vh-4rem)]">
            <ImageWithFallback
              src="/assets/landing/481276950_1131367962119133_3906163079916357258_n.jpg"
              alt="Hero guitar"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[rgba(10,10,10,0.9)] via-[rgba(16,16,16,0.68)] to-[rgba(18,18,18,0.28)]" />
            <div className="absolute inset-0 bg-[rgba(10,10,10,0.28)]" />

            <div className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center px-5 py-10 sm:px-10 lg:px-24">
              <div className="max-w-xl">
                <h1 className="text-4xl font-bold leading-[0.95] !text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.75)] sm:text-6xl md:text-7xl">
                  Turn Your Guitar Ideas into Reality
                </h1>
                <p className="mt-6 max-w-lg text-base leading-relaxed !text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)] sm:text-xl">
                  Customize your dream guitar, and let our platform bring it to life with stunning, quality 2D visualizations.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    to="/customize"
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold-primary)] px-8 py-4 text-sm font-bold uppercase tracking-wide text-[var(--text-dark)] transition-colors hover:bg-[var(--gold-secondary)]"
                  >
                    Start Customize
                  </Link>
                  <Link
                    to="/shop"
                    className="inline-flex items-center rounded-xl border border-white/35 bg-[rgba(30,30,30,0.28)] px-8 py-4 text-sm font-bold uppercase tracking-wide !text-white transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
                  >
                    Explore Shop
                  </Link>
                </div>

                <div className="mt-6 flex items-center gap-4">
                  <div className="flex -space-x-2">
                    <ImageWithFallback
                      src="/assets/landing/481274703_1131368092119120_2324710258140716689_n.jpg"
                      alt="Community member"
                      className="h-10 w-10 rounded-full border-2 border-[rgba(18,18,18,0.8)] object-cover"
                    />
                    <ImageWithFallback
                      src="/assets/landing/480473076_1131061492149780_4368555505559771502_n.jpg"
                      alt="Community member"
                      className="h-10 w-10 rounded-full border-2 border-[rgba(18,18,18,0.8)] object-cover"
                    />
                    <ImageWithFallback
                      src="/assets/landing/481447234_1131367952119134_4042649922426111342_n.jpg"
                      alt="Community member"
                      className="h-10 w-10 rounded-full border-2 border-[rgba(18,18,18,0.8)] object-cover"
                    />
                  </div>
                  <p className="text-sm !text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.65)]">
                    Join with <span className="font-semibold !text-white">50+ Users</span> and start customizing your guitar now
                  </p>
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

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {serviceCards.map((card) => (
              <article
                key={card.title}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] transition-all duration-200 hover:-translate-y-1 hover:border-white/40"
              >
                <div className="relative h-56 overflow-hidden">
                  <ImageWithFallback
                    src={card.image}
                    alt={card.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgba(28,28,28,0.95)] to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-white sm:text-2xl">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">{card.text}</p>
                  <Link
                    to="/appointments"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--gold-primary)] transition-colors hover:text-[var(--gold-secondary)]"
                  >
                    Learn More
                    <ArrowRight className="h-4 w-4" />
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

              <Link
                to="/appointments"
                className="mt-7 inline-flex items-center justify-center rounded-full bg-[var(--gold-secondary)] px-6 py-3 text-sm font-semibold text-[var(--text-dark)] transition-colors hover:bg-[var(--gold-primary)]"
              >
                More About
              </Link>
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
            <h2 className="text-xl sm:text-2xl font-semibold lg:text-3xl">What Our Customers Say</h2>
            <Sparkles className="h-5 w-5 text-[var(--gold-primary)]" />
          </div>
          <TestimonialCarousel />
        </div>
      </section>

      <footer id="contact" className="scroll-mt-24 bg-[var(--black-deep)] px-3 pb-6 pt-10 sm:px-6 sm:pb-8 sm:pt-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl sm:rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 sm:p-8 lg:p-10">
            <div className="grid gap-6 sm:gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h2 className="text-2xl font-semibold leading-tight sm:text-4xl lg:text-5xl">Get in touch with us</h2>
                <p className="mt-3 sm:mt-4 max-w-md text-xs sm:text-sm leading-relaxed text-[var(--text-muted)] lg:text-base">
                  We're here to help. Whether you have a question about our services, need assistance with your account,
                  or want to provide feedback, our team is ready to assist you.
                </p>
                <p className="mt-5 sm:mt-6 text-xs sm:text-sm text-[var(--text-muted)]">Email:</p>
                <p className="text-lg sm:text-xl font-semibold text-[var(--text-light)]">cosmosguitars@gmail.com</p>
                <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-[var(--text-muted)]">Phone:</p>
                <p className="text-xl sm:text-2xl font-semibold text-[var(--text-light)]">+095213121581</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Available Monday to Friday, 9 AM - 6 PM GMT</p>
              </div>

              <form className="rounded-2xl sm:rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 sm:p-6">
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    First Name
                    <input
                      type="text"
                      placeholder="Enter your first name..."
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
                    />
                  </label>
                  <label className="text-xs font-medium text-[var(--text-muted)]">
                    Last Name
                    <input
                      type="text"
                      placeholder="Enter your last name..."
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
                    />
                  </label>
                </div>

                <label className="mt-4 block text-xs font-medium text-[var(--text-muted)]">
                  Email
                  <input
                    type="email"
                    placeholder="Enter your email address..."
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
                  />
                </label>

                <label className="mt-4 block text-xs font-medium text-[var(--text-muted)]">
                  How can we help you?
                  <textarea
                    rows="6"
                    placeholder="Enter your message..."
                    className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
                  />
                </label>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-light)] transition-colors hover:bg-[var(--surface-dark)]"
                  >
                    Send Message
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="mt-8 sm:mt-12 grid grid-cols-1 gap-6 sm:gap-8 border-b border-[var(--border)] pb-6 sm:pb-8 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <h3 className="text-2xl sm:text-3xl font-semibold text-[var(--text-light)]">CosmosCraft</h3>
              <p className="mt-2 sm:mt-3 max-w-sm text-xs sm:text-base text-[var(--text-muted)]">
                Start by customizing your dream guitar or booking a repair and setup service.
              </p>
              <p className="mt-2 sm:mt-3 inline-flex items-center gap-2 text-xs sm:text-sm text-[var(--text-muted)]">
                <Phone className="h-4 w-4 text-[var(--gold-primary)]" />
                cosmosguitars@gmail.com
              </p>
            </div>

            {footerGroups.map((group) => (
              <div key={group.title}>
                <h4 className="text-xs sm:text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-light)]">{group.title}</h4>
                {group.title === 'Social Media' ? (
                  <div className="mt-2 sm:mt-3 flex gap-2 flex-wrap">
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

          <div className="py-6 text-center text-xs text-[var(--text-muted)]">? 2026 CosmosCraft. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}



