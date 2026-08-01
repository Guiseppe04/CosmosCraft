import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useCategoriesAdmin({ showToast }) {
  const [categories, setCategories] = useState([])
  const categoriesRef = useRef(categories)

  useEffect(() => {
    categoriesRef.current = categories
  }, [categories])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminApi.getCategories()
      const newData = Array.isArray(res.data) ? res.data : res.data?.categories || []
      if (JSON.stringify(categoriesRef.current) !== JSON.stringify(newData)) {
        categoriesRef.current = newData
        setCategories(newData)
      }
    } catch (e) {
      showToast(e?.message || 'Failed to load categories', 'error')
    }
  }, [showToast])

  return {
    categories,
    fetchCategories,
  }
}
