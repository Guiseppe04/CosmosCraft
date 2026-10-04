import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import GuitarPreview from '../guitar/GuitarPreview.jsx'
import BassPreview from '../bass/BassPreview.jsx'
import { BODY_OPTIONS, DEFAULT_CONFIG } from '../../lib/guitarBuilderData.js'
import { BASS_BODY_OPTIONS, BASS_DEFAULT_CONFIG } from '../../lib/bassBuilderData.js'

const parse = (value, fallback) => {
  if (typeof value !== 'string') return value || fallback
  try { return JSON.parse(value) || fallback } catch { return fallback }
}

// Shared with Saved Builds: the same saved-image and front/rear preview used by checkout.
export default function CustomBuildPreviewModal({ item, onClose }) {
  const build = item.customization || item
  const savedConfig = parse(build.config || build.config_json, {})
  const isBass = Boolean(build.isBass || savedConfig.bassType || String(build.guitar_type || savedConfig.guitarType || '').toLowerCase().includes('bass'))
  const config = { ...(isBass ? BASS_DEFAULT_CONFIG : DEFAULT_CONFIG), ...savedConfig }
  const Preview = isBass ? BassPreview : GuitarPreview
  const mask = isBass ? BASS_BODY_OPTIONS[config.bassType]?.bodySrc : BODY_OPTIONS[config.body]?.bodySrc
  const stickers = parse(build.stickers, [])
  const previewImage = build.preview_image || item.preview_image
  const previewImages = build.preview_images || savedConfig._previewImages || {}
  const [view, setView] = useState(previewImage ? 'design' : 'front')
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useLayoutEffect(() => {
    const previousFocus = document.activeElement
    dialogRef.current?.focus()
    const handleEscape = event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
      }
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => {
      document.removeEventListener('keydown', handleEscape, true)
      previousFocus?.focus()
    }
  }, [])

  const onKeyDown = event => {
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('button')]
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus()
    }
  }

  return createPortal(
    <div data-build-preview-backdrop className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label={`${item.name || 'Custom build'} preview`}
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-bold text-[var(--text-light)]">{item.name || 'Custom Build'}</h2>
            <p className="text-xs text-[var(--text-muted)]">Build preview</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close build preview"
            className="shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)]">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex justify-center border-b border-[var(--border)] p-3">
          <div className="flex flex-wrap justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-1" role="group" aria-label="Preview side">
            {(previewImage ? ['design', 'front', 'rear'] : ['front', 'rear']).map(side => (
              <button key={side} type="button" onClick={() => setView(side)} aria-pressed={view === side}
                className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${view === side ? 'bg-[var(--gold-primary)] text-black' : 'text-[var(--text-muted)] hover:text-white'}`}>
                {side === 'design' ? 'Saved design' : side}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[min(65vh,620px)] min-h-[240px] bg-[var(--bg-primary)] p-4 sm:p-8">
          {(view === 'design' ? previewImage : previewImages[view]) ? (
            <img src={view === 'design' ? previewImage : previewImages[view]} alt={`${item.name || 'Custom build'} ${view === 'design' ? 'saved design' : view + ' view'}`} className="h-full w-full object-contain" />
          ) : (
            <Preview config={config} view={view} modelImageSrc={null} bodyWoodImageSrc={null} topWoodImageSrc={null} stickerMaskSrc={mask || null}
              stickerOverlay={(Array.isArray(stickers) ? stickers : []).filter(sticker => (sticker.side || 'front') === view && sticker.src).map((sticker, index) => (
                <img key={sticker.id || index} src={sticker.src} alt="" draggable={false} className="absolute select-none" style={{
                  zIndex: 25 + index, left: `${Number(sticker.x) || 0}%`, top: `${Number(sticker.y) || 0}%`, width: `${Number(sticker.size) || 18}%`,
                  transform: `translate(-50%, -50%) rotate(${Number(sticker.rotation) || 0}deg)`, pointerEvents: 'none',
                }} />
              ))} />
          )}
        </div>
      </section>
    </div>, document.body,
  )
}
