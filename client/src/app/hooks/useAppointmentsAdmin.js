import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useAppointmentsAdmin({ debouncedSearch, showToast }) {
  const [appointments, setAppointments] = useState([])
  const [appointmentPagination, setAppointmentPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [appointmentLoading, setAppointmentLoading] = useState(false)
  const [unavailableDates, setUnavailableDates] = useState([])
  const appointmentsRef = useRef(appointments)
  const unavailableDatesRef = useRef(unavailableDates)
  const inFlightRequestRef = useRef(null)

  useEffect(() => {
    appointmentsRef.current = appointments
  }, [appointments])

  useEffect(() => {
    unavailableDatesRef.current = unavailableDates
  }, [unavailableDates])

  const fetchAppointments = useCallback(async () => {
    const requestKey = JSON.stringify({ search: debouncedSearch, limit: appointmentPagination.limit, offset: (appointmentPagination.page - 1) * appointmentPagination.limit })
    if (inFlightRequestRef.current === requestKey) {
      if (import.meta.env.DEV) console.debug('[useAppointmentsAdmin] skipping duplicate request', requestKey)
      return
    }

    inFlightRequestRef.current = requestKey
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
      if (JSON.stringify(appointmentsRef.current) !== JSON.stringify(newData)) {
        appointmentsRef.current = newData
        setAppointments(newData)
      }
      setAppointmentPagination(prev => ({ ...prev, total, pages }))
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setAppointmentLoading(false)
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = null
      }
    }
  }, [debouncedSearch, showToast, appointmentPagination.limit, appointmentPagination.page])

  const fetchUnavailableDates = useCallback(async () => {
    try {
      const res = await adminApi.getUnavailableDates()
      const newData = res.data?.unavailable_dates || []
      if (JSON.stringify(unavailableDatesRef.current) !== JSON.stringify(newData)) {
        unavailableDatesRef.current = newData
        setUnavailableDates(newData)
      }
    } catch (e) {
      console.error('Failed to fetch unavailable dates:', e)
    }
  }, [])

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
