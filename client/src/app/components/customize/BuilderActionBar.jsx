import { RotateCcw, Save, ChevronRight, Image } from 'lucide-react'

export function BuilderActionBar({
  onReset,
  onSave,
  onLoad,
  onSaveImage,
  loadLabel = 'Load Build',
  showSave = true,
  showLoad = true,
  showSaveImage = false,
}) {
  const actionButtonClass =
    'flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-xs font-medium text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-dark)] hover:text-[var(--text-light)] sm:text-sm [&>svg]:shrink-0'

  return (
    <div className="builder-actions mt-3 grid flex-shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 [&>button:last-child:nth-child(odd)]:col-span-2">
      <button type="button" onClick={onReset} className={actionButtonClass}>
        <RotateCcw className="h-4 w-4" />
        Reset
      </button>
      {showSave && (
        <button
          type="button"
          onClick={onSave}
          className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-3 py-3 text-xs font-bold text-[var(--text-dark)] shadow-lg shadow-[#d4af37]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#d4af37]/30 sm:text-sm [&>svg]:shrink-0"
        >
          <Save className="h-4 w-4" />
          Save Build
        </button>
      )}
      {showLoad && (
        <button type="button" onClick={onLoad} className={actionButtonClass}>
          <ChevronRight className="h-4 w-4" />
          {loadLabel}
        </button>
      )}
      {showSaveImage && (
        <button type="button" onClick={onSaveImage} className={actionButtonClass}>
          <Image className="h-4 w-4" />
          Save Image
        </button>
      )}
    </div>
  )
}
