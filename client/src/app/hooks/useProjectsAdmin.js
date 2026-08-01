import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useProjectsAdmin({ debouncedSearch, showToast }) {
  const [projects, setProjects] = useState([])
  const [projectsPagination, setProjectsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const projectsRef = useRef(projects)
  const inFlightRequestRef = useRef(null)

  useEffect(() => {
    projectsRef.current = projects
  }, [projects])

  const fetchProjects = useCallback(async (queryParams = {}) => {
    const requestKey = JSON.stringify({ search: debouncedSearch, include_tasks: true, ...queryParams })
    if (inFlightRequestRef.current === requestKey) {
      if (import.meta.env.DEV) console.debug('[useProjectsAdmin] skipping duplicate request', requestKey)
      return
    }

    inFlightRequestRef.current = requestKey

    try {
      const res = await adminApi.getProjects({ search: debouncedSearch, include_tasks: true, ...queryParams })
      const newData = Array.isArray(res.data) ? res.data : res.data?.projects || []
      if (JSON.stringify(projectsRef.current) !== JSON.stringify(newData)) {
        projectsRef.current = newData
        setProjects(newData)
      }
      setProjectsPagination(res.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = null
      }
    }
  }, [debouncedSearch, showToast])

  return {
    projects,
    projectsPagination,
    fetchProjects,
    setProjects,
    setProjectsPagination,
  }
}
