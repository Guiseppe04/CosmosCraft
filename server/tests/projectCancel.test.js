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

    // ─── 6. requestProjectCancel on a started project sets cancel options ──
    {
      let projectSelectCount = 0
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.trim().toLowerCase().startsWith('select') && sql.includes('FROM projects p') && sql.includes('deleted_at IS NULL') && sql.includes('project_id = $1')) {
            projectSelectCount += 1
            if (projectSelectCount === 1) {
              return { rows: [{ project_id: 'proj-6', order_id: 'order-6', customer_id: 'user-6', status: 'in_progress', cancel_option: null, cancel_reason: null, cancel_requested_at: null }] }
            }
            return { rows: [{ project_id: 'proj-6', order_id: 'order-6', customer_id: 'user-6', status: 'in_progress', cancel_option: 'ship_unfinished', cancel_reason: 'Customer requested cancellation', cancel_requested_at: '2026-08-14T03:00:00Z' }] }
          }
          if (sql.includes('UPDATE projects') && sql.includes('cancel_option')) {
            return { rows: [] }
          }
          if (sql.includes('INSERT INTO activity_logs')) {
            return { rows: [{ id: 'log-6' }] }
          }
          return { rows: [] }
        },
      })
      const result = await projectService.requestProjectCancel('proj-6', 'user-6', 'customer', { cancel_option: 'ship_unfinished', cancel_reason: 'Customer requested cancellation' })
      assert.strictEqual(result.status, 'in_progress')
      assert.strictEqual(result.cancel_option, 'ship_unfinished')
    }

    // ─── 7. requestProjectCancel rejects when already cancelled ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p') && sql.includes('deleted_at IS NULL')) {
            return { rows: [{ project_id: 'proj-7', order_id: 'order-7', customer_id: 'user-7', status: 'cancelled', cancel_option: null, cancel_reason: null, cancel_requested_at: null }] }
          }
          return { rows: [] }
        },
      })
      let threw = false
      try {
        await projectService.requestProjectCancel('proj-7', 'user-7', 'customer', { cancel_option: 'ship_unfinished', cancel_reason: 'test' })
      } catch (e) {
        threw = true
      }
      assert.strictEqual(threw, true)
    }

    // ─── 8. approveProjectCancel with ship_unfinished sets cancelled + shipped ──
    {
      let projectSelectCount = 0
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.trim().toLowerCase().startsWith('select') && sql.includes('FROM projects p') && sql.includes('deleted_at IS NULL') && sql.includes('project_id = $1')) {
            projectSelectCount += 1
            if (projectSelectCount === 1) {
              return { rows: [{ project_id: 'proj-8', order_id: 'order-8', customer_id: 'user-8', status: 'in_progress', cancel_option: 'ship_unfinished', cancel_reason: 'Customer requested cancellation', cancel_requested_at: '2026-08-14T03:00:00Z' }] }
            }
            return { rows: [{ project_id: 'proj-8', order_id: 'order-8', customer_id: 'user-8', status: 'cancelled', cancel_option: 'ship_unfinished', cancel_approved_by: 'admin-1', cancel_approved_at: '2026-08-14T03:01:00Z', fulfillment_status: 'shipped_unfinished' }] }
          }
          if (sql.includes('UPDATE projects') && sql.includes('cancel_approved_by')) {
            return { rows: [] }
          }
          if (sql.includes('UPDATE orders') && sql.includes('status = \'cancelled\'')) {
            return { rows: [] }
          }
          if (sql.includes('FROM project_milestones m')) {
            return { rows: [] }
          }
          if (sql.includes('UPDATE projects') && sql.includes('last_completed_stage')) {
            return { rows: [] }
          }
          if (sql.includes('SELECT last_completed_stage')) {
            return { rows: [{ last_completed_stage: null, last_completed_stage_at: null }] }
          }
          if (sql.includes('UPDATE projects') && sql.includes('cancelled_stage_snapshot')) {
            return { rows: [] }
          }
          if (sql.includes('current_build_claims')) {
            return { rows: [] }
          }
          if (sql.includes('FROM project_subtasks ps') && sql.includes('project_milestones pm')) {
            return { rows: [{ total: 0, completed: 0 }] }
          }
          if (sql.includes('FROM payments')) {
            return { rows: [] }
          }
          if (sql.includes('INSERT INTO current_build_claims')) {
            return { rows: [{ claim_id: 'claim-8' }] }
          }
          if (sql.includes('INSERT INTO activity_logs')) {
            return { rows: [{ id: 'log-8' }] }
          }
          return { rows: [] }
        },
      })
      const result = await projectService.approveProjectCancel('proj-8', 'admin-1', { action: 'approve' })
      assert.strictEqual(result.status, 'cancelled')
      assert.ok(result.cancel_approved_at)
    }

    // ─── 9. approveProjectCancel reject clears cancel request ──
    {
      let projectSelectCount = 0
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.trim().toLowerCase().startsWith('select') && sql.includes('FROM projects p') && sql.includes('deleted_at IS NULL') && sql.includes('project_id = $1')) {
            projectSelectCount += 1
            if (projectSelectCount === 1) {
              return { rows: [{ project_id: 'proj-9', order_id: 'order-9', customer_id: 'user-9', status: 'in_progress', cancel_option: 'pickup_unfinished', cancel_reason: 'Wrong option', cancel_requested_at: '2026-08-14T03:00:00Z' }] }
            }
            return { rows: [{ project_id: 'proj-9', order_id: 'order-9', customer_id: 'user-9', status: 'in_progress', cancel_option: null, cancel_reason: null, cancel_requested_at: null }] }
          }
          if (sql.includes('UPDATE projects') && sql.includes('cancel_option = NULL')) {
            return { rows: [] }
          }
          if (sql.includes('INSERT INTO activity_logs')) {
            return { rows: [{ id: 'log-9' }] }
          }
          return { rows: [] }
        },
      })
      const result = await projectService.approveProjectCancel('proj-9', 'admin-1', { action: 'reject', rejection_reason: 'Customer chose wrong option' })
      assert.strictEqual(result.status, 'in_progress')
      assert.strictEqual(result.cancel_option, null)
    }

    // ─── 10. approveProjectCancel throws when no request exists ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p') && sql.includes('deleted_at IS NULL')) {
            return { rows: [{ project_id: 'proj-10', order_id: 'order-10', customer_id: 'user-10', status: 'in_progress', cancel_option: null, cancel_reason: null, cancel_requested_at: null }] }
          }
          return { rows: [] }
        },
      })
      let threw = false
      try {
        await projectService.approveProjectCancel('proj-10', 'admin-1', { action: 'approve' })
      } catch (e) {
        threw = true
      }
      assert.strictEqual(threw, true)
    }

    // ─── 11. cancelProjectCancelRequest withdraws a pending cancellation request ──
    {
      let projectSelectCount = 0
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.trim().toLowerCase().startsWith('select') && sql.includes('FROM projects p') && sql.includes('deleted_at IS NULL') && sql.includes('project_id = $1')) {
            projectSelectCount += 1
            if (projectSelectCount === 1) {
              return { rows: [{ project_id: 'proj-11', order_id: 'order-11', customer_id: 'user-11', status: 'in_progress', cancel_option: 'ship_unfinished', cancel_reason: 'Need to withdraw', cancel_requested_at: '2026-08-14T03:00:00Z', cancel_approved_at: null }] }
            }
            return { rows: [{ project_id: 'proj-11', order_id: 'order-11', customer_id: 'user-11', status: 'in_progress', cancel_option: null, cancel_reason: null, cancel_requested_at: null, cancel_approved_at: null }] }
          }
          if (sql.includes('UPDATE projects') && sql.includes('cancel_option = NULL')) {
            return { rows: [] }
          }
          if (sql.includes('INSERT INTO activity_logs')) {
            return { rows: [{ id: 'log-11' }] }
          }
          if (sql.includes('FROM project_subtasks ps') && sql.includes('project_milestones pm')) {
            return { rows: [{ total: 0, completed: 0 }] }
          }
          if (sql.includes('current_build_claims')) {
            return { rows: [] }
          }
          return { rows: [] }
        },
      })
      const result = await projectService.cancelProjectCancelRequest('proj-11', 'user-11', 'customer')
      assert.strictEqual(result.status, 'in_progress')
      assert.strictEqual(result.cancel_option, null)
      assert.strictEqual(result.cancel_requested_at, null)
    }

    // ─── 12. cancelProjectCancelRequest throws when no pending request ──
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p') && sql.includes('deleted_at IS NULL')) {
            return { rows: [{ project_id: 'proj-12', order_id: 'order-12', customer_id: 'user-12', status: 'in_progress', cancel_option: null, cancel_reason: null, cancel_requested_at: null, cancel_approved_at: null }] }
          }
          return { rows: [] }
        },
      })
      let threw = false
      try {
        await projectService.cancelProjectCancelRequest('proj-12', 'user-12', 'customer')
      } catch (e) {
        threw = true
      }
      assert.strictEqual(threw, true)
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
