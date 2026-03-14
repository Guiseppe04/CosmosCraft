import { motion } from 'motion/react'
import { Clock, DollarSign } from 'lucide-react'

export function PricePanel({ totalPrice, estimatedDays }) {
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-6 space-y-4">
      {/* Content copied from fromFigma PricePanel.jsx */}
      <h3 className="text-lg font-semibold text-[var(--gold-primary)]">Summary</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-[var(--surface-elevated)] rounded-lg border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--gold-primary)]/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-[var(--gold-primary)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Total Price</p>
              <motion.p
                key={totalPrice}
                initial={{ scale: 1.1, color: 'var(--gold-accent)' }}
                animate={{ scale: 1, color: 'var(--text-light)' }}
                transition={{ duration: 0.3 }}
                className="text-2xl font-bold text-[var(--text-light)]"
              >
                ${totalPrice.toLocaleString()}
              </motion.p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-[var(--surface-elevated)] rounded-lg border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--gold-primary)]/10 rounded-lg">
              <Clock className="w-5 h-5 text-[var(--gold-primary)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Est. Completion</p>
              <p className="text-xl font-semibold text-[var(--text-light)]">{estimatedDays} days</p>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          All custom builds include premium materials, expert craftsmanship, and quality assurance testing.
        </p>
      </div>
    </div>
  )
}

