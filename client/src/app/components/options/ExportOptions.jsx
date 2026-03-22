export default function ExportOptions({ onSave, onReset, onExport, onLoad }) {
  return (
    <>
      <div className="px-4 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
        Export / Load
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        <button
          type="button"
          onClick={onSave}
          className="rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Save Build
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Export Config
        </button>
        <button
          type="button"
          onClick={onLoad}
          className="rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Load Config
        </button>
      </div>
    </>
  )
}
