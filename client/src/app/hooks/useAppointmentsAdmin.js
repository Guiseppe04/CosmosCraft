import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'
import { useDebounce } from './useDebounce'

export function useAppointmentsAdmin({ debouncedSearch: externalDebouncedSearch, showToast } = {}) {
  const [search, setSearch] = useState('')
  const debouncedSearchInternal = useDebounce(search, 300)
  const debouncedSearch = externalDebouncedSearch !== undefined ? externalDebouncedSearch : debouncedSearchInternal
  const [appointments, setAppointments] = useState([])
  const [calendarAppointments, setCalendarAppointments] = useState([])
  const [appointmentPagination, setAppointmentPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [appointmentLoading, setAppointmentLoading] = useState(false)
  const [unavailableDates, setUnavailableDates] = useState([])
  const [availableDates, setAvailableDates] = useState([])
  const appointmentsRef = useRef(appointments)
  const calendarAppointmentsRef = useRef(calendarAppointments)
  const unavailableDatesRef = useRef(unavailableDates)
  const availableDatesRef = useRef(availableDates)
  const inFlightRequestRef = useRef(null)
  const latestRequestIdRef = useRef(0)
  const inFlightCalendarRef = useRef(false)

  useEffect(() => {
    appointmentsRef.current = appointments
  }, [appointments])

  useEffect(() => {
    calendarAppointmentsRef.current = calendarAppointments
  }, [calendarAppointments])

  useEffect(() => {
    unavailableDatesRef.current = unavailableDates
  }, [unavailableDates])

  useEffect(() => {
    availableDatesRef.current = availableDates
  }, [availableDates])

  const fetchAppointments = useCallback(async (options = {}) => {
    const { silent = false } = options
    const requestKey = JSON.stringify({
      search: debouncedSearch,
      limit: appointmentPagination.limit,
      offset: (appointmentPagination.page - 1) * appointmentPagination.limit,
    })
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
        sort_by: 'created_at',
        sort_order: 'desc',
      }
      const res = await adminApi.getAppointments(params)
      if (latestRequestIdRef.current !== requestId) return appointmentsRef.current

      const newData = Array.isArray(res.data) ? res.data : res.data?.appointments || []
      const total = res.data?.pagination?.total ?? newData.length
      const pages = (res.data?.pagination?.pages ?? Math.ceil(total / appointmentPagination.limit)) || 1

      // ── Bug 1 fix: clamp page if the current page is out of range ──────────
      // This can happen when the dataset shrinks (e.g. a cancellation) while
      // the user is on a later page. The API returns an empty array for an
      // out-of-range offset, and without this guard the empty result would
      // permanently overwrite the real appointments in state.
      if (appointmentPagination.page > pages && newData.length === 0 && total > 0) {
        if (import.meta.env.DEV) {
          console.debug('[useAppointmentsAdmin] page out of range — clamping to', pages)
        }
        inFlightRequestRef.current = null
        setAppointmentPagination((prev) => ({ ...prev, page: pages, pages, total }))
        return appointmentsRef.current // preserve existing cached list
      }

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

  // ── Bug 2 fix: separate, unpaginated fetch for the calendar ───────────────
  // The paginated `appointments` list only contains one page (≤20 rows), so
  // the calendar would never display appointments from other pages.
  // This function fetches up to 1000 appointments regardless of the table
  // page and feeds them to the calendar only.
  const fetchCalendarAppointments = useCallback(async () => {
    if (inFlightCalendarRef.current) return calendarAppointmentsRef.current
    inFlightCalendarRef.current = true
    try {
      const res = await adminApi.getAppointments({
        search: debouncedSearch,
        limit: 500,
        offset: 0,
        sort_by: 'scheduled_at',
        sort_order: 'asc',
      })
      const newData = Array.isArray(res.data) ? res.data : res.data?.appointments || []
      if (JSON.stringify(calendarAppointmentsRef.current) !== JSON.stringify(newData)) {
        calendarAppointmentsRef.current = newData
        setCalendarAppointments(newData)
      }
      return newData
    } catch (e) {
      if (import.meta.env.DEV) console.error('[useAppointmentsAdmin] calendar fetch failed:', e)
      return calendarAppointmentsRef.current
    } finally {
      inFlightCalendarRef.current = false
    }
  }, [debouncedSearch])

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
    calendarAppointments,
    appointmentPagination,
    appointmentLoading,
    unavailableDates,
    availableDates,
    search,
    setSearch,
    setAppointments,
    setAppointmentPagination,
    fetchAppointments,
    fetchCalendarAppointments,
    fetchUnavailableDates,
    fetchAvailableDates,
  }
}
