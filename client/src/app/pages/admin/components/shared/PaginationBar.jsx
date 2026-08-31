export function PaginationBar({ page, totalPages, pagination, loading = false, onPageChange, className = '' }) {
  // Keep the component compatible with both the primitive and pagination-object APIs.
  // Most admin tabs provide the latter.
  const currentPage = Number(page ?? pagination?.page ?? 1)
  const pageCount = Number(totalPages ?? pagination?.totalPages ?? pagination?.total_pages ?? pagination?.pages ?? 1)

  if (!pageCount || pageCount <= 1) return null

  return (
    <div className={`flex items-center justify-between gap-3 mt-6 ${className}`}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={loading || currentPage <= 1}
        className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-colors disabled:opacity-50"
      >
        Previous
      </button>
      <span className="text-sm text-[var(--text-muted)]">
        Page {currentPage} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
        disabled={loading || currentPage >= pageCount}
        className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-colors disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Next'}
      </button>
    </div>
  )
}

export default PaginationBar
