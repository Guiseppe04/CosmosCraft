import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

const DEFAULT_PRODUCT_QUERY = {
  page: 1,
  pageSize: 10,
  sortBy: 'created_at',
  sortDir: 'desc',
  category_id: '',
  brand: '',
  is_active: '',
  min_price: '',
  max_price: '',
}

export function useProductsAdmin({ debouncedSearch, showToast, initialQuery = DEFAULT_PRODUCT_QUERY }) {
  const [productQuery, setProductQuery] = useState(initialQuery)
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsPagination, setProductsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const productsRef = useRef(products)
  const inFlightRequestRef = useRef(null)
  const latestRequestIdRef = useRef(0)

  useEffect(() => {
    productsRef.current = products
  }, [products])

  const fetchProducts = useCallback(async () => {
    const requestKey = JSON.stringify({ search: debouncedSearch, ...productQuery })
    if (inFlightRequestRef.current === requestKey) {
      if (import.meta.env.DEV) console.debug('[useProductsAdmin] skipping duplicate request', requestKey)
      return
    }

    inFlightRequestRef.current = requestKey
    const requestId = ++latestRequestIdRef.current
    setProductsLoading(true)
    try {
      const res = await adminApi.getProducts({ search: debouncedSearch, ...productQuery })
      if (latestRequestIdRef.current !== requestId) return
      const newData = res.data || []
      if (JSON.stringify(productsRef.current) !== JSON.stringify(newData)) {
        productsRef.current = newData
        setProducts(newData)
      }
      setProductsPagination(res.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 })
    } catch (e) {
      if (latestRequestIdRef.current === requestId) showToast(e.message, 'error')
    } finally {
      if (latestRequestIdRef.current === requestId) setProductsLoading(false)
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = null
      }
    }
  }, [debouncedSearch, productQuery, showToast])

  return {
    products,
    productsLoading,
    productsPagination,
    productQuery,
    setProductQuery,
    fetchProducts,
  }
}
