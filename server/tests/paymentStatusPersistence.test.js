const assert = require('node:assert/strict')
const database = require('../config/database')
const orderService = require('../services/orderService')

async function run() {
  const originalConnect = database.pool.connect
  const auditService = require('../services/auditService')
  const originalLogPaymentEvent = auditService.logPaymentEvent
  const originalLogOrderEvent = auditService.logOrderEvent
  auditService.logPaymentEvent = async () => {}
  auditService.logOrderEvent = async () => {}
  try {
    for (const target of ['under_review', 'failed']) {
      let storedStatus = target === 'failed' ? 'approved' : 'proof_submitted'
      let committed = false
      database.pool.connect = async () => ({
        async query(sql, params = []) {
          if (sql.includes('AS payment_method')) {
            return { rows: [{ payment_status: storedStatus, status: 'pending', payment_method: 'gcash', payment_id: 'payment-1' }] }
          }
          if (sql.startsWith('SELECT payment_id')) return { rows: [{ payment_id: 'payment-1' }] }
          if (sql.startsWith('UPDATE orders')) {
            storedStatus = params[0]
            return { rows: [{ order_id: 'order-1', status: 'pending', payment_status: storedStatus }] }
          }
          if (sql.startsWith('UPDATE payments')) {
            // Simulate the existing database trigger overwriting the order.
            storedStatus = params[0] === 'for_verification' ? 'proof_submitted' : 'pending'
          }
          if (sql === 'COMMIT') committed = true
          return { rows: [] }
        },
        release() {},
      })
      const result = await orderService.updatePaymentStatus('order-1', target)
      assert.equal(committed, true)
      assert.equal(storedStatus, target, 'persisted status must survive the payment trigger')
      assert.equal(result.payment_status, storedStatus, 'socket payload must match the persisted status')
    }
  } finally {
    database.pool.connect = originalConnect
    auditService.logPaymentEvent = originalLogPaymentEvent
    auditService.logOrderEvent = originalLogOrderEvent
  }
}
run().then(() => console.log('payment status persistence test passed')).catch(error => {
  console.error(error)
  process.exitCode = 1
})
