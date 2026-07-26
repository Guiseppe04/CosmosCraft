import { useState, useCallback } from 'react'
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

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const res = await adminApi.getProducts({ search: debouncedSearch, ...productQuery })
      updateIfChanged(products, res.data || [], setProducts)
      setProductsPagination(res.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setProductsLoading(false)
    }
  }, [debouncedSearch, productQuery, showToast, products])

  return {
    products,
    productsLoading,
    productsPagination,
    productQuery,
    setProductQuery,
    fetchProducts,
  }
}
