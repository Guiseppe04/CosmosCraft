import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

/**
 * ConfirmModal — Branded, animated confirmation dialog that replaces browser confirm()
 *
 * @param {boolean}  open         - Whether the modal is visible
 * @param {string}   title        - Heading text
 * @param {string}   description  - Body description
 * @param {string}   confirmLabel - Label on the confirm button (default: 'Confirm')
 * @param {string}   cancelLabel  - Label on the cancel button  (default: 'Cancel')
 * @param {'danger'|'warning'|'info'} variant - Visual variant (default: 'danger')
 * @param {boolean}  isBusy       - Shows spinner on confirm button while processing
 * @param {Function} onConfirm    - Called when user clicks confirm
 * @param {Function} onCancel     - Called when user clicks cancel or backdrop
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isBusy = false,
  onConfirm,
  onCancel,
}) {
  const cancelButtonRef = useRef(null)
  const variants = {
    danger: {
      icon: AlertTriangle,
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-400',
      btnCls: 'bg-red-500 hover:bg-red-600 text-white',
      borderAccent: 'border-red-500/30',
    },
    warning: {
      icon: AlertCircle,
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      btnCls: 'bg-amber-500 hover:bg-amber-600 text-black',
      borderAccent: 'border-amber-500/30',
    },
    info: {
      icon: Info,
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      btnCls: 'bg-blue-500 hover:bg-blue-600 text-white',
      borderAccent: 'border-blue-500/30',
    },
  }

  const config = variants[variant] || variants.danger
  const Icon = config.icon

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel?.()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    cancelButtonRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onCancel])

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onCancel?.() }}
        >
          <motion.div
            key="confirm-panel"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          aria-describedby="confirm-modal-description"
          className={`relative bg-[var(--surface-dark)] border ${config.borderAccent} rounded-3xl p-8 w-full max-w-md shadow-2xl`}
        >
            {/* Close X */}
            <button
              onClick={onCancel}
              className="absolute top-5 right-5 p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center mb-5`}>
              <Icon className={`w-7 h-7 ${config.iconColor}`} />
            </div>

            {/* Content */}
            <h3 id="confirm-modal-title" className="text-white text-xl font-bold mb-2">{title}</h3>
            {description && (
              <p id="confirm-modal-description" className="text-[var(--text-muted)] text-sm leading-relaxed mb-7">{description}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                ref={cancelButtonRef}
                onClick={onCancel}
                disabled={isBusy}
                className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-medium text-sm hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={isBusy}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${config.btnCls}`}
              >
                {isBusy && (
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                )}
                {isBusy ? 'Processing...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') {
    return modalContent
  }

  return createPortal(modalContent, document.body)
}
