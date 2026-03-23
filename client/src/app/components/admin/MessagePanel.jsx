import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Send,
  X,
  Paperclip,
  Image,
  Smile,
  MoreVertical,
  Check,
  CheckCheck,
  Phone,
  Video,
  Info,
  Search,
  ArrowLeft,
} from 'lucide-react'

/**
 * MessagePanel Component for Customer Communication
 * Provides chat-style interface for admin/staff to communicate with customers
 */
export function MessagePanel({
  isOpen,
  onClose,
  orderId,
  customerName,
  customerEmail,
  initialMessages = [],
  onSendMessage,
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSend = () => {
    if (!newMessage.trim()) return

    const message = {
      id: Date.now(),
      sender: 'staff', // Could be 'admin', 'staff', or 'customer'
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent',
    }

    setMessages((prev) => [...prev, message])
    setNewMessage('')

    // Call parent callback if provided
    if (onSendMessage) {
      onSendMessage(message)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
      })
    }
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.timestamp)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(message)
    return groups
  }, {})

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full lg:w-[450px] bg-[var(--surface-dark)] border-l border-[var(--border)] z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors duration-200 lg:hidden"
                >
                  <ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center">
                  <span className="text-[var(--text-dark)] font-bold text-lg">
                    {customerName?.charAt(0) || 'C'}
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-semibold">{customerName || 'Customer'}</h3>
                  <p className="text-[var(--text-muted)] text-sm">{customerEmail || 'customer@email.com'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors duration-200">
                  <Phone className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
                <button className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors duration-200">
                  <Video className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className={`p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors duration-200 ${
                    showInfo ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]' : ''
                  }`}
                >
                  <Info className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors duration-200">
                  <X className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>

            {/* Order Info Banner */}
            <div className="px-4 py-2 bg-[var(--bg-primary)] border-b border-[var(--border)]">
              <p className="text-sm text-[var(--text-muted)]">
                Order: <span className="text-[var(--gold-primary)] font-mono">{orderId}</span>
              </p>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {Object.keys(groupedMessages).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-full bg-[var(--bg-primary)] flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-[var(--text-muted)]" />
                  </div>
                  <h3 className="text-white font-medium mb-2">No messages yet</h3>
                  <p className="text-[var(--text-muted)] text-sm">
                    Start the conversation by sending a message below
                  </p>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([date, dateMessages]) => (
                  <div key={date}>
                    {/* Date Separator */}
                    <div className="flex items-center gap-4 my-4">
                      <div className="flex-1 h-px bg-[var(--border)]" />
                      <span className="text-xs text-[var(--text-muted)] px-2">{date}</span>
                      <div className="flex-1 h-px bg-[var(--border)]" />
                    </div>

                    {/* Messages */}
                    {dateMessages.map((message) => {
                      const isOwn = message.sender === 'staff' || message.sender === 'admin'
                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              isOwn
                                ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-br-md'
                                : 'bg-[var(--bg-primary)] text-white rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                            <div
                              className={`flex items-center gap-2 mt-1 ${
                                isOwn ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <span className={`text-xs ${isOwn ? 'text-[var(--text-dark)]/70' : 'text-[var(--text-muted)]'}`}>
                                {formatTime(message.timestamp)}
                              </span>
                              {isOwn && (
                                message.status === 'read' ? (
                                  <CheckCheck className="w-3 h-3 text-[var(--text-dark)]/70" />
                                ) : (
                                  <Check className="w-3 h-3 text-[var(--text-dark)]/70" />
                                )
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            {messages.length === 0 && (
              <div className="px-4 pb-2">
                <p className="text-xs text-[var(--text-muted)] mb-2">Quick replies:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Order received!',
                    'Production started',
                    'Quality check passed',
                    'Ready for pickup',
                  ].map((reply) => (
                    <button
                      key={reply}
                      onClick={() => setNewMessage(reply)}
                      className="px-3 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border)] rounded-full text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors duration-200"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-[var(--border)]">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your message..."
                    rows={1}
                    className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-transparent resize-none transition-all duration-200"
                    style={{
                      minHeight: '48px',
                      maxHeight: '120px',
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-3 hover:bg-[var(--bg-primary)] rounded-xl transition-colors duration-200">
                    <Paperclip className="w-5 h-5 text-[var(--text-muted)]" />
                  </button>
                  <button className="p-3 hover:bg-[var(--bg-primary)] rounded-xl transition-colors duration-200">
                    <Image className="w-5 h-5 text-[var(--text-muted)]" />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim()}
                    className="p-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                  >
                    <Send className="w-5 h-5 text-[var(--text-dark)]" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/**
 * Compact Message Preview Component
 * Shows latest message in a list/table format
 */
export function MessagePreview({ message, customerName, orderId, onClick }) {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-primary)] transition-colors duration-200 text-left"
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center flex-shrink-0">
        <span className="text-[var(--text-dark)] font-bold">
          {customerName?.charAt(0) || 'C'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-white font-medium truncate">{customerName}</p>
          <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)] truncate">{message.text}</p>
        {orderId && (
          <p className="text-xs text-[var(--gold-primary)] mt-1">Order: {orderId}</p>
        )}
      </div>
      {message.unread && (
        <div className="w-2 h-2 bg-[var(--gold-primary)] rounded-full flex-shrink-0" />
      )}
    </button>
  )
}

export default MessagePanel
