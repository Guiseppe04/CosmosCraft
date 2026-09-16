import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useAppointmentsAdmin({ debouncedSearch, showToast }) {
  const [appointments, setAppointments] = useState([])
  const [appointmentPagination, setAppointmentPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [appointmentLoading, setAppointmentLoading] = useState(false)
  const [unavailableDates, setUnavailableDates] = useState([])
  const [availableDates, setAvailableDates] = useState([])
  const appointmentsRef = useRef(appointments)
  const unavailableDatesRef = useRef(unavailableDates)
  const availableDatesRef = useRef(availableDates)
  const inFlightRequestRef = useRef(null)
  const latestRequestIdRef = useRef(0)

  useEffect(() => {
    appointmentsRef.current = appointments
  }, [appointments])

  useEffect(() => {
    unavailableDatesRef.current = unavailableDates
  }, [unavailableDates])

  useEffect(() => {
    availableDatesRef.current = availableDates
  }, [availableDates])

  const fetchAppointments = useCallback(async (options = {}) => {
    const { silent = false } = options
    const requestKey = JSON.stringify({ search: debouncedSearch, limit: appointmentPagination.limit, offset: (appointmentPagination.page - 1) * appointmentPagination.limit })
    if (inFlightRequestRef.current === requestKey) {
      if (import.meta.env.DEV) console.debug('[useAppointmentsAdmin] skipping duplicate request', requestKey)
      return appointmentsRef.current
    }

    inFlightRequestRef.current = requestKey
    const requestId = ++latestRequestIdRef.current
    if (!silent) setAppointmentLoading(true)
    try {
      const params = {
        search: debouncedSearch,
        limit: appointmentPagination.limit,
        offset: (appointmentPagination.page - 1) * appointmentPagination.limit,
      }
      const res = await adminApi.getAppointments(params)
      if (latestRequestIdRef.current !== requestId) return appointmentsRef.current
      const newData = Array.isArray(res.data) ? res.data : res.data?.appointments || []
      const total = res.data?.pagination?.total || newData.length
      const pages = res.data?.pagination?.pages || Math.ceil(total / appointmentPagination.limit)
      if (JSON.stringify(appointmentsRef.current) !== JSON.stringify(newData)) {
        appointmentsRef.current = newData
        setAppointments(newData)
      }
      const newPagination = { ...appointmentPagination, total, pages }
      if (JSON.stringify(appointmentPagination) !== JSON.stringify(newPagination)) {
        setAppointmentPagination(newPagination)
      }
      return newData
    } catch (e) {
      if (!silent && latestRequestIdRef.current === requestId) showToast(e.message, 'error')
      throw e
    } finally {
      if (!silent && latestRequestIdRef.current === requestId) setAppointmentLoading(false)
      if (inFlightRequestRef.current === requestKey) {
        inFlightRequestRef.current = null
      }
    }
  }, [debouncedSearch, showToast, appointmentPagination])

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

  const fetchAvailableDates = useCallback(async (dateFrom, dateTo) => {
    try {
      const today = new Date()
      const from = dateFrom || today.toISOString().slice(0, 10)
      const to = dateTo || new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const res = await adminApi.getAvailableDates(from, to)
      const newData = res.data?.available_dates || []
      if (JSON.stringify(availableDatesRef.current) !== JSON.stringify(newData)) {
        availableDatesRef.current = newData
        setAvailableDates(newData)
      }
    } catch (e) {
      console.error('Failed to fetch available dates:', e)
    }
  }, [])

  return {
    appointments,
    appointmentPagination,
    appointmentLoading,
    unavailableDates,
    availableDates,
    setAppointments,
    setAppointmentPagination,
    fetchAppointments,
    fetchUnavailableDates,
    fetchAvailableDates,
  }
}
