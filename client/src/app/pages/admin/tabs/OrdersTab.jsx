import { motion } from 'motion/react'
import { OrderManagement } from '../../../components/admin/OrderManagement'

export function OrdersTab({ orders, fetchOrders, user, pagination }) {
  return (
    <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <OrderManagement orders={orders} onRefresh={fetchOrders} user={user} pagination={pagination} />
    </motion.div>
  )
}
