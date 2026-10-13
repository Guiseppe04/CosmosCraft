import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RotateCcw, X, ChevronDown, ChevronUp } from 'lucide-react'

export function ImageZoomModal({ src, alt, isOpen: controlledIsOpen, onClose }) {
  const [internalIsOpen, setIsOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const isControlled = controlledIsOpen !== undefined
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!isOpen) return
    setLoading(Boolean(src)); setError(src ? '' : 'The original image is not available for this transaction.')
    setScale(1); setPosition({x:0,y:0})
  }, [src,isOpen,retry])
  useEffect(() => {
    if (!isOpen) return
    const escape = event => { if (event.key === 'Escape') handleClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [isOpen,onClose])

  const handleClose = () => {
    if (isControlled) {
      onClose?.()
    } else {
      setIsOpen(false)
    }
    resetZoom()
  }

  const handleWheel = (event) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.1 : 0.1
    setScale((value) => Math.max(0.5, Math.min(3, value + delta)))
  }

  const handleMouseDown = (event) => {
    setIsDragging(true)
    dragStart.current = { x: event.clientX - position.x, y: event.clientY - position.y }
  }

  const handleMouseMove = (event) => {
    if (!isDragging) return
    setPosition({
      x: event.clientX - dragStart.current.x,
      y: event.clientY - dragStart.current.y,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const zoomModal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="image-zoom-modal"
          role="dialog" aria-modal="true" aria-label={alt || 'Image preview'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClose()
          }}
        >
          <button
            type="button" aria-label="Close image preview"
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
          >
            <X aria-hidden="true" className="w-6 h-6 text-white" />
          </button>

          <div
            className="w-full h-full overflow-hidden flex items-center justify-center p-8"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {loading && <p role="status" className="absolute text-white">Loading image...</p>}
            {error && <div role="alert" style={{ color: '#ef4444' }} className="max-w-sm rounded-xl bg-black/70 p-6 text-center text-red-300">
              <p>{error}</p>
              {src && <button type="button" onClick={()=>setRetry(value=>value+1)} className="mt-3 text-white underline">Retry image</button>}
            </div>}
            {src && !error && <motion.img
              key={`${src}-${retry}`}
              onLoad={()=>setLoading(false)}
              onError={event=>{event.currentTarget.style.display='none';setLoading(false);setError('This image could not be loaded. It may be missing, inaccessible or corrupted.')}}
              src={src}
              alt={alt}
              className={`max-w-full max-h-full object-contain select-none ${loading ? 'opacity-0' : ''}`}
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              draggable={false}
            />}
          </div>

          {!error && !loading && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-3 bg-black/60 px-4 py-2 rounded-full">
            <button type="button" aria-label="Zoom out" onClick={() => setScale((value) => Math.max(0.5, value - 0.25))} className="text-white hover:text-[var(--gold-primary)] transition-colors">
              <ChevronDown aria-hidden="true" className="w-5 h-5" />
            </button>
            <span className="text-white text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setScale((value) => Math.min(3, value + 0.25))} className="text-white hover:text-[var(--gold-primary)] transition-colors">
              <ChevronUp aria-hidden="true" className="w-5 h-5" />
            </button>
            <button type="button" aria-label="Reset zoom" onClick={resetZoom} className="ml-2 text-white hover:text-[var(--gold-primary)] transition-colors">
              <RotateCcw aria-hidden="true" className="w-4 h-4" />
            </button>
            {/^https?:/i.test(src) && <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-white underline whitespace-nowrap">Open original image</a>}
          </div>}
        </motion.div>
      )}
    </AnimatePresence>
  )

  if (isControlled) {
    return zoomModal
  }

  return (
    <>
      <div
        className="relative cursor-zoom-in overflow-hidden rounded-lg border border-[var(--border)]"
        onClick={() => setIsOpen(true)}
      >
        <img src={src} alt={alt} className="w-full h-48 object-contain bg-[var(--bg-primary)]/50" />
        <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-black/60 px-3 py-1.5 rounded-full text-white text-sm">Click to zoom</span>
        </div>
      </div>
      {zoomModal}
    </>
  )
}

export default ImageZoomModal
