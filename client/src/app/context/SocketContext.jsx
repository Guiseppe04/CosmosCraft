import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { API, getAuthToken } from '../utils/apiConfig'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Resolve socket server base URL (strip any trailing /api if present)
    const socketUrl = API.replace(/\/api\/?$/, '') || window.location.origin
    const token = getAuthToken()

    const socketInstance = io(socketUrl, {
      auth: { token: token || undefined },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socketRef.current = socketInstance

    socketInstance.on('connect', () => {
      setIsConnected(true)
      if (import.meta.env.DEV) {
        console.debug('[Socket.IO] Connected:', socketInstance.id)
      }
    })

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false)
      if (import.meta.env.DEV) {
        console.debug('[Socket.IO] Disconnected:', reason)
      }
    })

    socketInstance.on('connect_error', (error) => {
      if (import.meta.env.DEV) {
        console.debug('[Socket.IO] Connection error:', error.message)
      }
    })

    return () => {
      socketInstance.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [user?.id, isAuthenticated])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

/**
 * Hook to access the raw Socket.IO instance
 */
export function useSocket() {
  const context = useContext(SocketContext)
  return context || { socket: null, isConnected: false }
}

/**
 * Hook to subscribe to any socket event with automatic cleanup
 */
export function useSocketEvent(eventName, callback) {
  const { socket } = useSocket()
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!socket || !eventName) return

    const handler = (...args) => {
      if (savedCallback.current) {
        savedCallback.current(...args)
      }
    }

    socket.on(eventName, handler)
    return () => {
      socket.off(eventName, handler)
    }
  }, [socket, eventName])
}
