const assert = require('assert');
const projectRefundService = require('../services/projectRefundService');

const originalQuery = require('../config/database').pool.query;

function mockPool({ queryFn }) {
  require('../config/database').pool.query = queryFn;
  require('../config/database').pool.connect = async () => ({
    query: queryFn,
    release() {},
  });
}

function resetPool() {
  require('../config/database').pool.query = originalQuery;
}

async function runTests() {
  console.log('Running Cancellation Settlement Unit Tests...');

  try {
    // ─── Case 1: 0% Not Started with Verified Full Payment ───────────────
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p')) {
            return {
              rows: [{
                project_id: 'proj-case-1',
                order_id: 'order-case-1',
                customer_id: 'user-1',
                status: 'not_started',
                progress: 0,
                order_payment_plan: 'full_payment',
                order_total_amount: 50000,
                order_number: 'CO-20260823-0001',
              }],
            };
          }
          if (sql.includes('FROM payments')) {
            return {
              rows: [
                { payment_id: 'pay-1', amount: 50000, status: 'verified', method: 'gcash', created_at: new Date() },
              ],
            };
          }
          if (sql.includes('FROM project_subtasks') || sql.includes('FROM project_milestones')) {
            return { rows: [] };
          }
          if (sql.includes('FROM refund_requests')) {
            return { rows: [] };
          }
          if (sql.includes('FROM current_build_claims')) {
            return { rows: [] };
          }
          return { rows: [] };
        },
      });

      const settlement = await projectRefundService.calculateProjectCancellationSettlement('proj-case-1');
      assert.strictEqual(settlement.financials.total_paid, 50000);
      assert.strictEqual(settlement.financials.parts_purchased_cost, 0);
      assert.strictEqual(settlement.financials.completed_labor_cost, 0);
      assert.strictEqual(settlement.financials.non_refundable_total, 0);
      assert.strictEqual(settlement.financials.refundable_amount, 50000);
      assert.strictEqual(settlement.resolution.recommended, 'full_refund');
      assert.strictEqual(settlement.progress.has_started, false);
      assert.strictEqual(settlement.qa.how_much_paid, 50000);
      assert.strictEqual(settlement.qa.how_much_refund, 50000);
      console.log('✓ Case 1: 0% Not Started Full Payment -> Full Refund (₱50,000) passed');
    }

    // ─── Case 2: 0% Not Started with Unverified Payment ──────────────────
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p')) {
            return {
              rows: [{
                project_id: 'proj-case-2',
                order_id: 'order-case-2',
                customer_id: 'user-2',
                status: 'not_started',
                progress: 0,
                order_payment_plan: 'installment',
                order_total_amount: 50000,
                order_number: 'CO-20260823-0002',
              }],
            };
          }
          if (sql.includes('FROM payments')) {
            return {
              rows: [
                { payment_id: 'pay-2', amount: 25000, status: 'for_verification', method: 'gcash', created_at: new Date() },
              ],
            };
          }
          if (sql.includes('FROM project_subtasks') || sql.includes('FROM project_milestones')) {
            return { rows: [] };
          }
          if (sql.includes('FROM refund_requests') || sql.includes('FROM current_build_claims')) {
            return { rows: [] };
          }
          return { rows: [] };
        },
      });

      const settlement = await projectRefundService.calculateProjectCancellationSettlement('proj-case-2');
      assert.strictEqual(settlement.financials.total_paid, 0);
      assert.strictEqual(settlement.financials.for_verification_total, 25000);
      assert.strictEqual(settlement.financials.payment_status, 'for_verification');
      assert.strictEqual(settlement.resolution.recommended, 'full_refund_pending_verification');
      console.log('✓ Case 2: 0% Not Started Unverified Payment -> Pending Verification passed');
    }

    // ─── Case 3: Early Progress (20%) — Parts Purchased ₱15,000, Total Paid ₱20,000 ────────
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p')) {
            return {
              rows: [{
                project_id: 'proj-case-3',
                order_id: 'order-case-3',
                customer_id: 'user-3',
                status: 'in_progress',
                progress: 20,
                order_payment_plan: 'installment',
                order_total_amount: 40000,
                order_number: 'CO-20260823-0003',
              }],
            };
          }
          if (sql.includes('FROM payments')) {
            return {
              rows: [
                { payment_id: 'pay-3', amount: 20000, status: 'verified', method: 'gcash', created_at: new Date() },
              ],
            };
          }
          if (sql.includes('FROM project_milestones') || sql.includes('FROM project_subtasks')) {
            return {
              rows: [
                { milestone_id: 'm1', milestone_title: 'Wood Selection', order_index: 1, milestone_status: 'completed', subtask_id: 's1', title: 'Pick Alder body', subtask_status: 'completed' },
                { milestone_id: 'm2', milestone_title: 'Neck Shaping', order_index: 2, milestone_status: 'pending', subtask_id: 's2', title: 'Rough carve', subtask_status: 'pending' },
                { milestone_id: 'm2', milestone_title: 'Neck Shaping', order_index: 2, milestone_status: 'pending', subtask_id: 's3', title: 'Fretboard slotting', subtask_status: 'pending' },
                { milestone_id: 'm3', milestone_title: 'Finishing', order_index: 3, milestone_status: 'pending', subtask_id: 's4', title: 'Sanding', subtask_status: 'pending' },
                { milestone_id: 'm3', milestone_title: 'Finishing', order_index: 3, milestone_status: 'pending', subtask_id: 's5', title: 'Primer coat', subtask_status: 'pending' },
              ],
            };
          }
          if (sql.includes('order_items') || sql.includes('customizations')) {
            return {
              rows: [{
                customization_id: 'cust-1',
                guitar_type: 'electric',
                body_wood: 'Alder',
                neck_wood: 'Maple',
                fingerboard_wood: 'Rosewood',
                bridge_type: 'Hardtail',
                pickups: 'Single Coil',
                color: 'Sunburst',
                finish_type: 'Gloss',
              }],
            };
          }
          if (sql.includes('FROM audit_logs') && sql.includes('project_part_received')) {
            return {
              rows: [
                { details: JSON.stringify({ part_key: 'configuration-body-alder-cust-1-none-body_wood', received_quantity: 1, supplier: 'ToneWoods PH', received_at: new Date() }) },
              ],
            };
          }
          return { rows: [] };
        },
      });

      const settlement = await projectRefundService.calculateProjectCancellationSettlement('proj-case-3');
      assert.strictEqual(settlement.financials.total_paid, 20000);
      assert.strictEqual(settlement.progress.percentage, 20);
      assert.strictEqual(settlement.progress.has_started, true);
      assert.strictEqual(settlement.resolution.recommended, 'partial_refund_and_parts');
      assert.strictEqual(settlement.resolution.physical_release_type, 'parts');
      assert.ok(settlement.financials.refundable_amount > 0);
      console.log('✓ Case 3: 20% Early Progress -> Partial Refund + Parts Release passed');
    }

    // ─── Case 4: Mid Progress (36%) — Work & Parts Incurred ─────────────────
    {
      mockPool({
        queryFn: async (sql, params) => {
          if (sql.includes('FROM projects p')) {
            return {
              rows: [{
                project_id: 'proj-case-4',
                order_id: 'order-case-4',
                customer_id: 'user-4',
                status: 'in_progress',
                progress: 36,
                order_payment_plan: 'installment',
                order_total_amount: 50000,
                order_number: 'CO-20260823-0004',
                cancelled_stage_snapshot: 'Woodworking & Neck Shaping',
              }],
            };
          }
          if (sql.includes('FROM payments')) {
            return {
              rows: [
                { payment_id: 'pay-4a', amount: 25000, status: 'verified', method: 'bank_transfer', created_at: new Date() },
                { payment_id: 'pay-4b', amount: 20000, status: 'verified', method: 'bank_transfer', created_at: new Date() },
              ],
            };
          }
          if (sql.includes('FROM project_milestones') || sql.includes('FROM project_subtasks')) {
            return {
              rows: [
                { milestone_id: 'm1', milestone_title: 'Wood Prep', order_index: 1, milestone_status: 'completed', subtask_id: 's1', title: 'Body blanking', subtask_status: 'completed' },
                { milestone_id: 'm2', milestone_title: 'Neck Shaping', order_index: 2, milestone_status: 'completed', subtask_id: 's2', title: 'Truss rod install', subtask_status: 'completed' },
                { milestone_id: 'm3', milestone_title: 'Frets & Assembly', order_index: 3, milestone_status: 'pending', subtask_id: 's3', title: 'Fret press', subtask_status: 'pending' },
              ],
            };
          }
          return { rows: [] };
        },
      });

      const settlement = await projectRefundService.calculateProjectCancellationSettlement('proj-case-4');
      assert.strictEqual(settlement.financials.total_paid, 45000);
      assert.strictEqual(settlement.resolution.recommended, 'partial_refund_and_build');
      assert.strictEqual(settlement.resolution.physical_release_type, 'current_build');
      assert.ok(settlement.financials.refundable_amount > 0);
      assert.ok(settlement.qa.what_happened_to_work.includes('Woodworking & Neck Shaping'));
      console.log('✓ Case 4: 36% Mid Progress -> Current Build Release + Partial Refund passed');
    }

    console.log('\nAll Cancellation Settlement Unit Tests Passed Successfully!');
  } finally {
    resetPool();
  }
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
