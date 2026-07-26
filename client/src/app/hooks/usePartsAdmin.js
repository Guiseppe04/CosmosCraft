import { useState, useCallback } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

const DEFAULT_PART_QUERY = {
  page: 1,
  pageSize: 100,
  sortBy: 'created_at',
  sortDir: 'desc',
  guitar_type: '',
  part_category: '',
  is_active: '',
  min_price: '',
  max_price: '',
}

export function usePartsAdmin({ debouncedSearch, showToast, initialQuery = DEFAULT_PART_QUERY }) {
  const [partQuery, setPartQuery] = useState(initialQuery)
  const [parts, setParts] = useState([])
  const [partsLoading, setPartsLoading] = useState(false)
  const [partsPagination, setPartsPagination] = useState({ page: 1, pageSize: 500, total: 0, totalPages: 1 })

  const fetchParts = useCallback(async () => {
    setPartsLoading(true)
    try {
      const res = await adminApi.getBuilderParts({ search: debouncedSearch, ...partQuery })
      updateIfChanged(parts, res.data || [], setParts)
      setPartsPagination(res.pagination || { page: 1, pageSize: 500, total: 0, totalPages: 1 })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setPartsLoading(false)
    }
  }, [debouncedSearch, partQuery, showToast, parts])

  return {
    parts,
    partsLoading,
    partsPagination,
    partQuery,
    setPartQuery,
    fetchParts,
  }
}
