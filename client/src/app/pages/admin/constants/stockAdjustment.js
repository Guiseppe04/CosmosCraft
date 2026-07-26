import { ArrowUpCircle, ArrowDownCircle, ArrowUpDown } from 'lucide-react'

export const ADJUSTMENT_TYPE_LABELS = {
  stock_in: { label: 'Stock In (Add)', color: 'text-green-400', bg: 'bg-green-500/20', icon: ArrowUpCircle },
  stock_out: { label: 'Stock Out (Remove)', color: 'text-red-400', bg: 'bg-red-500/20', icon: ArrowDownCircle },
  adjustment: { label: 'Manual Set', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: ArrowUpDown },
}