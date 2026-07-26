import { motion } from 'motion/react'

const currentBgColors = {
  healthy: 'bg-green-500/20 text-green-400',
  warning: 'bg-amber-500/20 text-amber-400',
  critical: 'bg-red-500/20 text-red-400',
}

export function StockVisualizer({ currentStock, newStock, threshold = 10, showDelta = true }) {
  const delta = newStock - currentStock
  const isIncrease = delta > 0
  const isDecrease = delta < 0
  const isNormal = currentStock > threshold * 2
  const isWarning = currentStock > 0 && currentStock <= threshold * 2
  const isCritical = currentStock === 0

  const currentColor = isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500'
  const currentTextColor = isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-green-400'

  const newColor = isIncrease ? 'bg-green-500' : isDecrease ? 'bg-red-500' : currentColor
  const deltaColor = isIncrease ? 'text-green-400' : isDecrease ? 'text-red-400' : 'text-white'

  const maxStock = Math.max(currentStock, newStock, threshold * 3, 50)
  const currentPct = Math.min((currentStock / maxStock) * 100, 100)
  const newPct = Math.min((newStock / maxStock) * 100, 100)

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Current</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${currentBgColors[isCritical ? 'critical' : isWarning ? 'warning' : 'healthy']}`}>
            {isCritical ? 'Out of Stock' : isWarning ? 'Low Stock' : 'In Stock'}
          </span>
        </div>
        <div className={`text-3xl font-bold ${currentTextColor}`}>{currentStock}</div>
        <div className={`h-2 rounded-full overflow-hidden ${currentColor}/30`}>
          <motion.div
            className={`h-full ${currentColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${currentPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {showDelta && newStock !== currentStock && (
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          key={newStock}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">New Stock</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isIncrease ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isIncrease ? `+${delta}` : delta}
            </span>
          </div>
          <div className={`text-3xl font-bold ${deltaColor}`}>{newStock}</div>
          <div className="h-2 rounded-full overflow-hidden bg-gray-700">
            <motion.div
              className={`h-full ${newColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${newPct}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default StockVisualizer
