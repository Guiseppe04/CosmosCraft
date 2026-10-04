import { ChevronLeft, ChevronRight } from 'lucide-react'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function PaginationBar({
  page,
  totalPages,
  total,
  pagination,
  loading = false,
  onPageChange,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  attached = false,
  className = '',
}) {
  // Keep the component compatible with both the primitive and pagination-object APIs.
  // Most admin tabs provide the latter.
  const currentPage = Number(page ?? pagination?.page ?? 1)
  const pageCount = Number(totalPages ?? pagination?.totalPages ?? pagination?.total_pages ?? pagination?.pages ?? 1)
  const totalRecords = Number(total ?? pagination?.total ?? pagination?.totalRecords ?? pagination?.total_records ?? 0)
  const currentPageSize = Number(pageSize ?? pagination?.pageSize ?? pagination?.page_size ?? pagination?.limit ?? 0)

  // `attached` renders the footer inside a table card (Sales Report look);
  // standalone it becomes its own surface so it does not float loose under the table.
  const shell = attached
    ? 'p-4 border-t border-[var(--border)]'
    : 'p-4 border border-[var(--border)] rounded-2xl shadow-sm'

  // A tab may start on a size that is not one of the presets; keep that value
  // selectable so the dropdown always reflects the rows actually being shown.
  const sizes = [...new Set([...pageSizeOptions, ...(currentPageSize > 0 ? [currentPageSize] : [])])]

  return (
    <div className={`${shell} flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-[var(--surface-dark)] ${className}`}>
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-muted)]">
          Showing page <strong className="text-[var(--text-primary)]">{currentPage}</strong> of{' '}
          <strong className="text-[var(--text-primary)]">{pageCount || 1}</strong> ({totalRecords || 0} total records)
        </span>

        {onPageSizeChange ? (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[var(--text-muted)] text-xs">Per page:</span>
            <select
              value={currentPageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Records per page"
              className="bg-white text-black border border-gray-300 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none"
            >
              {sizes.map((n) => (
                <option key={n} value={n} className="text-black bg-white">{n}</option>
              ))}
            </select>
          </div>
        ) : currentPageSize > 0 ? (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[var(--text-muted)] text-xs">Per page:</span>
            <span className="bg-white text-black border border-gray-300 rounded px-2 py-0.5 text-xs font-semibold">{currentPageSize}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={loading || currentPage <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--gold-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          disabled={loading || currentPage >= pageCount}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--gold-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export default PaginationBar