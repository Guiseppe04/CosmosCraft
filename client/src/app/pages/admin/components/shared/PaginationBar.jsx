export function PaginationBar({ page, totalPages, onPageChange, className = '' }) {
  if (!totalPages || totalPages <= 1) return null

  return (
    <div className={`flex items-center justify-between gap-3 mt-6 ${className}`}>
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-colors disabled:opacity-50"
      >
        Previous
      </button>
      <span className="text-sm text-[var(--text-muted)]">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-colors disabled:opacity-50"
      >
        Next
      </button>
    </div>
  )
}

export default PaginationBar
