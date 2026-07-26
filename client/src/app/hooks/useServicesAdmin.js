import { useState, useCallback } from 'react'
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

  const fetchServices = useCallback(async () => {
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
      const newData = Array.isArray(res.data) ? res.data : res.data?.services || []
      updateIfChanged(services, newData, setServices)
      const total = res.pagination?.total || newData.length
      const totalPages = Math.max(Math.ceil(total / serviceQuery.pageSize), 1)
      setServicesPagination({
        page: serviceQuery.page,
        pageSize: serviceQuery.pageSize,
        total,
        totalPages,
      })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setServicesLoading(false)
    }
  }, [debouncedSearch, serviceQuery, services, showToast])

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
