import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'

/**
 * WebSocket Context for Real-time Messaging
 * Provides real-time communication between admin/staff and customers
 */

const WebSocketContext = createContext(null)

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws'

/**
 * WebSocket Provider Component
 * Wrap your app with this to enable real-time messaging
 */
export function WebSocketProvider({ children, userId, userRole }) {
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState({}) // { orderId/projectId: messages[] }
  const [unreadCounts, setUnreadCounts] = useState({}) // { orderId/projectId: count }
  const [typingUsers, setTypingUsers] = useState({}) // { orderId/projectId: userId[] }
  const [onlineUsers, setOnlineUsers] = useState([])
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(`${WS_URL}?userId=${userId}&role=${userRole}`)
      
      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        reconnectAttempts.current = 0
        
        // Send join message
        ws.send(JSON.stringify({
          type: 'join',
          userId,
          role: userRole,
        }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        
        // Attempt reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            console.log(`Reconnecting... (attempt ${reconnectAttempts.current})`)
            connect()
          }, delay)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }, [userId, userRole])

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((data) => {
    switch (data.type) {
      case 'message':
        // New message received
        setMessages((prev) => ({
          ...prev,
          [data.conversationId]: [
            ...(prev[data.conversationId] || []),
            data.message,
          ],
        }))
        
        // Increment unread count if not viewing this conversation
        setUnreadCounts((prev) => ({
          ...prev,
          [data.conversationId]: (prev[data.conversationId] || 0) + 1,
        }))
        
        // Emit custom event for sound notification
        window.dispatchEvent(new CustomEvent('newMessage', { detail: data }))
        break

      case 'message_read':
        // Mark message as read
        setMessages((prev) => ({
          ...prev,
          [data.conversationId]: (prev[data.conversationId] || []).map((msg) =>
            msg.id === data.messageId ? { ...msg, status: 'read' } : msg
          ),
        }))
        break

      case 'typing':
        // User is typing
        setTypingUsers((prev) => ({
          ...prev,
          [data.conversationId]: data.users,
        }))
        break

      case 'user_online':
        // User came online
        setOnlineUsers((prev) => [...new Set([...prev, data.userId])])
        break

      case 'user_offline':
        // User went offline
        setOnlineUsers((prev) => prev.filter((id) => id !== data.userId))
        break

      case 'conversation_update':
        // Order/Project status update
        window.dispatchEvent(new CustomEvent('conversationUpdate', { detail: data }))
        break

      case 'notification':
        // General notification
        window.dispatchEvent(new CustomEvent('notification', { detail: data }))
        break

      default:
        console.log('Unknown WebSocket message type:', data.type)
    }
  }, [])

  // Send message
  const sendMessage = useCallback((conversationId, text, conversationType = 'order') => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected')
      return false
    }

    const message = {
      type: 'message',
      conversationId,
      conversationType,
      sender: {
        id: userId,
        role: userRole,
      },
      text,
      timestamp: new Date().toISOString(),
    }

    wsRef.current.send(JSON.stringify(message))
    return true
  }, [userId, userRole])

  // Send typing indicator
  const sendTyping = useCallback((conversationId, isTyping) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({
      type: isTyping ? 'typing_start' : 'typing_stop',
      conversationId,
      userId,
    }))
  }, [userId])

  // Mark conversation as read
  const markAsRead = useCallback((conversationId) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({
      type: 'mark_read',
      conversationId,
      userId,
    }))

    setUnreadCounts((prev) => ({
      ...prev,
      [conversationId]: 0,
    }))
  }, [userId])

  // Join a conversation room
  const joinConversation = useCallback((conversationId) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({
      type: 'join_conversation',
      conversationId,
    }))
  }, [])

  // Leave a conversation room
  const leaveConversation = useCallback((conversationId) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({
      type: 'leave_conversation',
      conversationId,
    }))
  }, [])

  // Get total unread count
  const getTotalUnread = useCallback(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)
  }, [unreadCounts])

  // Connect on mount
  useEffect(() => {
    if (userId) {
      connect()
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [userId, connect])

  const value = {
    isConnected,
    messages,
    unreadCounts,
    typingUsers,
    onlineUsers,
    sendMessage,
    sendTyping,
    markAsRead,
    joinConversation,
    leaveConversation,
    getTotalUnread,
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

/**
 * useWebSocket Hook
 * Access WebSocket functions from anywhere in your app
 */
export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

/**
 * useConversation Hook
 * Manage a specific conversation
 */
export function useConversation(conversationId, initialMessages = []) {
  const { 
    messages, 
    unreadCounts, 
    typingUsers, 
    sendMessage, 
    sendTyping, 
    markAsRead,
    joinConversation,
    leaveConversation,
  } = useWebSocket()

  const [localMessages, setLocalMessages] = useState(initialMessages)
  const conversationMessages = messages[conversationId] || localMessages
  const unreadCount = unreadCounts[conversationId] || 0
  const typing = typingUsers[conversationId] || []

  // Merge local and WebSocket messages
  useEffect(() => {
    if (messages[conversationId]) {
      setLocalMessages(messages[conversationId])
    }
  }, [conversationId, messages])

  // Join conversation on mount
  useEffect(() => {
    if (conversationId) {
      joinConversation(conversationId)
      markAsRead(conversationId)
    }

    return () => {
      if (conversationId) {
        leaveConversation(conversationId)
      }
    }
  }, [conversationId, joinConversation, leaveConversation, markAsRead])

  const send = useCallback((text) => {
    sendMessage(conversationId, text)
  }, [conversationId, sendMessage])

  return {
    messages: conversationMessages,
    unreadCount,
    typingUsers: typing,
    sendMessage: send,
    sendTyping: (isTyping) => sendTyping(conversationId, isTyping),
    markAsRead: () => markAsRead(conversationId),
  }
}

export default WebSocketProvider
