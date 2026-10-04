export const DEFAULT_PROJECT_PAGE_SIZE = 10

/**
 * Normalize a projects response pagination block.
 *
 * The endpoints answer with snake_case keys and fall back to their own default page
 * size (20) whenever a request omits one, so the requested page size always wins. A
 * request that does carry a page size can never repaint the paginator with another
 * number.
 */
export function normalizeProjectPagination(pagination = {}, queryParams = {}) {
  const pageSize = Number(queryParams.page_size)
    || Number(pagination.page_size ?? pagination.pageSize)
    || DEFAULT_PROJECT_PAGE_SIZE
  const total = Number(pagination.total) || 0

  return {
    page: Number(pagination.page) || Number(queryParams.page) || 1,
    pageSize,
    total,
    totalPages: Number(pagination.total_pages ?? pagination.totalPages) || Math.max(Math.ceil(total / pageSize), 1),
  }
}

/**
 * Build the pagination object the paginator renders from.
 *
 * Page and page size come from the tab's own state, only the total comes from the
 * server. That keeps the control stable while a request is in flight: a refresh, a
 * socket update or a page-size change never shows a stale size for a moment.
 */
export function buildProjectPaginationView({ page, pageSize, total }) {
  const safePageSize = Number(pageSize) || DEFAULT_PROJECT_PAGE_SIZE
  const safeTotal = Number(total) || 0
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize))

  return {
    page: Math.min(Math.max(Number(page) || 1, 1), totalPages),
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
  }
}