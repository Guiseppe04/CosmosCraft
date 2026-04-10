import { useEffect, useRef, useCallback } from 'react'

/**
 * useSmartPolling
 *
 * Intelligent polling hook with:
 * - Page Visibility API: pauses when tab is hidden, resumes when visible
 * - Exponential backoff: increases interval when no new data is received
 * - Auto-reset: resets interval back to base when new data arrives
 * - Immediate first call on mount
 *
 * @param {Function} fetchFn - async function to call; should return the fetched data
 * @param {Object} options
 * @param {number}  options.interval      - Base polling interval in ms (default: 5000)
 * @param {number}  options.maxInterval   - Maximum interval after backoff in ms (default: 60000)
 * @param {number}  options.backoffFactor - Multiplier applied on no-new-data (default: 1.5)
 * @param {boolean} options.enabled       - Whether polling is active (default: true)
 */
export function useSmartPolling(fetchFn, {
  interval = 5000,
  maxInterval = 60000,
  backoffFactor = 1.5,
  enabled = true,
} = {}) {
  const timerRef = useRef(null)
  const currentIntervalRef = useRef(interval)
  const lastDataRef = useRef(null)
  const fetchFnRef = useRef(fetchFn)

  // Keep fetchFn ref current without triggering re-mounts
  useEffect(() => { fetchFnRef.current = fetchFn }, [fetchFn])

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      // If tab is hidden, skip the fetch and keep the same interval
      if (document.visibilityState === 'hidden') {
        scheduleNext()
        return
      }

      try {
        const newData = await fetchFnRef.current()

        // Detect if data changed (compare JSON snapshot)
        const newSnapshot = JSON.stringify(newData)
        if (lastDataRef.current !== null && newSnapshot === lastDataRef.current) {
          // No change → apply backoff
          currentIntervalRef.current = Math.min(
            currentIntervalRef.current * backoffFactor,
            maxInterval
          )
        } else {
          // New data → reset to base interval
          currentIntervalRef.current = interval
        }
        lastDataRef.current = newSnapshot
      } catch {
        // On error apply backoff too
        currentIntervalRef.current = Math.min(
          currentIntervalRef.current * backoffFactor,
          maxInterval
        )
      }

      scheduleNext()
    }, currentIntervalRef.current)
  }, [interval, maxInterval, backoffFactor])

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    // Reset interval on mount / re-enable
    currentIntervalRef.current = interval
    lastDataRef.current = null

    // Immediate first call
    fetchFnRef.current().catch(() => {})

    // Then schedule subsequent polls
    scheduleNext()

    // Resume / pause on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible → fetch immediately and restart schedule
        currentIntervalRef.current = interval
        if (timerRef.current) clearTimeout(timerRef.current)
        fetchFnRef.current().catch(() => {})
        scheduleNext()
      }
      // If hidden, the timer's own guard will skip the fetch
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, interval, scheduleNext])
}
