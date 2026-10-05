import { useEffect, useState } from 'react'

export function useBuilderDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1536px)').matches)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1536px)')
    const update = () => setIsDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return isDesktop
}
