import { useState, useEffect } from 'react'
import { Info, X, LogIn } from 'lucide-react'

export function BuilderSavedBadge({
  hasUnsavedChanges,
  hasBeenSaved = true,
  autoShowHint = false,
  isAuthenticated = true,
}) {
  const [showHint, setShowHint] = useState(autoShowHint)

  useEffect(() => {
    if (!autoShowHint) return
    setShowHint(true)
    const timer = setTimeout(() => setShowHint(false), 6000)
    return () => clearTimeout(timer)
  }, [autoShowHint])

  // A build is only "saved" if:
  //  - the user is authenticated
  //  - a save has happened for this account
  //  - there are no unsaved changes since that save
  const isSaved = isAuthenticated && hasBeenSaved && !hasUnsavedChanges

  // Label logic:
  //  - logged out → "Sign in to save" (needs auth)
  //  - saved → "Saved"
  //  - otherwise → "Unsaved"
  const label = !isAuthenticated
    ? 'Sign in to save'
    : isSaved
      ? 'Saved'
      : 'Unsaved'

  const badgeClass = !isAuthenticated
    ? 'bg-sky-500/95 text-white border border-sky-400'
    : isSaved
      ? 'bg-emerald-500/95 text-white border border-emerald-400'
      : 'bg-amber-500/95 text-white border border-amber-400'

  return (
    <div className="relative flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setShowHint((prev) => !prev)}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold shadow-lg transition-colors ${badgeClass}`}
        title={showHint ? 'Hide info' : 'What does this mean?'}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        {!isAuthenticated && <LogIn className="h-3 w-3" />}
        {label}
        <Info className="h-3 w-3 opacity-90" />
      </button>

      {showHint && (
        <div className="relative max-w-[300px] rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-3.5 py-2.5 pr-8 text-[11px] leading-relaxed text-[var(--text-light)] shadow-2xl">
          <button
            type="button"
            onClick={() => setShowHint(false)}
            aria-label="Dismiss"
            className="absolute right-2 top-2 rounded-md p-0.5 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--text-light)]"
          >
            <X className="h-3 w-3" />
          </button>
          <p>
            {!isAuthenticated ? (
              <>
                You're not signed in, so this build isn't saved anywhere yet. Click{' '}
                <strong className="font-semibold text-[var(--gold-primary)]">Save Build</strong> to
                sign in and store it in My Guitar.
              </>
            ) : isSaved ? (
              <>
                Your build is saved to{' '}
                <strong className="font-semibold text-[var(--gold-primary)]">My Guitar</strong>. You
                can purchase it, add parts, or keep editing later.
              </>
            ) : (
              <>
                This build isn't saved yet. Click{' '}
                <strong className="font-semibold text-[var(--gold-primary)]">Save Build</strong> to
                store it in My Guitar and continue later.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}