const assert = require('assert')
const database = require('../config/database')
const orderService = require('../services/orderService')

/**
 * Regression test for the refund status sync bug.
 *
 * Bug: The customer-facing order page always showed "Refund Request Pending"
 * even after the admin marked the refund request as "Refunded" (or any other
 * status). The order page was relying on a boolean `has_refund_request` flag
 * instead of the live `refund_request_status` from the refund_requests table.
 *
 * This test verifies that `getUserOrders` returns the live refund request
 * status so the UI can render the correct badge.
 */
async function run() {
  const originalQuery = database.pool.query
  const calls = []

  database.pool.query = async (sql, params = []) => {
    calls.push({ sql, params })

    // Orders query
    if (sql.includes('FROM orders') && sql.includes('WHERE user_id = $1')) {
      return {
        rows: [
          {
            order_id: '11111111-1111-1111-1111-111111111111',
            order_number: 'PO-20260802-0009',
            user_id: 'user-1',
            status: 'received',
            payment_status: 'approved',
            created_at: new Date('2026-08-02T10:00:00Z'),
          },
        ],
      }
    }

    // Order items query
    if (sql.includes('FROM order_items oi')) {
      return { rows: [] }
    }

    // Payments query
    if (sql.includes('FROM payments') && sql.includes('WHERE order_id = ANY')) {
      return { rows: [] }
    }

    // Refund requests query - simulate a refund that has been marked as "refunded" by admin
    if (sql.includes('FROM refund_requests')) {
      return {
        rows: [
          {
            order_id: '11111111-1111-1111-1111-111111111111',
            refund_request_id: '22222222-2222-2222-2222-222222222222',
            status: 'refunded',
            created_at: new Date('2026-08-09T10:00:00Z'),
          },
        ],
      }
    }

    return { rows: [] }
  }

  try {
    const orders = await orderService.getUserOrders('user-1')

    assert.strictEqual(orders.length, 1, 'expected exactly one order')
    const order = orders[0]

    // The order should still report that a refund request exists
    assert.strictEqual(order.has_refund_request, true, 'expected has_refund_request to be true')

    // CRITICAL FIX: The order must expose the live refund request status so the
    // UI can render the correct badge instead of hardcoding "Pending".
    assert.strictEqual(
      order.refund_request_status,
      'refunded',
      'expected refund_request_status to reflect the live status from the refund_requests table'
    )
    assert.strictEqual(
      order.refund_request_id,
      '22222222-2222-2222-2222-222222222222',
      'expected refund_request_id to be exposed'
    )

    // Verify the query actually joined the refund_requests table
    const refundQuery = calls.find((c) => c.sql.includes('FROM refund_requests'))
    assert.ok(refundQuery, 'expected a query against the refund_requests table')
    assert.ok(
      refundQuery.sql.includes('status'),
      'expected the refund query to select the status column'
    )

    console.log('refund status sync test passed')
  } finally {
    database.pool.query = originalQuery
  }
}

run().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error(error)
  process.exit(1)
})