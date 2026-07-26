import { useState, useCallback } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useProjectsAdmin({ debouncedSearch, showToast }) {
  const [projects, setProjects] = useState([])
  const [projectsPagination, setProjectsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })

  const fetchProjects = useCallback(async (queryParams = {}) => {
    try {
      const res = await adminApi.getProjects({ search: debouncedSearch, include_tasks: true, ...queryParams })
      const newData = Array.isArray(res.data) ? res.data : res.data?.projects || []
      updateIfChanged(projects, newData, setProjects)
      setProjectsPagination(res.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 })
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [debouncedSearch, showToast, projects])

  return {
    projects,
    projectsPagination,
    fetchProjects,
    setProjects,
    setProjectsPagination,
  }
}
