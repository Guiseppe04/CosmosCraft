import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'

export function useOrdersAdmin({ debouncedSearch, showToast }) {
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersPagination, setOrdersPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const ordersRef = useRef(orders)
  const inFlightRequestsRef = useRef(new Map())
  const activeRequestKeyRef = useRef(null)
  const lastRequestedPageRef = useRef(1)
  const lastQueryParamsRef = useRef({})

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const fetchOrders = useCallback((queryParams = {}) => {
    const isDefaultCall = Object.keys(queryParams).length === 0
    const baseQuery = isDefaultCall ? lastQueryParamsRef.current : queryParams

    const resolvedSearch = baseQuery.search !== undefined
      ? baseQuery.search
      : (debouncedSearch || undefined)

    const normalizedQuery = {
      include_items: true,
      page_size: 10,
      ...baseQuery,
      search: resolvedSearch || undefined,
    }

    if (normalizedQuery.page == null) {
      normalizedQuery.page = lastRequestedPageRef.current
    } else {
      lastRequestedPageRef.current = normalizedQuery.page
    }

    // Clean undefined keys
    Object.keys(normalizedQuery).forEach(k => normalizedQuery[k] === undefined && delete normalizedQuery[k])

    const requestKey = JSON.stringify(normalizedQuery)
    // Record the newest intended query before the request resolves. This keeps a
    // poll from reusing an older successful query and overwriting newer filters.
    lastQueryParamsRef.current = { ...normalizedQuery }
    activeRequestKeyRef.current = requestKey

    const existingRequest = inFlightRequestsRef.current.get(requestKey)
    if (existingRequest) {
      if (import.meta.env.DEV) console.debug('[useOrdersAdmin] skipping duplicate request', requestKey)
      setOrdersLoading(true)
      return existingRequest.promise
    }

    setOrdersLoading(true)

    const requestPromise = Promise.resolve()
      .then(() => adminApi.getOrders(normalizedQuery))
      .then((res) => {
        if (activeRequestKeyRef.current !== requestKey) {
          if (import.meta.env.DEV) console.debug('[useOrdersAdmin] ignoring stale response', { requestKey, activeRequestKey: activeRequestKeyRef.current })
          return res
        }

        const newData = Array.isArray(res.data) ? res.data : res.data?.orders || []
        if (JSON.stringify(ordersRef.current) !== JSON.stringify(newData)) {
          ordersRef.current = newData
          setOrders(newData)
        }

        const pag = res.pagination || res.data?.pagination
        if (pag) {
          const nextPagination = {
            page: Number(pag.page) || normalizedQuery.page || 1,
            pageSize: Number(pag.pageSize || pag.page_size) || 10,
            total: Number(pag.total) || newData.length,
            totalPages: Number(pag.totalPages || pag.total_pages || pag.pages) || 1,
          }
          setOrdersPagination((currentPagination) => (
            currentPagination.page === nextPagination.page &&
            currentPagination.pageSize === nextPagination.pageSize &&
            currentPagination.total === nextPagination.total &&
            currentPagination.totalPages === nextPagination.totalPages
              ? currentPagination
              : nextPagination
          ))
        }
        return res
      })
      .catch((e) => {
        if (activeRequestKeyRef.current === requestKey) {
          showToast(e.message, 'error')
        }
        throw e
      })
      .finally(() => {
        const request = inFlightRequestsRef.current.get(requestKey)
        if (request?.promise === requestPromise) {
          inFlightRequestsRef.current.delete(requestKey)
        }
        if (activeRequestKeyRef.current === requestKey) {
          setOrdersLoading(false)
        }
      })

    inFlightRequestsRef.current.set(requestKey, { promise: requestPromise })
    return requestPromise
  }, [debouncedSearch, showToast])

  return {
    orders,
    ordersLoading,
    ordersPagination,
    fetchOrders,
    setOrdersPagination,
  }
}
