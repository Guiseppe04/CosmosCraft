import { Outlet, useLocation, useNavigate } from 'react-router'
import { Header } from '../Header.jsx'
import { LegalLinks } from '../LegalLinks.jsx'
import { LoginModal } from '../auth/LoginModal.jsx'
import { CartDrawer } from '../cart/CartDrawer.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useEffect, useLayoutEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { scrollToHomeSection } from '../../utils/sectionNavigation.js'
import { useToast } from '../ui/Toast.jsx'
import { useRef } from 'react'

/**
 * RootLayout Component (fromFigma)
 * Main layout wrapper that applies the global dark background
 */
export function RootLayout() {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isLoggingOut } = useAuth()
  const handledSearchRef = useRef(new Set())
  const isAdminOrStaff = location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff') || location.pathname.startsWith('/staff/')

  useLayoutEffect(() => {
    if (!isAdminOrStaff && !location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [location.pathname, isAdminOrStaff])

  useEffect(() => {
    const sectionId = location.hash.slice(1)
    if (location.pathname !== '/' || !['services', 'about', 'contact'].includes(sectionId)) return
    let cancelled = false
    let timer
    const scheduleCenter = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!cancelled) scrollToHomeSection(sectionId)
      }, reducedMotion ? 0 : 300)
    }
    scheduleCenter()
    const section = document.getElementById(sectionId)
    const target = section?.querySelector('[data-section-focus]') || section
    const observer = target && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleCenter) : null
    if (observer) observer.observe(target)
    // Watch late catalog content during arrival, then leave normal reading/scrolling alone.
    const stopObserving = () => {
      observer?.disconnect()
      clearTimeout(timer)
    }
    const settleTimer = setTimeout(stopObserving, 2000)
    window.addEventListener('wheel', stopObserving, { passive: true, once: true })
    window.addEventListener('touchstart', stopObserving, { passive: true, once: true })
    // Font metrics and responsive layout can change the section height after navigation.
    document.fonts?.ready.then(() => { if (!cancelled) scheduleCenter() })
    window.addEventListener('resize', scheduleCenter)
    window.visualViewport?.addEventListener('resize', scheduleCenter)
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(settleTimer)
      observer?.disconnect()
      window.removeEventListener('wheel', stopObserving)
      window.removeEventListener('touchstart', stopObserving)
      window.removeEventListener('resize', scheduleCenter)
      window.visualViewport?.removeEventListener('resize', scheduleCenter)
    }
  }, [location.pathname, location.hash, location.key, reducedMotion])

  // Show structured OAuth errors passed as query params (auth_error, auth_code)
  useEffect(() => {
    try {
      const search = location.search || ''
      if (!search) return
      // avoid repeating for the same query (handles StrictMode double-render)
      if (handledSearchRef.current.has(search)) return

      const params = new URLSearchParams(search)
      const authError = params.get('auth_error')
      const authCode = params.get('auth_code')
      if (authError || authCode) {
        // Map known codes to friendly messages
        const codeMap = {
          AUTH_CODE_USED: 'Authorization code already used. Please try signing in again.',
          OAUTH_ERROR: authError || 'Authentication failed. Please try again.',
          EMAIL_EXISTS: 'This email is already registered. Try signing in instead.',
        }
        const message = authCode ? (codeMap[authCode] || authError || 'Authentication failed.') : authError
        toast.error(message || 'Authentication failed')
        // mark handled and clear query params to avoid repeated toasts
        handledSearchRef.current.add(search)
        navigate(location.pathname, { replace: true })
      }
    } catch (e) {
      // ignore
    }
  }, [location.search, location.pathname, navigate, toast])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] transition-colors duration-300">
      {!isAdminOrStaff && <Header />}
      <main className={isAdminOrStaff ? 'pt-0' : ''}>
        {isAdminOrStaff ? <Outlet /> : (
          <motion.div
            key={location.pathname}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        )}
      </main>
      {!isAdminOrStaff && location.pathname !== '/' && <footer className="border-t border-[var(--border)] px-4 py-6"><LegalLinks /></footer>}
      <LoginModal />
      <CartDrawer />

      {isLoggingOut && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-8 text-center shadow-2xl">
            <div className="mb-6 flex justify-center">
              <img src="/logo-cosmos.png" alt="CosmosCraft Logo" className="h-16 w-auto object-contain" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">Signing Out</h2>
            <p className="mb-6 text-sm text-[var(--text-muted)]">Completing your logout...</p>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--gold-primary)]" />
          </div>
        </div>
      )}
    </div>
  )
}
