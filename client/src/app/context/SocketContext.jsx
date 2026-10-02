import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { io } from 'socket.io-client'

import { API, getAuthToken } from '../utils/apiConfig'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth()

  const socketRef = useRef(null)

  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    /**
     * Do not create a Socket.IO connection when the
     * user is not authenticated.
     */
    if (!isAuthenticated || !user?.id) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }

      setIsConnected(false)

      return
    }

    /**
     * Socket.IO server URL
     *
     * Development:
     * VITE_SOCKET_URL=http://localhost:5000
     *
     * Production / Coolify:
     * VITE_SOCKET_URL=https://api.yourdomain.com
     *
     * Socket.IO URL must NOT contain /api.
     */
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      API.replace(/\/api\/?$/, '') ||
      window.location.origin

    if (import.meta.env.DEV) {
      console.debug(
        '[Socket.IO] Server URL:',
        socketUrl
      )
    }

    /**
     * Get the current authentication token.
     */
    const token = getAuthToken()

    /**
     * Create Socket.IO connection.
     */
    const socketInstance = io(socketUrl, {
      /**
       * Send JWT through Socket.IO handshake.
       *
       * The backend also supports the accessToken
       * HTTP-only cookie as a fallback.
       */
      auth: {
        token: token || undefined,
      },

      /**
       * Required when using cookies across origins.
       */
      withCredentials: true,

      /**
       * Start with HTTP long-polling and allow
       * Socket.IO to upgrade to WebSocket.
       *
       * This is generally reliable behind Coolify's
       * reverse proxy.
       */
      transports: ['polling', 'websocket'],

      /**
       * Automatic reconnection.
       */
      reconnection: true,

      /**
       * Maximum number of reconnection attempts.
       */
      reconnectionAttempts: 10,

      /**
       * Initial reconnection delay.
       */
      reconnectionDelay: 1000,

      /**
       * Maximum reconnection delay.
       */
      reconnectionDelayMax: 5000,

      /**
       * Randomize reconnection delay slightly
       * to avoid simultaneous reconnects.
       */
      randomizationFactor: 0.5,
    })

    socketRef.current = socketInstance

    /**
     * Successfully connected.
     */
    socketInstance.on('connect', () => {
      setIsConnected(true)

      if (import.meta.env.DEV) {
        console.debug(
          '[Socket.IO] Connected:',
          socketInstance.id
        )
      }
    })

    /**
     * Connection closed.
     */
    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false)

      if (import.meta.env.DEV) {
        console.debug(
          '[Socket.IO] Disconnected:',
          reason
        )
      }
    })

    /**
     * Connection failed.
     */
    socketInstance.on('connect_error', (error) => {
      setIsConnected(false)

      if (import.meta.env.DEV) {
        console.debug(
          '[Socket.IO] Connection error:',
          error.message
        )
      }
    })

    /**
     * Socket reconnecting.
     */
    socketInstance.io.on('reconnect_attempt', (attempt) => {
      if (import.meta.env.DEV) {
        console.debug(
          '[Socket.IO] Reconnection attempt:',
          attempt
        )
      }
    })

    /**
     * Socket successfully reconnected.
     */
    socketInstance.io.on('reconnect', (attempt) => {
      if (import.meta.env.DEV) {
        console.debug(
          '[Socket.IO] Reconnected after attempt:',
          attempt
        )
      }

      setIsConnected(true)
    })

    /**
     * Reconnection failed completely.
     */
    socketInstance.io.on('reconnect_failed', () => {
      setIsConnected(false)

      if (import.meta.env.DEV) {
        console.debug(
          '[Socket.IO] Reconnection failed'
        )
      }
    })

    /**
     * Cleanup.
     *
     * This runs when:
     * - user logs out
     * - user changes
     * - authentication state changes
     * - SocketProvider unmounts
     */
    return () => {
      if (import.meta.env.DEV) {
        console.debug(
          '[Socket.IO] Cleaning up connection'
        )
      }

      socketInstance.removeAllListeners()

      socketInstance.io.removeAllListeners(
        'reconnect_attempt'
      )

      socketInstance.io.removeAllListeners(
        'reconnect'
      )

      socketInstance.io.removeAllListeners(
        'reconnect_failed'
      )

      socketInstance.disconnect()

      if (socketRef.current === socketInstance) {
        socketRef.current = null
      }

      setIsConnected(false)
    }
  }, [user?.id, isAuthenticated])

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

/**
 * Hook to access the Socket.IO instance.
 *
 * Usage:
 *
 * const { socket, isConnected } = useSocket()
 */
export function useSocket() {
  const context = useContext(SocketContext)

  return (
    context || {
      socket: null,
      isConnected: false,
    }
  )
}

/**
 * Subscribe to a Socket.IO event.
 *
 * Automatically removes the listener when:
 * - the component unmounts
 * - the socket changes
 * - the event name changes
 *
 * Usage:
 *
 * useSocketEvent('order_updated', (data) => {
 *   console.log(data)
 * })
 */
export function useSocketEvent(eventName, callback) {
  const { socket } = useSocket()

  const savedCallback = useRef(callback)

  /**
   * Always keep the latest callback.
   */
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  /**
   * Register Socket.IO event listener.
   */
  useEffect(() => {
    if (!socket || !eventName) {
      return
    }

    const handler = (...args) => {
      if (savedCallback.current) {
        savedCallback.current(...args)
      }
    }

    socket.on(eventName, handler)

    /**
     * Remove only this handler.
     */
    return () => {
      socket.off(eventName, handler)
    }
  }, [socket, eventName])
}