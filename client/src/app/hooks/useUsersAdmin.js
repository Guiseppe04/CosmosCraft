import { useState, useCallback } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useUsersAdmin({ debouncedSearch, showToast }) {
  const [users, setUsers] = useState([])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await adminApi.getUsers({ search: debouncedSearch })
      const newData = Array.isArray(res.data) ? res.data : res.data?.users || []
      updateIfChanged(users, newData, setUsers)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [debouncedSearch, showToast, users])

  return {
    users,
    fetchUsers,
  }
}
