import { ArrowUpCircle, ArrowDownCircle, ArrowUpDown } from 'lucide-react'

export const ADJUSTMENT_REASONS = [
  { value: 'restocking', label: 'Restocking', group: 'Inventory', requiresNotes: false },
  { value: 'received_shipment', label: 'Received Shipment', group: 'Inventory', requiresNotes: false },
  { value: 'returned_items', label: 'Returned Items', group: 'Sales', requiresNotes: false },
  { value: 'sale_adjustment', label: 'Sales Reconciliation', group: 'Sales', requiresNotes: false },
  { value: 'damaged_goods', label: 'Damaged/Defective', group: 'Loss', requiresNotes: true },
  { value: 'lost_missing', label: 'Lost/Missing', group: 'Loss', requiresNotes: true },
  { value: 'cycle_count', label: 'Cycle Count Correction', group: 'Adjustment', requiresNotes: true },
  { value: 'transfer_in', label: 'Transfer In', group: 'Transfer', requiresNotes: true },
  { value: 'transfer_out', label: 'Transfer Out', group: 'Transfer', requiresNotes: true },
  { value: 'sample_item', label: 'Sample Item', group: 'Other', requiresNotes: true },
  { value: 'other', label: 'Other', group: 'Other', requiresNotes: true },
]

export const ADJUSTMENT_TYPE_LABELS = {
  stock_in: { label: 'Stock In (Add)', color: 'text-green-400', bg: 'bg-green-500/20', icon: ArrowUpCircle },
  stock_out: { label: 'Stock Out (Remove)', color: 'text-red-400', bg: 'bg-red-500/20', icon: ArrowDownCircle },
  adjustment: { label: 'Manual Set', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: ArrowUpDown },
}
