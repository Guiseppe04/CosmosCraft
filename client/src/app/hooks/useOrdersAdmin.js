import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useOrdersAdmin({ debouncedSearch, showToast }) {
  const [orders, setOrders] = useState([])
  const [ordersPagination, setOrdersPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const ordersRef = useRef(orders)
  const inFlightRequestRef = useRef(null)
  const latestRequestIdRef = useRef(0)
  const lastRequestedPageRef = useRef(1)
  const lastQueryParamsRef = useRef({})

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const fetchOrders = useCallback(async (queryParams = {}) => {
    const isDefaultCall = Object.keys(queryParams).length === 0
    const baseQuery = isDefaultCall ? lastQueryParamsRef.current : queryParams

    const normalizedQuery = {
      search: debouncedSearch,
      include_items: true,
      page_size: 10,
      ...baseQuery,
    }

    if (normalizedQuery.page == null) {
      normalizedQuery.page = lastRequestedPageRef.current
    } else {
      lastRequestedPageRef.current = normalizedQuery.page
    }

    const requestKey = JSON.stringify(normalizedQuery)
    if (inFlightRequestRef.current === requestKey) {
      if (import.meta.env.DEV) console.debug('[useOrdersAdmin] skipping duplicate request', requestKey)
      return
    }

    const requestId = ++latestRequestIdRef.current
    inFlightRequestRef.current = requestKey

    try {
      const res = await adminApi.getOrders(normalizedQuery)

      if (latestRequestIdRef.current !== requestId) {
        if (import.meta.env.DEV) console.debug('[useOrdersAdmin] ignoring stale response', { requestKey, requestId, latest: latestRequestIdRef.current })
        return
      }

      const newData = Array.isArray(res.data) ? res.data : res.data?.orders || []
      if (JSON.stringify(ordersRef.current) !== JSON.stringify(newData)) {
        ordersRef.current = newData
        setOrders(newData)
      }
      setOrdersPagination(res.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 })
      lastQueryParamsRef.current = { ...normalizedQuery }
    } catch (e) {
      if (latestRequestIdRef.current === requestId) {
        showToast(e.message, 'error')
      }
    } finally {
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = null
      }
    }
  }, [debouncedSearch, showToast])

  return {
    orders,
    ordersPagination,
    fetchOrders,
    setOrdersPagination,
  }
}
