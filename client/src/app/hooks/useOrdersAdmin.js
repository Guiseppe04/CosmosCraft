import { useState, useCallback } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useOrdersAdmin({ debouncedSearch, showToast }) {
  const [orders, setOrders] = useState([])
  const [ordersPagination, setOrdersPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })

  const fetchOrders = useCallback(async (queryParams = {}) => {
    try {
      const res = await adminApi.getOrders({ search: debouncedSearch, include_items: true, ...queryParams })
      const newData = Array.isArray(res.data) ? res.data : res.data?.orders || []
      updateIfChanged(orders, newData, setOrders)
      setOrdersPagination(res.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 })
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [debouncedSearch, showToast, orders])

  return {
    orders,
    ordersPagination,
    fetchOrders,
    setOrdersPagination,
  }
}
