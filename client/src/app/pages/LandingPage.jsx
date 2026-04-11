import { Link } from 'react-router'
import { motion } from 'motion/react'
import {
  Sparkles,
  Calendar,
  Package,
  ArrowRight,
  Wrench,
  Music,
  MapPin,
  Zap,
  Settings,
  ShoppingCart,
  Shield,
  TrendingUp,
  Users,
  Bell,
  CreditCard,
  BarChart3,
  Palette,
} from 'lucide-react'
import { ImageWithFallback } from '../components/figma/ImageWithFallback.jsx'
import { TestimonialCarousel } from '../components/TestimonialCarousel.jsx'

export function LandingPage() {
  const features = [
    {
      icon: Wrench,
      title: 'GRAND OPENING',
      description: 'Celebrating the launch of our premium guitar restoration services',
    },
    {
      icon: MapPin,
      title: 'MULTIPLE BRANCHES',
      description: 'Convenient locations across Nashville for all your guitar needs',
    },
    {
      icon: Zap,
      title: 'INSTANT TURNAROUND',
      description: 'Fast, professional service without compromising quality',
    },
  ]

  const platformCapabilities = [
    {
      icon: Palette,
      title: 'Virtual 2D Guitar Customization',
      description: 'Interactive design tool with real-time preview and pricing calculator',
    },
    {
      icon: ShoppingCart,
      title: 'Online Guitar & Accessories Shopping',
      description: 'Browse our premium catalog with advanced filters and search',
    },
    {
      icon: Calendar,
      title: 'Appointment Scheduling',
      description: 'Book repair and service appointments with calendar integration',
    },
    {
      icon: Package,
      title: 'Order Tracking & Delivery',
      description: 'Real-time order status updates and delivery management',
    },
    {
      icon: Shield,
      title: 'Secure User Accounts',
      description: 'Protected authentication with OTP verification system',
    },
    {
      icon: CreditCard,
      title: 'Shopping Cart & Payments',
      description: 'Secure checkout with multiple payment options',
    },
    {
      icon: BarChart3,
      title: 'Admin Dashboard',
      description: 'Comprehensive business monitoring and analytics platform',
    },
    {
      icon: Users,
      title: 'Customer & Staff Management',
      description: 'Complete inventory, customer, and employee management',
    },
    {
      icon: TrendingUp,
      title: 'Reports & Analytics',
      description: 'Data-driven insights for informed decision-making',
    },
    {
      icon: Bell,
      title: 'Notifications & Security',
      description: 'Real-time feedback system with enterprise-grade security',
    },
  ]

  const services = [
    {
      title: 'ADVANCED MAINTENANCE',
      description:
        'Complete guitar care including setups, cleaning, and preventative maintenance to keep your instrument in peak condition.',
      image:
        '/assets/landing/615157658_1389213549667905_4695629074825690570_n.jpg',
      link: '/appointments',
    },
    {
      title: 'PROVEN MASTERING',
      description:
        "Expert restoration and refinishing services that bring vintage instruments back to their original glory with master craftsmanship.",
      image:
        '/assets/landing/481006070_1131367368785859_5010367721067878408_n.jpg',
      link: '/appointments',
    },
    {
      title: 'TOTAL ACCURACY',
      description:
        'Precision electronics upgrades and modifications designed for optimal tone and performance customization.',
      image:
        '/assets/landing/480692297_1131061212149808_7300796434822753967_n.jpg',
      link: '/customize',
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center px-4 sm:px-6 lg:px-8 overflow-hidden pt-16">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <ImageWithFallback
            src="/assets/landing/481276950_1131367962119133_3906163079916357258_n.jpg"
            alt="Guitar Workshop"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/80 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block px-4 py-2 bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 rounded-lg text-[var(--gold-primary)] text-sm font-semibold mb-6 uppercase">
                Premium Restoration
              </span>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                <span className="text-white">MASTERFUL</span>
                <br />
                <span className="bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] bg-clip-text text-transparent">
                  ENGINEERING
                </span>
              </h1>

              <p className="text-lg text-[var(--text-muted)] mb-8 max-w-xl leading-relaxed">
                Experience the perfect blend of timeless craftsmanship and cutting-edge technology. We breathe
                new life into every guitar, restoring it to new heights with state-of-the-art tools and
                meticulous care.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/customize"
                  className="group px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  GET STARTED
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
                <Link
                  to="/shop"
                  className="px-8 py-4 border-2 border-[var(--border)] text-white rounded-xl font-semibold hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all duration-200 flex items-center justify-center"
                >
                  VIEW CATALOG
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Visualize in 2D Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-dark)]">
                <ImageWithFallback
                  src="/assets/landing/481447234_1131367952119134_4042649922426111342_n.jpg"
                  alt="Guitar Customization Tool"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <span className="inline-block px-4 py-2 bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 rounded-lg text-[var(--gold-primary)] text-sm font-semibold mb-4 uppercase">
                Interactive Tool
              </span>

              <h2 className="text-4xl font-bold mb-6">
                <span className="text-white">DESIGN YOUR DREAM</span>
                <br />
                <span className="bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] bg-clip-text text-transparent">
                  GUITAR IN 2D
                </span>
              </h2>

              <p className="text-[var(--text-muted)] mb-6 leading-relaxed">
                Experience our powerful Virtual 2D Guitar Customization tool. Design your perfect instrument
                with real-time visual preview and instant pricing. Choose from countless finishes, hardware
                options, and configurations to create something truly unique.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[var(--gold-primary)]/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-[var(--gold-primary)]" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">REAL-TIME PREVIEW</h4>
                    <p className="text-sm text-[var(--text-muted)]">See your guitar customization updates instantly</p>
                  </div>
                </div>
              </div>

              <Link
                to="/customize"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200"
              >
                START CUSTOMIZING
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Bar */}
      <section className="py-8 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-[var(--text-dark)]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-[var(--text-dark)]" />
                </div>
                <div>
                  <h3 className="text-[var(--text-dark)] font-bold text-sm uppercase mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-[var(--text-dark)]/80 text-xs">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-white mb-4">OUR SERVICES</h2>
            <p className="text-[var(--text-muted)] max-w-2xl mx-auto">
              Comprehensive guitar services from maintenance to complete custom builds
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--gold-primary)] hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] transition-all duration-300"
              >
                <div className="aspect-video overflow-hidden relative">
                  <ImageWithFallback
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-dark)] via-transparent to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-3">{service.title}</h3>
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-4">
                    {service.description}
                  </p>
                  <Link
                    to={service.link}
                    className="inline-flex items-center gap-2 text-[var(--gold-primary)] hover:gap-3 transition-all duration-200"
                  >
                    <span className="font-semibold text-sm uppercase">Learn More</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Capabilities Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-[var(--surface-dark)]/30 to-transparent">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-2 bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 rounded-lg text-[var(--gold-primary)] text-sm font-semibold mb-4 uppercase">
              Complete Platform
            </span>
            <h2 className="text-4xl font-bold text-white mb-4">PLATFORM CAPABILITIES</h2>
            <p className="text-[var(--text-muted)] max-w-2xl mx-auto">
              Everything you need for a complete guitar customization and service experience
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {platformCapabilities.map((capability, index) => (
              <motion.div
                key={capability.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="group relative bg-gradient-to-br from-[var(--surface-dark)] to-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--gold-primary)] hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all duration-300"
              >
                <div className="mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[var(--gold-primary)]/20 to-[var(--gold-secondary)]/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <capability.icon className="w-6 h-6 text-[var(--gold-primary)]" />
                  </div>
                </div>
                <h3 className="text-white font-bold text-sm mb-2 leading-tight">{capability.title}</h3>
                <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                  {capability.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-[var(--surface-dark)]/30 to-transparent">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-2 bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30 rounded-lg text-[var(--gold-primary)] text-sm font-semibold mb-4 uppercase">
              Customer Testimonials
            </span>
            <h2 className="text-4xl font-bold text-white mb-4">WHAT OUR PARTNERS SAY</h2>
          </motion.div>

          <TestimonialCarousel />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative bg-gradient-to-br from-[var(--surface-dark)] to-[var(--surface-elevated)] border border-[var(--gold-primary)]/30 rounded-2xl p-12 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold-primary)]/5 to-[var(--gold-secondary)]/5" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
                READY TO EXPERIENCE THE BEST?
              </h2>
              <p className="text-lg text-[var(--text-muted)] mb-8 max-w-2xl mx-auto">
                Schedule an appointment today and discover what premium guitar craftsmanship truly means
              </p>
              <Link
                to="/appointments"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-200"
              >
                SCHEDULE APPOINTMENT
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
