import { createContext, forwardRef, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

/**
 * Toast Context for global toast notifications
 */
const ToastContext = createContext(null)

// Toast types configuration
const toastTypes = {
  success: {
    icon: CheckCircle,
    color: 'green',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    iconColor: 'text-green-400',
    textColor: 'text-green-400',
  },
  error: {
    icon: XCircle,
    color: 'red',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-400',
    textColor: 'text-red-400',
  },
  warning: {
    icon: AlertCircle,
    color: 'yellow',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    iconColor: 'text-yellow-400',
    textColor: 'text-yellow-400',
  },
  info: {
    icon: Info,
    color: 'blue',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-400',
    textColor: 'text-blue-400',
  },
}

/**
 * Toast Component
 * Individual toast notification with animation
 */
const Toast = forwardRef(function Toast({ toast, onDismiss }, ref) {
  const config = toastTypes[toast.type] || toastTypes.info
  const Icon = config.icon

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 p-4 ${config.bgColor} border ${config.borderColor} rounded-xl shadow-lg backdrop-blur-sm max-w-md w-full`}
    >
      <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`font-semibold text-sm ${config.textColor}`}>{toast.title}</p>
        )}
        <p className="text-white text-sm mt-0.5">{toast.message}</p>
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className={`text-sm font-medium ${config.textColor} hover:underline mt-2`}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-white/10 rounded transition-colors duration-200 flex-shrink-0"
      >
        <X className="w-4 h-4 text-[var(--text-muted)]" />
      </button>
    </motion.div>
  )
})

/**
 * Toast Container Component
 * Renders all active toasts
 */
function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * Toast Provider Component
 * Wrap your app with this to enable toast notifications
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    const newToast = {
      id,
      type: 'info',
      duration: 5000,
      ...toast,
    }

    setToasts((prev) => [...prev, newToast])

    // Auto dismiss after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, newToast.duration)
    }

    return id
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const clearAllToasts = useCallback(() => {
    setToasts([])
  }, [])

  // Convenience methods
  const toast = {
    show: addToast,
    success: (message, options = {}) => addToast({ type: 'success', message, ...options }),
    error: (message, options = {}) => addToast({ type: 'error', message, ...options }),
    warning: (message, options = {}) => addToast({ type: 'warning', message, ...options }),
    info: (message, options = {}) => addToast({ type: 'info', message, ...options }),
    dismiss: dismissToast,
    clear: clearAllToasts,
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast, clearAllToasts, toast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

/**
 * useToast Hook
 * Access toast functions from anywhere in your app
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

/**
 * Example usage:
 * 
 * import { useToast } from '../components/ui/Toast'
 * 
 * function MyComponent() {
 *   const { toast } = useToast()
 *   
 *   const handleSave = async () => {
 *     try {
 *       await saveData()
 *       toast.success('Data saved successfully!')
 *     } catch (error) {
 *       toast.error('Failed to save data')
 *     }
 *   }
 *   
 *   return <button onClick={handleSave}>Save</button>
 * }
 */

export default ToastProvider
