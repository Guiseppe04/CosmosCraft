import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RotateCcw, X, ChevronDown, ChevronUp } from 'lucide-react'

export function ImageZoomModal({ src, alt }) {
  const [isOpen, setIsOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="image-zoom-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) setIsOpen(false)
            }}
          >
            <button
              onClick={() => {
                setIsOpen(false)
                resetZoom()
              }}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            <div
              className="w-full h-full overflow-hidden flex items-center justify-center p-8"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <motion.img
                src={src}
                alt={alt}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
                draggable={false}
              />
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 px-4 py-2 rounded-full">
              <button onClick={() => setScale((value) => Math.max(0.5, value - 0.25))} className="text-white hover:text-[var(--gold-primary)] transition-colors">
                <ChevronDown className="w-5 h-5" />
              </button>
              <span className="text-white text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale((value) => Math.min(3, value + 0.25))} className="text-white hover:text-[var(--gold-primary)] transition-colors">
                <ChevronUp className="w-5 h-5" />
              </button>
              <button onClick={resetZoom} className="ml-2 text-white hover:text-[var(--gold-primary)] transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default ImageZoomModal
