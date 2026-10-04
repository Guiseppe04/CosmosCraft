import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { WalkInAssignmentPanel } from './WalkInAssignmentPanel.jsx'

export function WalkInAssignmentModal({ onClose, onNewBuild, ...props }) {
  const dialogRef = useRef(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const previousFocus = document.activeElement
    dialogRef.current?.focus()
    return () => previousFocus?.focus()
  }, [])

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && !busy) onClose()
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')]
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="walk-in-assignment-title"
        onKeyDown={handleKeyDown} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-5">
          <div>
            <h2 id="walk-in-assignment-title" className="text-lg font-semibold">Send build to a walk-in customer</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Choose their registered account to save this design in Saved Builds. They can review it and choose Buy Now when ready.</p>
          </div>
          <button type="button" aria-label="Close customer assignment" disabled={busy} onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50"><X className="w-5 h-5" /></button>
        </div>
        <WalkInAssignmentPanel {...props} onBusyChange={setBusy} onNewBuild={() => { onClose(); onNewBuild() }} />
      </div>
    </div>
  )
}
