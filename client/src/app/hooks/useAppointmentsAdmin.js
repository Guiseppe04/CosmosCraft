import { useState, useCallback } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useAppointmentsAdmin({ debouncedSearch, showToast }) {
  const [appointments, setAppointments] = useState([])
  const [appointmentPagination, setAppointmentPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [appointmentLoading, setAppointmentLoading] = useState(false)
  const [unavailableDates, setUnavailableDates] = useState([])

  const fetchAppointments = useCallback(async () => {
    setAppointmentLoading(true)
    try {
      const params = {
        search: debouncedSearch,
        limit: appointmentPagination.limit,
        offset: (appointmentPagination.page - 1) * appointmentPagination.limit,
      }
      const res = await adminApi.getAppointments(params)
      const newData = Array.isArray(res.data) ? res.data : res.data?.appointments || []
      const total = res.data?.pagination?.total || newData.length
      const pages = res.data?.pagination?.pages || Math.ceil(total / appointmentPagination.limit)
      updateIfChanged(appointments, newData, setAppointments)
      setAppointmentPagination(prev => ({ ...prev, total, pages }))
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setAppointmentLoading(false)
    }
  }, [debouncedSearch, showToast, appointments, appointmentPagination.limit, appointmentPagination.page])

  const fetchUnavailableDates = useCallback(async () => {
    try {
      const res = await adminApi.getUnavailableDates()
      const newData = res.data?.unavailable_dates || []
      updateIfChanged(unavailableDates, newData, setUnavailableDates)
    } catch (e) {
      console.error('Failed to fetch unavailable dates:', e)
    }
  }, [unavailableDates])

  return {
    appointments,
    appointmentPagination,
    appointmentLoading,
    unavailableDates,
    setAppointments,
    setAppointmentPagination,
    fetchAppointments,
    fetchUnavailableDates,
  }
}
