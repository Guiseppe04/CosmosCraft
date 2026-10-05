import { useEffect, useRef } from 'react'

// Enable only in desktop layouts with a mouse-style primary pointer. Pointer
// capture owns sticker gestures; wheel events never change sticker data.
export function usePreviewWheelZoom(viewportRef, options) {
  const latest = useRef(options)
  latest.current = options
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined
    const desktopPointer = window.matchMedia('(min-width: 1280px) and (hover: hover) and (pointer: fine)')
    let lastStep = -Infinity
    const wheel = event => {
      if (!desktopPointer.matches) return
      event.preventDefault()
      const state = latest.current
      if (event.ctrlKey || state.isManipulating || state.isPanning || !event.deltaY) return
      const now = performance.now()
      if (now - lastStep < 70) return
      lastStep = now
      const nextZoom = Math.max(0.7, Math.min(2, Number((state.zoomLevel + (event.deltaY < 0 ? 0.05 : -0.05)).toFixed(2))))
      if (nextZoom === state.zoomLevel) return
      const rect = viewport.getBoundingClientRect()
      const ratio = nextZoom / state.zoomLevel
      const maxX = viewport.clientWidth * (nextZoom - 1) / 2
      const maxY = viewport.clientHeight * (nextZoom - 1) / 2
      const pan = nextZoom <= 1 ? { x: 0, y: 0 } : {
        x: Math.max(-maxX, Math.min(maxX, state.panOffset.x * ratio + (event.clientX - rect.left - rect.width / 2) * (1 - ratio))),
        y: Math.max(-maxY, Math.min(maxY, state.panOffset.y * ratio + (event.clientY - rect.top - rect.height / 2) * (1 - ratio))),
      }
      latest.current = { ...state, zoomLevel: nextZoom, panOffset: pan }
      state.setPanOffset(pan)
      state.setZoomLevel(nextZoom)
    }
    // Selection handles live in a portal to avoid body-mask clipping, so their
    // native events do not bubble through the viewport element.
    const wheelOverSelection = event => {
      if (!event.target.closest('.sticker-editing-chrome')) return
      const rect = viewport.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return
      wheel(event)
    }
    viewport.addEventListener('wheel', wheel, { passive: false })
    document.addEventListener('wheel', wheelOverSelection, { passive: false })
    return () => {
      viewport.removeEventListener('wheel', wheel)
      document.removeEventListener('wheel', wheelOverSelection)
    }
  }, [viewportRef])
}
