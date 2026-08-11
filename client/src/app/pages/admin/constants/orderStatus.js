import { getPaymentStatusConfig as getOrderPaymentStatusConfig } from '../../../utils/orderPaymentStatus'

export const ORDER_STATUS_LIFECYCLE = [
  { value: 'pending', label: 'Pending', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/30', step: 0, stepLabel: 'Order Placed' },
  { value: 'processing', label: 'Processing', color: '#60a5fa', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-blue-500/30', step: 1, stepLabel: 'Processing' },
  { value: 'shipped', label: 'Shipped', color: '#38bdf8', bgColor: 'bg-sky-500/20', textColor: 'text-sky-400', borderColor: 'border-sky-500/30', step: 2, stepLabel: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: '#818cf8', bgColor: 'bg-indigo-500/20', textColor: 'text-indigo-400', borderColor: 'border-indigo-500/30', step: 3, stepLabel: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered', color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-green-500/30', step: 4, stepLabel: 'Delivered' },
  { value: 'received', label: 'Received', color: '#34d399', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/30', step: 5, stepLabel: 'Received' },
  { value: 'cancelled', label: 'Cancelled', color: '#f87171', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30', step: -1, stepLabel: 'Cancelled' },
]

const ORDER_STATUS_MAP = Object.fromEntries(ORDER_STATUS_LIFECYCLE.map((status) => [status.value, status]))

export const ORDER_STATUS_TABS = [
  { id: 'all', label: 'All', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'pending', label: 'Pending', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'processing', label: 'Processing', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'shipped', label: 'Shipped', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'out_for_delivery', label: 'Out for Delivery', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'delivered', label: 'Delivered', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'received', label: 'Received', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
  { id: 'cancelled', label: 'Cancelled', color: '#d4af37', bgColor: 'bg-[var(--gold-primary)]/20', textColor: 'text-[var(--gold-primary)]', borderColor: 'border-[var(--gold-primary)]/30' },
]

export const TIMELINE_STEPS = [
  { status: 'pending', label: 'Order Placed', desc: 'Order created, awaiting payment' },
  { status: 'processing', label: 'Processing', desc: 'Payment received, preparing for shipment' },
  { status: 'shipped', label: 'Shipped', desc: 'Order shipped with tracking number' },
  { status: 'out_for_delivery', label: 'Out for Delivery', desc: 'Out for delivery with rider details' },
  { status: 'delivered', label: 'Delivered', desc: 'Successfully delivered to customer' },
  { status: 'received', label: 'Received', desc: 'Customer confirmed receipt' },
]

export const ORDER_STATUS_TRANSITIONS = {
  pending: ['processing'],
  processing: ['shipped'],
  shipped: ['out_for_delivery', 'received'],
  out_for_delivery: ['delivered', 'received'],
  delivered: ['received'],
  received: [],
  cancelled: [],
}

export const getOrderStatusConfig = (status) => ORDER_STATUS_MAP[status] || ORDER_STATUS_LIFECYCLE[0]

export const getPaymentStatusConfig = (status) => getOrderPaymentStatusConfig(status)
