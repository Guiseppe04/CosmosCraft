import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Upload } from 'lucide-react'

export function StickerPanel({
  stickerCount = 0,
  maxStickers = 10,
  defaultExpanded = true,
  onAddClick,
  addDisabled = false,
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="absolute top-4 right-2 z-10 w-[calc(100%-1rem)] sm:right-4 sm:w-[360px] sm:max-w-[calc(100%-2rem)] overflow-hidden rounded-lg border border-white/10 bg-black/35 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 p-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {expanded && (
            <button
              type="button"
              onClick={onAddClick}
              disabled={addDisabled}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--border)] px-2.5 py-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Upload sticker image"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              Add Sticker
            </button>
          )}
          {!expanded && (
            <span className="text-xs font-semibold text-[var(--text-light)]">Add Sticker</span>
          )}
          <span className="text-[10px] text-white/70 whitespace-nowrap">
            {stickerCount}/{maxStickers} items
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)]"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse sticker panel' : 'Expand sticker panel'}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="sticker-panel-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-white/10 p-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
