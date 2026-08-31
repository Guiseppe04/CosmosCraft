import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

const DEFAULT_SERVICE_QUERY = {
  page: 1,
  pageSize: 20,
  sortBy: 'created_at',
  sortDir: 'desc',
  is_active: '',
}

export function useServicesAdmin({ debouncedSearch, showToast, initialQuery = DEFAULT_SERVICE_QUERY }) {
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicesPagination, setServicesPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
  const [serviceQuery, setServiceQuery] = useState(initialQuery)
  const servicesRef = useRef(services)
  const inFlightRequestRef = useRef(null)
  const latestRequestIdRef = useRef(0)

  useEffect(() => {
    servicesRef.current = services
  }, [services])

  const fetchServices = useCallback(async () => {
    const requestKey = JSON.stringify({ search: debouncedSearch, ...serviceQuery })
    if (inFlightRequestRef.current === requestKey) {
      if (import.meta.env.DEV) console.debug('[useServicesAdmin] skipping duplicate request', requestKey)
      return
    }

    inFlightRequestRef.current = requestKey
    const requestId = ++latestRequestIdRef.current
    setServicesLoading(true)
    try {
      const params = {
        sort: serviceQuery.sortBy === 'duration_minutes' ? 'duration' : serviceQuery.sortBy,
        order: serviceQuery.sortDir,
        limit: serviceQuery.pageSize,
        offset: (serviceQuery.page - 1) * serviceQuery.pageSize,
      }
      if (debouncedSearch) params.search = debouncedSearch
      if (serviceQuery.is_active !== '') params.is_active = serviceQuery.is_active

      const res = await adminApi.getServices(params)
      if (latestRequestIdRef.current !== requestId) return
      const newData = Array.isArray(res.data) ? res.data : res.data?.services || []
      if (JSON.stringify(servicesRef.current) !== JSON.stringify(newData)) {
        servicesRef.current = newData
        setServices(newData)
      }
      const total = res.pagination?.total || newData.length
      const totalPages = Math.max(Math.ceil(total / serviceQuery.pageSize), 1)
      setServicesPagination({
        page: serviceQuery.page,
        pageSize: serviceQuery.pageSize,
        total,
        totalPages,
      })
    } catch (e) {
      if (latestRequestIdRef.current === requestId) showToast(e.message, 'error')
    } finally {
      if (latestRequestIdRef.current === requestId) setServicesLoading(false)
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = null
      }
    }
  }, [debouncedSearch, serviceQuery, showToast])

  return {
    services,
    servicesLoading,
    servicesPagination,
    serviceQuery,
    setServiceQuery,
    setServices,
    setServicesPagination,
    fetchServices,
  }
}
