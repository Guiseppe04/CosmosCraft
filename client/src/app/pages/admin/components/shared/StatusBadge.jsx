import { memo } from 'react'

export const StatusBadge = memo(function StatusBadge({ value, variant = 'default', className = '' }) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border'

  if (variant === 'active') {
    return <span className={`${base} bg-green-500/20 text-green-400 border-green-500/30 ${className}`}>Active</span>
  }

  if (variant === 'inactive') {
    return <span className={`${base} bg-gray-500/20 text-gray-400 border-gray-500/30 ${className}`}>Inactive</span>
  }

  if (variant === 'success') {
    return <span className={`${base} bg-green-500/20 text-green-400 border-green-500/30 ${className}`}>{value}</span>
  }

  return <span className={`${base} bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/30 ${className}`}>{value}</span>
})

export default StatusBadge
