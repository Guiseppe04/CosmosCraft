import { useState, useCallback } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useCategoriesAdmin({ showToast }) {
  const [categories, setCategories] = useState([])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminApi.getCategories()
      const newData = Array.isArray(res.data) ? res.data : res.data?.categories || []
      updateIfChanged(categories, newData, setCategories)
    } catch (e) {
      showToast(e?.message || 'Failed to load categories', 'error')
    }
  }, [categories, showToast])

  return {
    categories,
    fetchCategories,
  }
}
