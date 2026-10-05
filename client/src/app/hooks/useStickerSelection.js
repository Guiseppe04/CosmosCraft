import { useEffect } from 'react'

export function useStickerSelection(setSelectedStickerId) {
  useEffect(() => {
    const deselect = event => {
      if (!event.target.closest('[data-sticker-interactive], .builder-sticker-panel')) setSelectedStickerId(null)
    }
    const escape = event => { if (event.key === 'Escape') setSelectedStickerId(null) }
    document.addEventListener('pointerdown', deselect)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', deselect)
      document.removeEventListener('keydown', escape)
    }
  }, [setSelectedStickerId])
}
