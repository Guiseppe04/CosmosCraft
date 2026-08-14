const assert = require('assert')
const path = require('path')
const projectService = require(path.resolve(__dirname, '../services/projectService.js'))

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
    // ─── 1. Cancel not-started project with verified payment creates pending refund ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p') && sql.includes('FOR UPDATE')) {
            return { rows: [{ project_id: 'proj-1', order_id: 'order-1', customer_id: 'user-1', status: 'not_started', title: 'Test Build', custom_build_id: 'CMB-260814-0001', payment_plan: 'full_payment', total_amount: 25000 }] }
          }
          if (sql.includes('FROM project_subtasks')) {
            return { rows: [{ total: 0, completed: 0 }] }
          }
          if (sql.includes('UPDATE projects SET status = \'cancelled\'') && sql.includes('project_id')) {
            return { rows: [{ project_id: 'proj-1', status: 'cancelled' }] }
          }
          if (sql.includes('UPDATE orders SET status = \'cancelled\'')) {
            return { rows: [{ order_id: 'order-1', status: 'cancelled' }] }
          }
          if (sql.includes('FROM payments') && sql.includes('rejected') && sql.includes('LIMIT 1')) {
            return { rows: [{ payment_id: 'pay-1', amount: 25000, status: 'verified' }] }
          }
          if (sql.includes('FROM refund_requests') && sql.includes('pending_payment_verification')) {
            return { rows: [] }
          }
          if (sql.includes('INSERT INTO refund_request_counters')) {
            return { rows: [{ last_number: 1 }] }
          }
          if (sql.includes('SELECT 1 FROM refund_requests WHERE request_number')) {
            return { rows: [] }
          }
          if (sql.includes('INSERT INTO refund_requests')) {
            return { rows: [{ refund_request_id: 'rr-1', status: 'pending', amount_requested: 25000 }] }
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [{ id: 'log-1' }] }
          }
          return { rows: [] }
        },
      })
      const result = await projectService.cancelProject('proj-1', 'user-1', 'customer')
      assert.strictEqual(result.status, 'cancelled')
    }

    // ─── 2. Cancel not-started project with unverified payment creates pending_payment_verification refund ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p') && sql.includes('FOR UPDATE')) {
            return { rows: [{ project_id: 'proj-2', order_id: 'order-2', customer_id: 'user-2', status: 'not_started', title: 'Test Build 2', custom_build_id: 'CMB-260814-0002', payment_plan: 'installment', total_amount: 25000 }] }
          }
          if (sql.includes('FROM project_subtasks')) {
            return { rows: [{ total: 0, completed: 0 }] }
          }
          if (sql.includes('UPDATE projects SET status = \'cancelled\'') && sql.includes('project_id')) {
            return { rows: [{ project_id: 'proj-2', status: 'cancelled' }] }
          }
          if (sql.includes('UPDATE orders SET status = \'cancelled\'')) {
            return { rows: [{ order_id: 'order-2', status: 'cancelled' }] }
          }
          if (sql.includes('FROM payments') && sql.includes('rejected') && sql.includes('LIMIT 1')) {
            return { rows: [{ payment_id: 'pay-2', amount: 10000, status: 'for_verification' }] }
          }
          if (sql.includes('FROM refund_requests') && sql.includes('pending_payment_verification')) {
            return { rows: [] }
          }
          if (sql.includes('INSERT INTO refund_request_counters')) {
            return { rows: [{ last_number: 2 }] }
          }
          if (sql.includes('SELECT 1 FROM refund_requests WHERE request_number')) {
            return { rows: [] }
          }
          if (sql.includes('INSERT INTO refund_requests')) {
            return { rows: [{ refund_request_id: 'rr-2', status: 'pending_payment_verification', amount_requested: 10000 }] }
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [{ id: 'log-2' }] }
          }
          return { rows: [] }
        },
      })
      const result = await projectService.cancelProject('proj-2', 'user-2', 'customer')
      assert.strictEqual(result.status, 'cancelled')
    }

    // ─── 3. Cancel started project throws error for non-privileged user ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p') && sql.includes('FOR UPDATE')) {
            return { rows: [{ project_id: 'proj-3', order_id: 'order-3', customer_id: 'user-3', status: 'in_progress', title: 'Started Build', custom_build_id: 'CMB-260814-0003', payment_plan: 'full_payment', total_amount: 25000 }] }
          }
          if (sql.includes('FROM project_subtasks')) {
            return { rows: [{ total: 5, completed: 2 }] }
          }
          return { rows: [] }
        },
      })
      let threw = false
      try {
        await projectService.cancelProject('proj-3', 'user-3', 'customer')
      } catch (e) {
        threw = true
        assert.ok(e.message.includes('Current Build Claim'))
      }
      assert.strictEqual(threw, true)
    }

    // ─── 4. Rejected payment at cancel time does not create refund ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p') && sql.includes('FOR UPDATE')) {
            return { rows: [{ project_id: 'proj-4', order_id: 'order-4', customer_id: 'user-4', status: 'not_started', title: 'Test Build 4', custom_build_id: 'CMB-260814-0004', payment_plan: 'full_payment', total_amount: 25000 }] }
          }
          if (sql.includes('FROM project_subtasks')) {
            return { rows: [{ total: 0, completed: 0 }] }
          }
          if (sql.includes('UPDATE projects SET status = \'cancelled\'') && sql.includes('project_id')) {
            return { rows: [{ project_id: 'proj-4', status: 'cancelled' }] }
          }
          if (sql.includes('UPDATE orders SET status = \'cancelled\'')) {
            return { rows: [{ order_id: 'order-4', status: 'cancelled' }] }
          }
          if (sql.includes('FROM payments') && sql.includes('rejected') && sql.includes('LIMIT 1')) {
            return { rows: [{ payment_id: 'pay-4', amount: 25000, status: 'rejected' }] }
          }
          if (sql.includes('INSERT INTO refund_requests')) {
            throw new Error('Should not insert refund for rejected payment')
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [{ id: 'log-4' }] }
          }
          return { rows: [] }
        },
      })
      const result = await projectService.cancelProject('proj-4', 'user-4', 'customer')
      assert.strictEqual(result.status, 'cancelled')
    }

    // ─── 5. Duplicate cancel prevention (FOR UPDATE lock + existing refund check) ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p') && sql.includes('FOR UPDATE')) {
            return { rows: [{ project_id: 'proj-5', order_id: 'order-5', customer_id: 'user-5', status: 'not_started', title: 'Test Build 5', custom_build_id: 'CMB-260814-0005', payment_plan: 'full_payment', total_amount: 25000 }] }
          }
          if (sql.includes('FROM project_subtasks')) {
            return { rows: [{ total: 0, completed: 0 }] }
          }
          if (sql.includes('FROM refund_requests') && sql.includes('pending_payment_verification')) {
            return { rows: [{ refund_request_id: 'rr-existing', status: 'pending_payment_verification' }] }
          }
          if (sql.includes('INSERT INTO refund_requests')) {
            throw new Error('Should not insert duplicate refund')
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [{ id: 'log-5' }] }
          }
          return { rows: [] }
        },
      })
      const result = await projectService.cancelProject('proj-5', 'user-5', 'customer')
      assert.strictEqual(result.status, 'cancelled')
    }

    console.log('project cancel tests passed')
  } finally {
    resetPool()
  }
}

run().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
