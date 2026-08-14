const assert = require('assert')
const refundService = require('../services/projectRefundService')

/**
 * Service-level tests for the project-scoped refund workflow.
 * Uses mocked pool.query / pool.connect so it can run without a live database,
 * matching the existing refundStatusSync.test.js approach.
 */

const originalQuery = require('../config/database').pool.query

function mockPool({ queryFn }) {
  require('../config/database').pool.query = queryFn
  require('../config/database').pool.connect = async () => ({
    query: queryFn,
    release() {},
  })
}

function resetPool() {
  require('../config/database').pool.query = originalQuery
}

async function run() {
  try {
    // ─── 1. Full-payment, not-started project is eligible ────────────────────
    {
      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('FROM projects p')) {
            return { rows: [{ project_id: 'proj-1', order_id: 'order-1', customer_id: 'user-1', payment_plan: 'full_payment', total_amount: 25000 }] }
          }
          if (sql.includes('FROM project_subtasks')) {
            return { rows: [{ total: 0, completed: 0 }] }
          }
          if (sql.includes('FROM payments') && sql.includes('LIMIT 1')) {
            return { rows: [{ payment_id: 'pay-1', amount: 25000, status: 'verified' }] }
          }
          if (sql.includes('FROM payments') && sql.includes('verified_total')) {
            return { rows: [{ verified_total: 25000, total_payments: 1, verified_payments: 1, has_refunded: false }] }
          }
          if (sql.includes('FROM refund_requests')) {
            return { rows: [] }
          }
          return { rows: [] }
        },
      })
      const eligibility = await refundService.getProjectRefundEligibility('proj-1', 'user-1', 'customer')
      assert.strictEqual(eligibility.eligible, true)
      assert.strictEqual(eligibility.refundable_amount, 25000)
    }

    // ─── 2. Started project is NOT eligible ───────────────────────────────────
    {
      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('FROM projects p')) {
            return { rows: [{ project_id: 'proj-2', order_id: 'order-2', customer_id: 'user-1', payment_plan: 'full_payment', total_amount: 25000 }] }
          }
          if (sql.includes('FROM project_subtasks')) {
            return { rows: [{ total: 10, completed: 5 }] }
          }
          if (sql.includes('FROM payments')) {
            return { rows: [{ verified_total: 25000, total_payments: 1, verified_payments: 1, has_refunded: false }] }
          }
          if (sql.includes('FROM refund_requests')) {
            return { rows: [] }
          }
          return { rows: [] }
        },
      })
      const eligibility = await refundService.getProjectRefundEligibility('proj-2', 'user-1', 'customer')
      assert.strictEqual(eligibility.eligible, false)
      assert.ok(eligibility.reasons.some((r) => r.includes('started')))
    }

    // ─── 3. Installment (down-payment) project IS eligible ───────────────────
    //     Refundable amount = total verified payments actually paid.
    {
      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('FROM projects p')) {
            return { rows: [{ project_id: 'proj-3', order_id: 'order-3', customer_id: 'user-1', payment_plan: 'installment', total_amount: 25000 }] }
          }
          if (sql.includes('FROM project_subtasks')) {
            return { rows: [{ total: 0, completed: 0 }] }
          }
          if (sql.includes('FROM payments') && sql.includes('LIMIT 1')) {
            return { rows: [{ payment_id: 'pay-3', amount: 10000, status: 'verified' }] }
          }
          if (sql.includes('FROM payments') && sql.includes('verified_total')) {
            return { rows: [{ verified_total: 10000, total_payments: 1, verified_payments: 1, has_refunded: false }] }
          }
          if (sql.includes('FROM refund_requests')) {
            return { rows: [] }
          }
          return { rows: [] }
        },
      })
      const eligibility = await refundService.getProjectRefundEligibility('proj-3', 'user-1', 'customer')
      assert.strictEqual(eligibility.eligible, true)
      assert.strictEqual(eligibility.refundable_amount, 10000)
    }

    // ─── 4. Existing pending request blocks a new one ────────────────────────
    {
      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('FROM projects p')) {
            return { rows: [{ project_id: 'proj-4', order_id: 'order-4', customer_id: 'user-1', payment_plan: 'full_payment', total_amount: 25000 }] }
          }
          if (sql.includes('FROM project_subtasks')) {
            return { rows: [{ total: 0, completed: 0 }] }
          }
          if (sql.includes('FROM payments') && sql.includes('LIMIT 1')) {
            return { rows: [{ payment_id: 'pay-4', amount: 25000, status: 'verified' }] }
          }
          if (sql.includes('FROM payments') && sql.includes('verified_total')) {
            return { rows: [{ verified_total: 25000, total_payments: 1, verified_payments: 1, has_refunded: false }] }
          }
          if (sql.includes('FROM refund_requests')) {
            return { rows: [{ refund_request_id: 'existing-rr' }] }
          }
          return { rows: [] }
        },
      })
      const eligibility = await refundService.getProjectRefundEligibility('proj-4', 'user-1', 'customer')
      assert.strictEqual(eligibility.eligible, false)
      assert.ok(eligibility.reasons.some((r) => r.includes('already pending')))
    }

    // ─── 5. Admin-only status transitions are validated ──────────────────────
    {
      const calls = []
      mockPool({
        queryFn: async (sql, params) => {
          calls.push({ sql, params })
          if (sql.includes('FROM refund_requests')) {
            return { rows: [{ refund_request_id: 'rr-5', status: 'approved', project_id: 'proj-5', payment_id: 'pay-5', order_id: 'order-5' }] }
          }
          if (sql.includes('UPDATE refund_requests SET')) {
            return { rows: [{ refund_request_id: 'rr-5', status: 'processing' }] }
          }
          if (sql.includes('FROM payments')) {
            return { rows: [{ status: 'approved', payment_id: 'pay-5' }] }
          }
          return { rows: [] }
        },
      })

      // approved → processing is valid
      const res = await refundService.updateProjectRefundStatus('rr-5', 'processing', 'admin-1', 'admin')
      assert.strictEqual(res.status, 'processing')

      // Throw when a customer tries to transition
      let threw = false
      try {
        await refundService.updateProjectRefundStatus('rr-5', 'processing', 'user-1', 'customer')
      } catch (e) {
        threw = true
        assert.ok(e.message.includes('Only admins'))
      }
      assert.strictEqual(threw, true)
    }

    // ─── 6. Refunded marks all verified payments refunded in same txn ───────
    {
      const calls = []
      let paymentMode = 'select-refund-rr'
      mockPool({
        queryFn: async (sql, params) => {
          calls.push({ sql, params })

          // refund_requests SELECT (returns the processing refund record)
          if (sql.includes('FROM refund_requests') && sql.includes('refund_request_id = $1')) {
            return { rows: [{ refund_request_id: 'rr-6', status: 'processing', project_id: 'proj-6', payment_id: 'pay-6', order_id: 'order-6' }] }
          }
          // UPDATE refund_requests (the actual transition)
          if (sql.includes('UPDATE refund_requests SET')) {
            return { rows: [{ refund_request_id: 'rr-6', status: 'refunded' }] }
          }
          // Look up order_id for the refund
          if (sql.includes('SELECT order_id FROM refund_requests')) {
            return { rows: [{ order_id: 'order-6' }] }
          }
          // Verified payments lookup with FOR UPDATE
          if (sql.includes('FROM payments') && sql.includes('FOR UPDATE')) {
            return { rows: [{ payment_id: 'pay-6' }, { payment_id: 'pay-6b' }] }
          }
          // Mark all as refunded
          if (sql.includes('UPDATE payments') && sql.includes('refunded')) {
            calls.push({ sql: 'PAYMENT_REFUNDED' })
            return { rows: [] }
          }
          return { rows: [] }
        },
      })
      const res = await refundService.updateProjectRefundStatus('rr-6', 'refunded', 'admin-1', 'admin')
      assert.strictEqual(res.status, 'refunded')
      assert.ok(calls.some((c) => c.sql === 'PAYMENT_REFUNDED'))
    }

    console.log('project refund tests passed')
  } finally {
    resetPool()
  }
}

// ─── Additional tests for pending_payment_verification flow ───────────────────
async function runAdditional() {
  try {
    // ─── 7. transitionRefundStatusesForPayment: verified -> pending with recomputed amount ──
    {
      let mockClient = null
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM refund_requests') && sql.includes('pending_payment_verification') && sql.includes('FOR UPDATE')) {
            return { rows: [{ refund_request_id: 'rr-7', project_id: 'proj-7', payment_id: 'pay-7', order_id: 'order-7', amount_requested: 15000 }] }
          }
          if (sql.includes('UPDATE refund_requests SET') && sql.includes('pending_payment_verification')) {
            return { rows: [{ refund_request_id: 'rr-7', status: 'pending', amount_requested: params[1] || 25000 }] }
          }
          if (sql.includes('SUM(amount) FILTER') && sql.includes('verified')) {
            return { rows: [{ verified_total: 25000 }] }
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [{ id: 'log-7' }] }
          }
          return { rows: [] }
        },
      })
      mockClient = await require('../config/database').pool.connect()
      await refundService.transitionRefundStatusesForPayment(mockClient, 'order-7', 'verified')
    }

    // ─── 8. transitionRefundStatusesForPayment: rejected -> rejected ──
    {
      let mockClient = null
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM refund_requests') && sql.includes('pending_payment_verification') && sql.includes('FOR UPDATE')) {
            return { rows: [{ refund_request_id: 'rr-8', project_id: 'proj-8', payment_id: 'pay-8', order_id: 'order-8', amount_requested: 15000 }] }
          }
          if (sql.includes('UPDATE refund_requests SET') && sql.includes('pending_payment_verification')) {
            return { rows: [{ refund_request_id: 'rr-8', status: 'rejected', amount_requested: 15000 }] }
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [{ id: 'log-8' }] }
          }
          return { rows: [] }
        },
      })
      mockClient = await require('../config/database').pool.connect()
      await refundService.transitionRefundStatusesForPayment(mockClient, 'order-8', 'rejected')
    }

    // ─── 9. updateProjectRefundStatus: pending_payment_verification -> pending (admin) ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM refund_requests') && sql.includes('refund_request_id = $1')) {
            return { rows: [{ refund_request_id: 'rr-9', status: 'pending_payment_verification', project_id: 'proj-9', payment_id: 'pay-9', order_id: 'order-9' }] }
          }
          if (sql.includes('UPDATE refund_requests SET')) {
            return { rows: [{ refund_request_id: 'rr-9', status: 'pending' }] }
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [{ id: 'log-9' }] }
          }
          return { rows: [] }
        },
      })
      const res = await refundService.updateProjectRefundStatus('rr-9', 'pending', 'admin-1', 'admin')
      assert.strictEqual(res.status, 'pending')
    }

    // ─── 10. updateProjectRefundStatus: pending_payment_verification -> rejected (admin) ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM refund_requests') && sql.includes('refund_request_id = $1')) {
            return { rows: [{ refund_request_id: 'rr-10', status: 'pending_payment_verification', project_id: 'proj-10', payment_id: 'pay-10', order_id: 'order-10' }] }
          }
          if (sql.includes('UPDATE refund_requests SET')) {
            return { rows: [{ refund_request_id: 'rr-10', status: 'rejected' }] }
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [{ id: 'log-10' }] }
          }
          return { rows: [] }
        },
      })
      const res = await refundService.updateProjectRefundStatus('rr-10', 'rejected', 'admin-1', 'admin')
      assert.strictEqual(res.status, 'rejected')
    }

    // ─── 11. pending_payment_verification cannot transition directly to approved ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM refund_requests') && sql.includes('refund_request_id = $1')) {
            return { rows: [{ refund_request_id: 'rr-11', status: 'pending_payment_verification', project_id: 'proj-11', payment_id: 'pay-11', order_id: 'order-11' }] }
          }
          return { rows: [] }
        },
      })
      let threw = false
      try {
        await refundService.updateProjectRefundStatus('rr-11', 'approved', 'admin-1', 'admin')
      } catch (e) {
        threw = true
        assert.ok(e.message.includes('Invalid refund status transition'))
      }
      assert.strictEqual(threw, true)
    }

    console.log('project refund additional tests passed')
  } finally {
    resetPool()
  }
}

run().then(() => runAdditional()).then(() => {
  process.exit(0)
}).catch((error) => {
  console.error(error)
  process.exit(1)
})