import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useUsersAdmin({ debouncedSearch, showToast }) {
  const [users, setUsers] = useState([])
  const usersRef = useRef(users)
  const inFlightRequestRef = useRef(null)

  useEffect(() => {
    usersRef.current = users
  }, [users])

  const fetchUsers = useCallback(async () => {
    const requestKey = JSON.stringify({ search: debouncedSearch })
    if (inFlightRequestRef.current === requestKey) {
      if (import.meta.env.DEV) console.debug('[useUsersAdmin] skipping duplicate request', requestKey)
      return
    }

    inFlightRequestRef.current = requestKey

    try {
      const res = await adminApi.getUsers({ search: debouncedSearch })
      const newData = Array.isArray(res.data) ? res.data : res.data?.users || []
      if (JSON.stringify(usersRef.current) !== JSON.stringify(newData)) {
        usersRef.current = newData
        setUsers(newData)
      }
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = null
      }
    }
  }, [debouncedSearch, showToast])

  return {
    users,
    fetchUsers,
  }
}
