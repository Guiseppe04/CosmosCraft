import { useCallback, useEffect, useRef } from 'react'

/**
 * Collapse a burst of calls into a single invocation.
 *
 * Real-time notifications arrive in bursts: the no-show sweep publishes one
 * event per overdue appointment, and a single customer action can publish
 * several. Reacting to each one separately would fire one request per event, so
 * the last call of a burst wins and runs once.
 *
 * A pending call is dropped when the component unmounts, so nothing runs against
 * a component that is gone.
 *
 * Usage:
 *
 * const refreshAppointments = useDebouncedCallback(() => {
 *   fetchAppointments({ silent: true })
 * })
 */
export function useDebouncedCallback(callback, delay = 150) {
  const savedCallback = useRef(callback)
  const timeoutRef = useRef(null)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      savedCallback.current(...args)
    }, delay)
  }, [delay])
}