export function SectionLoader({ label = 'Loading...', className = '' }) {
  return (
    <div className={`flex items-center justify-center py-10 ${className}`}>
      <div className="flex items-center gap-3 text-[var(--text-muted)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--gold-primary)] border-t-transparent" />
        <span>{label}</span>
      </div>
    </div>
  )
}

export default SectionLoader
