import { motion, AnimatePresence } from 'motion/react'

export default function TermsAndConditionsModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="border-b border-slate-200 px-6 py-5 flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">
                Terms and Conditions
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 rounded-full border border-slate-200 bg-slate-100 p-2.5 text-slate-500 transition-colors duration-200 hover:bg-slate-200"
            >
              X
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-5 text-sm text-slate-600">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="font-semibold text-amber-900">
                Custom builds require a 50% down payment before production begins.
              </p>
            </div>

            <section>
              <h4 className="font-bold text-slate-900">Project Scope</h4>
              <p className="mt-2">
                Each custom build is made to order based on approved specs.
              </p>
            </section>

            {/* Keep rest of your sections */}
          </div>

          {/* Footer */}
          <div className="border-t bg-slate-50 px-6 py-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-3"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
