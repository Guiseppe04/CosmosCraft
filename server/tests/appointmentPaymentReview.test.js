const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const appointments = require('../services/appointmentService');
const audit = require('../services/auditService');
const refunds = require('../services/appointmentRefundService');
const id = '12345678-1234-4234-8234-123456789012';

test('admin payment reviews persist the status, approval amount, audit and notification', async () => {
  const original = { connect: pool.connect, get: appointments.getAppointmentById, log: audit.logAppointmentEvent, notify: refunds.notify };
  try {
    for (const status of ['pending', 'approved', 'rejected']) {
      const events = [];
      const row = { appointment_id: id, user_id: 'customer', status: 'no_show', payment_status: 'pending' };
      let committed = false;
      pool.connect = async () => ({ async query(sql, params) {
        if (sql.includes('FOR UPDATE OF a')) return { rows: [{ ...row }] };
        if (sql.includes('SUM(s.price)')) return { rows: [{ amount: 750 }] };
        if (sql.startsWith('UPDATE appointments SET')) {
          row.payment_status = params[1];
          if (status === 'approved') {
            assert.match(sql, /approved_payment_amount = \$3/);
            assert.equal(params[2], 750);
            row.approved_payment_amount = params[2];
          }
          return { rows: [{ ...row }] };
        }
        if (sql === 'COMMIT') committed = true;
        return { rows: [] };
      }, release() {} });
      appointments.getAppointmentById = async () => ({ ...row });
      audit.logAppointmentEvent = async event => events.push(event);
      refunds.notify = async (...args) => events.push(args);
      const result = await appointments.updatePaymentStatus(id, status, null, null, 'admin');
      assert.equal(result.payment_status, status);
      assert.equal(committed, true);
      assert.ok(events.some(event => event.action === 'PAYMENT' && event.status === status));
      assert.ok(events.some(event => Array.isArray(event) && event[1] === 'customer'));
    }
  } finally {
    pool.connect = original.connect; appointments.getAppointmentById = original.get;
    audit.logAppointmentEvent = original.log; refunds.notify = original.notify;
  }
});

test('payment review rejects missing, historical, refunded and refund-locked records', async () => {
  const original = pool.connect;
  try {
    for (const [row, refundRows, status, message] of [
      [null, [], 'approved', /not found/],
      [{ status: 'rescheduled_by_customer' }, [], 'approved', /Historical/],
      [{ payment_status: 'refunded' }, [], 'pending', /Refund Management/],
      [{ payment_status: 'approved' }, [], 'refunded', /Refund Management/],
      [{ payment_status: 'approved' }, [{}], 'rejected', /refund request exists/],
    ]) {
      let rollback = false;
      pool.connect = async () => ({ async query(sql) {
        assert.ok(!sql.startsWith('UPDATE'));
        if (sql.includes('FOR UPDATE OF a')) return { rows: row ? [row] : [] };
        if (sql.includes('FROM appointment_refunds')) return { rows: refundRows };
        if (sql === 'ROLLBACK') rollback = true;
        return { rows: [] };
      }, release() {} });
      await assert.rejects(appointments.updatePaymentStatus(id, status), message);
      assert.equal(rollback, true);
    }
  } finally { pool.connect = original; }
});
