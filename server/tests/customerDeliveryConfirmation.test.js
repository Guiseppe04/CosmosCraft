const assert = require('assert');
const fulfillmentService = require('../services/fulfillmentService');
const projectService = require('../services/projectService');
const currentBuildClaimService = require('../services/currentBuildClaimService');
const notificationService = require('../services/notificationService');

const originalQuery = require('../config/database').pool.query;
const originalConnect = require('../config/database').pool.connect;
const originalCreateNotif = notificationService.createNotification;

function mockPool({ queryFn }) {
  require('../config/database').pool.query = queryFn;
  require('../config/database').pool.connect = async () => ({
    query: queryFn,
    release() {},
  });
}

function resetPool() {
  require('../config/database').pool.query = originalQuery;
  require('../config/database').pool.connect = originalConnect;
  notificationService.createNotification = originalCreateNotif;
}

async function runTests() {
  console.log('Running Customer Delivery Confirmation Unit Tests...\n');

  try {
    // ─── Test 1: Customer Confirms Delivery for Own Order (Happy Path) ───────────────
    {
      console.log('Test 1: Customer confirms delivery for own order while out_for_delivery...');
      const executedQueries = [];
      const notificationsCreated = [];

      notificationService.createNotification = async (payload) => {
        notificationsCreated.push(payload);
        return { notification_id: 'notif-1', ...payload };
      };

      const mockRequest = {
        id: 'req-1111-2222-3333-4444',
        order_id: 'ord-1111-2222-3333-4444',
        order_number: 'CO-20260916-0001',
        customer_id: 'user-cust-1',
        order_status: 'out_for_delivery',
        order_type: 'customization',
        customization_status: 'ready_for_delivery',
        order_delivered_at: null,
        project_id: 'proj-1111-2222-3333-4444',
        project_title: 'Custom Stratocaster Deluxe',
        project_status: 'completed',
        project_fulfillment_status: 'out_for_delivery',
        fulfillment_method: 'delivery',
        status: 'out_for_delivery',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        created_at: new Date('2026-09-01'),
      };

      mockPool({
        queryFn: async (sql, params) => {
          executedQueries.push({ sql, params });

          if (sql.includes('SELECT fr.*') && sql.includes('FOR UPDATE')) {
            return { rows: [mockRequest] };
          }
          if (sql.includes('UPDATE fulfillment_requests') && sql.includes('RETURNING *')) {
            return {
              rowCount: 1,
              rows: [{
                ...mockRequest,
                status: 'completed',
                delivered_at: new Date(),
                delivered_by_user_id: 'user-cust-1',
                delivery_confirmation_method: 'customer',
              }],
            };
          }
          if (sql.includes('UPDATE projects')) {
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('UPDATE orders')) {
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('SELECT 1 FROM notifications')) {
            return { rows: [] }; // no existing notifications
          }
          if (sql.includes('SELECT user_id FROM users WHERE role IN')) {
            return { rows: [{ user_id: 'admin-1' }, { user_id: 'staff-1' }] };
          }
          return { rows: [] };
        },
      });

      const result = await fulfillmentService.confirmDelivery(
        mockRequest.id,
        'user-cust-1',
        'customer'
      );

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.fulfillmentStatus, 'delivered');
      assert.strictEqual(result.deliveryConfirmationMethod, 'customer');

      // Verify queries were issued for all 3 tables + audit log
      const frUpdate = executedQueries.find((q) => q.sql.includes('UPDATE fulfillment_requests'));
      assert.ok(frUpdate, 'Expected UPDATE fulfillment_requests query');
      assert.strictEqual(frUpdate.params[0], 'user-cust-1');
      assert.strictEqual(frUpdate.params[1], 'customer');

      const projectUpdate = executedQueries.find((q) => q.sql.includes('UPDATE projects'));
      assert.ok(projectUpdate, 'Expected UPDATE projects query');
      assert.strictEqual(projectUpdate.params[0], 'user-cust-1');
      assert.strictEqual(projectUpdate.params[1], 'customer');

      const orderUpdate = executedQueries.find((q) => q.sql.includes('UPDATE orders'));
      assert.ok(orderUpdate, 'Expected UPDATE orders query');
      assert.strictEqual(orderUpdate.params[0], 'user-cust-1');
      assert.strictEqual(orderUpdate.params[1], 'customer');

      const auditLog = executedQueries.find((q) => q.sql.includes('INSERT INTO audit_logs'));
      assert.ok(auditLog, 'Expected INSERT INTO audit_logs query');
      assert.strictEqual(auditLog.params[0], 'user-cust-1');
      assert.strictEqual(auditLog.params[1], mockRequest.id);

      // Verify notifications sent to admin/staff AND customer
      assert.ok(notificationsCreated.some((n) => n.user_id === 'admin-1' && n.title === 'Custom Guitar Delivered'));
      assert.ok(notificationsCreated.some((n) => n.user_id === 'staff-1' && n.title === 'Custom Guitar Delivered'));
      assert.ok(notificationsCreated.some((n) => n.user_id === 'user-cust-1' && n.title === 'Delivery Confirmed'));

      console.log('✓ Test 1 Passed: Customer successfully confirmed delivery, synchronized 3 tables, logged audit, and notified admin/staff/customer.\n');
    }

    // ─── Test 2: Admin/Staff Confirms Delivery ──────────────────────────
    {
      console.log('Test 2: Admin confirms delivery for an order...');
      const executedQueries = [];
      const notificationsCreated = [];

      notificationService.createNotification = async (payload) => {
        notificationsCreated.push(payload);
        return { notification_id: 'notif-2', ...payload };
      };

      const mockRequest = {
        id: 'req-2222-3333-4444-5555',
        order_id: 'ord-2222-3333-4444-5555',
        order_number: 'CO-20260916-0002',
        customer_id: 'user-cust-2',
        order_status: 'out_for_delivery',
        order_type: 'customization',
        customization_status: 'ready_for_delivery',
        order_delivered_at: null,
        project_id: 'proj-2222-3333-4444-5555',
        project_title: 'Custom Telecaster',
        project_status: 'completed',
        project_fulfillment_status: 'out_for_delivery',
        fulfillment_method: 'delivery',
        status: 'out_for_delivery',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        created_at: new Date('2026-09-02'),
      };

      mockPool({
        queryFn: async (sql, params) => {
          executedQueries.push({ sql, params });

          if (sql.includes('SELECT fr.*') && sql.includes('FOR UPDATE')) {
            return { rows: [mockRequest] };
          }
          if (sql.includes('UPDATE fulfillment_requests') && sql.includes('RETURNING *')) {
            return {
              rowCount: 1,
              rows: [{
                ...mockRequest,
                status: 'completed',
                delivered_at: new Date(),
                delivered_by_user_id: 'admin-super-1',
                delivery_confirmation_method: 'admin',
              }],
            };
          }
          if (sql.includes('UPDATE projects') || sql.includes('UPDATE orders') || sql.includes('INSERT INTO audit_logs')) {
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('SELECT 1 FROM notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        },
      });

      const result = await fulfillmentService.confirmDelivery(
        mockRequest.id,
        'admin-super-1',
        'admin'
      );

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.deliveryConfirmationMethod, 'admin');

      const frUpdate = executedQueries.find((q) => q.sql.includes('UPDATE fulfillment_requests'));
      assert.strictEqual(frUpdate.params[0], 'admin-super-1');
      assert.strictEqual(frUpdate.params[1], 'admin');

      // Admin confirmed -> customer notified
      assert.ok(notificationsCreated.some((n) => n.user_id === 'user-cust-2' && n.message.includes('by the shop')));

      console.log('✓ Test 2 Passed: Admin confirmation records method as "admin" and notifies customer.\n');
    }

    // ─── Test 3: Unauthorized Customer Attempt (403) ───────────────────
    {
      console.log('Test 3: Customer cannot confirm another customer\'s order (403)...');

      const mockRequest = {
        id: 'req-3333',
        order_id: 'ord-3333',
        customer_id: 'user-actual-owner',
        status: 'out_for_delivery',
        fulfillment_method: 'delivery',
      };

      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('SELECT fr.*')) {
            return { rows: [mockRequest] };
          }
          return { rows: [] };
        },
      });

      let errorCaught = null;
      try {
        await fulfillmentService.confirmDelivery('req-3333', 'user-intruder', 'customer');
      } catch (err) {
        errorCaught = err;
      }

      assert.ok(errorCaught, 'Expected error to be thrown');
      assert.strictEqual(errorCaught.statusCode, 403);
      assert.strictEqual(errorCaught.message, 'You are not authorized to confirm this delivery.');
      console.log('✓ Test 3 Passed: 403 Forbidden for wrong customer.\n');
    }

    // ─── Test 4: Cannot Confirm Before out_for_delivery (409) ───────────
    {
      console.log('Test 4: Cannot confirm when status is not out_for_delivery (409)...');

      const mockRequest = {
        id: 'req-4444',
        order_id: 'ord-4444',
        customer_id: 'user-cust-4',
        status: 'processing',
        fulfillment_method: 'delivery',
      };

      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('SELECT fr.*')) {
            return { rows: [mockRequest] };
          }
          return { rows: [] };
        },
      });

      let errorCaught = null;
      try {
        await fulfillmentService.confirmDelivery('req-4444', 'user-cust-4', 'customer');
      } catch (err) {
        errorCaught = err;
      }

      assert.ok(errorCaught, 'Expected error to be thrown');
      assert.strictEqual(errorCaught.statusCode, 409);
      assert.ok(errorCaught.message.includes('out_for_delivery'));
      console.log('✓ Test 4 Passed: 409 Conflict when status is not out_for_delivery.\n');
    }

    // ─── Test 5: Cannot Confirm Non-Delivery (e.g. Pickup) (400) ────────
    {
      console.log('Test 5: Cannot confirm delivery on pickup orders (400)...');

      const mockRequest = {
        id: 'req-5555',
        order_id: 'ord-5555',
        customer_id: 'user-cust-5',
        status: 'out_for_delivery',
        fulfillment_method: 'pickup',
      };

      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('SELECT fr.*')) {
            return { rows: [mockRequest] };
          }
          return { rows: [] };
        },
      });

      let errorCaught = null;
      try {
        await fulfillmentService.confirmDelivery('req-5555', 'user-cust-5', 'customer');
      } catch (err) {
        errorCaught = err;
      }

      assert.ok(errorCaught, 'Expected error to be thrown');
      assert.strictEqual(errorCaught.statusCode, 400);
      assert.ok(errorCaught.message.includes('only valid for delivery orders'));
      console.log('✓ Test 5 Passed: 400 Bad Request for pickup fulfillment method.\n');
    }

    // ─── Test 6: Cannot Confirm Cancelled Order (409) ───────────────────
    {
      console.log('Test 6: Cannot confirm delivery for cancelled order (409)...');

      const mockRequest = {
        id: 'req-6666',
        order_id: 'ord-6666',
        customer_id: 'user-cust-6',
        status: 'cancelled',
        order_status: 'cancelled',
        project_status: 'cancelled',
        fulfillment_method: 'delivery',
      };

      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('SELECT fr.*')) {
            return { rows: [mockRequest] };
          }
          return { rows: [] };
        },
      });

      let errorCaught = null;
      try {
        await fulfillmentService.confirmDelivery('req-6666', 'user-cust-6', 'customer');
      } catch (err) {
        errorCaught = err;
      }

      assert.ok(errorCaught, 'Expected error to be thrown');
      assert.strictEqual(errorCaught.statusCode, 409);
      assert.ok(errorCaught.message.includes('cancelled'));
      console.log('✓ Test 6 Passed: 409 Conflict for cancelled order.\n');
    }

    // ─── Test 7: Cannot Confirm Already Delivered / Completed Order (409) ─
    {
      console.log('Test 7: Cannot confirm delivery for already delivered order (409)...');

      const mockRequest = {
        id: 'req-7777',
        order_id: 'ord-7777',
        customer_id: 'user-cust-7',
        status: 'completed',
        delivered_at: new Date('2026-09-10'),
        order_status: 'delivered',
        customization_status: 'fulfilled',
        fulfillment_method: 'delivery',
      };

      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('SELECT fr.*')) {
            return { rows: [mockRequest] };
          }
          return { rows: [] };
        },
      });

      let errorCaught = null;
      try {
        await fulfillmentService.confirmDelivery('req-7777', 'user-cust-7', 'customer');
      } catch (err) {
        errorCaught = err;
      }

      assert.ok(errorCaught, 'Expected error to be thrown');
      assert.strictEqual(errorCaught.statusCode, 409);
      assert.ok(errorCaught.message.includes('already been confirmed'));
      console.log('✓ Test 7 Passed: 409 Conflict for already delivered order.\n');
    }

    // ─── Test 8: Concurrent Confirmation Race Condition Protection ───────
    {
      console.log('Test 8: Concurrent race condition returns 409 when rowCount is 0...');

      const mockRequest = {
        id: 'req-8888',
        order_id: 'ord-8888',
        customer_id: 'user-cust-8',
        status: 'out_for_delivery',
        fulfillment_method: 'delivery',
      };

      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('SELECT fr.*')) {
            return { rows: [mockRequest] };
          }
          // Atomic update returns rowCount 0 because another concurrent worker just flipped status
          if (sql.includes('UPDATE fulfillment_requests')) {
            return { rowCount: 0, rows: [] };
          }
          return { rows: [] };
        },
      });

      let errorCaught = null;
      try {
        await fulfillmentService.confirmDelivery('req-8888', 'user-cust-8', 'customer');
      } catch (err) {
        errorCaught = err;
      }

      assert.ok(errorCaught, 'Expected error to be thrown');
      assert.strictEqual(errorCaught.statusCode, 409);
      assert.ok(errorCaught.message.includes('already been confirmed'));
      console.log('✓ Test 8 Passed: Atomic conditional update prevents concurrent race conditions.\n');
    }

    // ─── Test 9: Notification Deduplication ──────────────────────────────
    {
      console.log('Test 9: Duplicate notifications are skipped if already dispatched...');
      const notificationsCreated = [];

      notificationService.createNotification = async (payload) => {
        notificationsCreated.push(payload);
        return { notification_id: 'notif-9', ...payload };
      };

      const mockRequest = {
        id: 'req-9999',
        order_id: 'ord-9999',
        customer_id: 'user-cust-9',
        status: 'out_for_delivery',
        fulfillment_method: 'delivery',
      };

      mockPool({
        queryFn: async (sql) => {
          if (sql.includes('SELECT fr.*')) {
            return { rows: [mockRequest] };
          }
          if (sql.includes('UPDATE fulfillment_requests')) {
            return { rowCount: 1, rows: [{ ...mockRequest, status: 'completed' }] };
          }
          if (sql.includes('UPDATE projects') || sql.includes('UPDATE orders') || sql.includes('INSERT INTO audit_logs')) {
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('SELECT 1 FROM notifications')) {
            return { rows: [{ exists: 1 }] }; // Notification ALREADY exists!
          }
          return { rows: [] };
        },
      });

      await fulfillmentService.confirmDelivery('req-9999', 'user-cust-9', 'customer');

      assert.strictEqual(notificationsCreated.length, 0, 'Should not create duplicate notifications');
      console.log('✓ Test 9 Passed: Notifications are deduplicated safely.\n');
    }

    // ─── Test 10: Stuck Fulfillment Detection Logic ──────────────────────
    {
      console.log('Test 10: detectStuckFulfillment recognizes delivered/fulfilled state and repairs...');

      const detectStuck = projectService.detectStuckFulfillment;
      assert.ok(typeof detectStuck === 'function', 'detectStuckFulfillment should be exported');

      // Case A: Normal completed project -> not stuck
      const normalCompleted = {
        fulfillment_status: 'completed',
        customization_status: 'fulfilled',
      };
      assert.strictEqual(detectStuck(normalCompleted), false);

      // Case B: Order delivered but project fulfillment still out_for_delivery -> stuck!
      const stuckDelivered = {
        fulfillment_status: 'out_for_delivery',
        order_status: 'delivered',
        customization_status: 'fulfilled',
      };
      assert.strictEqual(detectStuck(stuckDelivered), true);

      // Case C: delivered_at set on project but fulfillment_status not completed -> stuck!
      const stuckDeliveredAt = {
        fulfillment_status: 'out_for_delivery',
        delivered_at: new Date(),
      };
      assert.strictEqual(detectStuck(stuckDeliveredAt), true);

      // Case D: Cancelled project with handed-over build claim (claim_status: 'delivered') -> stuck!
      const stuckClaimDelivered = {
        status: 'cancelled',
        fulfillment_status: 'ready_for_delivery',
        customization_status: 'resolution_in_progress',
        build_claim: { claim_status: 'delivered' },
      };
      assert.strictEqual(detectStuck(stuckClaimDelivered), true);

      console.log('✓ Test 10 Passed: detectStuckFulfillment accurately flags desynchronized fulfillment states.\n');
    }

    // ─── Test 11: Current Build Claim Status Update Syncs Project & Order ──
    {
      console.log('Test 11: currentBuildClaimService transitions to delivered syncs project & order...');

      const executedQueries = [];
      mockPool({
        queryFn: async (sql, params) => {
          executedQueries.push({ sql, params });
          if (sql.includes('SELECT') && sql.includes('FROM current_build_claims')) {
            return {
              rows: [{
                claim_id: 'claim-11',
                project_id: 'proj-11',
                order_id: 'ord-11',
                claim_status: 'out_for_delivery',
                release_type: 'current_build',
                fulfillment_method: 'delivery',
              }],
            };
          }
          if (sql.includes('UPDATE current_build_claims')) {
            return {
              rowCount: 1,
              rows: [{
                claim_id: 'claim-11',
                claim_status: 'delivered',
                actual_release_date: new Date(),
              }],
            };
          }
          if (sql.includes('UPDATE projects') || sql.includes('UPDATE orders') || sql.includes('INSERT INTO audit_logs')) {
            return { rowCount: 1, rows: [] };
          }
          return { rows: [] };
        },
      });

      const updatedClaim = await currentBuildClaimService.updateClaimStatus(
        'proj-11',
        'admin-1',
        'delivered',
        { notes: 'Handed over' }
      );

      assert.strictEqual(updatedClaim.claim_status, 'delivered');

      const projSync = executedQueries.find((q) => q.sql.includes('UPDATE projects') && q.sql.includes("fulfillment_status = 'completed'"));
      assert.ok(projSync, 'Expected project fulfillment_status sync on claim delivery');

      const orderSync = executedQueries.find((q) => q.sql.includes('UPDATE orders') && q.sql.includes("customization_status = 'fulfilled'"));
      assert.ok(orderSync, 'Expected orders customization_status sync on claim delivery');

      console.log('✓ Test 11 Passed: Build claim handover syncs projects and orders.\n');
    }

    console.log('====================================================');
    console.log('All Customer Delivery Confirmation Tests PASSED! (11/11)');
    console.log('====================================================');
  } finally {
    resetPool();
  }
}

runTests().catch((err) => {
  console.error('Customer Delivery Confirmation Test Failed:', err);
  process.exit(1);
});
