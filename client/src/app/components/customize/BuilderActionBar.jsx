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
    'flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-dark)] hover:text-[var(--text-light)]'

  return (
    <div className="mt-3 flex flex-shrink-0 gap-3">
      <button type="button" onClick={onReset} className={actionButtonClass}>
        <RotateCcw className="h-4 w-4" />
        Reset
      </button>
      {showSave && (
        <button type="button" onClick={onSave} className={actionButtonClass}>
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
