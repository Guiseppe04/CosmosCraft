import { useState, useCallback, useEffect, useRef } from 'react'
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
  const partsRef = useRef(parts)
  const inFlightRequestRef = useRef(null)

  useEffect(() => {
    partsRef.current = parts
  }, [parts])

  const fetchParts = useCallback(async () => {
    const requestKey = JSON.stringify({ search: debouncedSearch, ...partQuery })
    if (inFlightRequestRef.current === requestKey) {
      if (import.meta.env.DEV) console.debug('[usePartsAdmin] skipping duplicate request', requestKey)
      return
    }

    inFlightRequestRef.current = requestKey
    setPartsLoading(true)
    try {
      const res = await adminApi.getBuilderParts({ search: debouncedSearch, ...partQuery })
      const newData = res.data || []
      if (JSON.stringify(partsRef.current) !== JSON.stringify(newData)) {
        partsRef.current = newData
        setParts(newData)
      }
      setPartsPagination(res.pagination || { page: 1, pageSize: 500, total: 0, totalPages: 1 })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setPartsLoading(false)
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = null
      }
    }
  }, [debouncedSearch, partQuery, showToast])

  return {
    parts,
    partsLoading,
    partsPagination,
    partQuery,
    setPartQuery,
    fetchParts,
  }
}
