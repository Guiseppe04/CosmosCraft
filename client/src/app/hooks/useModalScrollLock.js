import { useEffect } from 'react'

let locks = 0
let previousBodyOverflow
let previousRootOverflow
let previousBodyLayout
let scrollPosition

export function useModalScrollLock(open) {
  useEffect(() => {
    if (!open) return
    if (locks === 0) {
      previousBodyOverflow = document.body.style.overflow
      previousRootOverflow = document.documentElement.style.overflow
      previousBodyLayout = Object.fromEntries(['position', 'top', 'left', 'width'].map(property => [property, document.body.style[property]]))
      scrollPosition = { x: window.scrollX, y: window.scrollY }
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollPosition.y}px`
      document.body.style.left = `-${scrollPosition.x}px`
      document.body.style.width = '100%'
      document.documentElement.style.overflow = 'hidden'
    }
    locks++
    return () => {
      locks--
      if (locks === 0) {
        document.body.style.overflow = previousBodyOverflow
        document.documentElement.style.overflow = previousRootOverflow
        Object.assign(document.body.style, previousBodyLayout)
        window.scrollTo({ left: scrollPosition.x, top: scrollPosition.y, behavior: 'instant' })
      }
    }
  }, [open])
}
