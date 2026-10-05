export function scrollToHomeSection(id) {
  const section = document.getElementById(id)
  if (!section) return
  const target = section.querySelector('[data-section-focus]') || section
  // The expanded mobile menu belongs to the header, but is not part of the fixed bar.
  const headerHeight = document.querySelector('[data-navigation-bar]')?.getBoundingClientRect().height || 64
  const viewport = window.visualViewport
  const viewportHeight = viewport?.height || window.innerHeight
  const viewportTop = viewport?.offsetTop || 0
  const availableHeight = Math.max(0, viewportHeight - headerHeight)
  const rect = target.getBoundingClientRect()
  const offset = viewportTop + headerHeight + (availableHeight - rect.height) / 2
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  window.scrollTo({
    top: Math.min(maxScroll, Math.max(0, window.scrollY + rect.top - offset)),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}
