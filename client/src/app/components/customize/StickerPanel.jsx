import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Upload } from 'lucide-react'

export function StickerPanel({
  stickerCount = 0,
  maxStickers = 10,
  defaultExpanded = false,
  onAddClick,
  addDisabled = false,
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="builder-sticker-panel relative mt-3 w-full shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-dark)]">
      <div className="builder-sticker-toolbar flex items-center justify-between gap-2 p-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={onAddClick}
            disabled={addDisabled}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-[var(--border)] px-2.5 py-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-40"
            title="Upload sticker image"
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            Add Sticker
          </button>
          <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
            {stickerCount}/{maxStickers} items
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md bg-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)]"
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
            <div className="max-h-60 space-y-2 overflow-y-auto border-t border-[var(--border)] p-2 [&_button]:min-h-[44px]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
