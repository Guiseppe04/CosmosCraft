export function BuilderSavedBadge({ hasUnsavedChanges }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm ${
        hasUnsavedChanges
          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${hasUnsavedChanges ? 'bg-amber-300' : 'bg-emerald-300'}`}
      />
      {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
    </div>
  )
}
