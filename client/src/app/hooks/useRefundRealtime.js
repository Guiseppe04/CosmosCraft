import { useSocketEvent } from '../context/SocketContext'
import { useDebouncedCallback } from './useDebouncedCallback'

// Re-read authorized API data, rather than sending private payment details over sockets.
export function useRefundRealtime(refresh) {
  const scheduleRefresh = useDebouncedCallback(refresh)
  useSocketEvent('refund:created', scheduleRefresh)
  useSocketEvent('refund:updated', scheduleRefresh)
  // Events sent while disconnected must be reconciled after reconnecting.
  useSocketEvent('connect', scheduleRefresh)
  return scheduleRefresh
}
