const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const service = require('../services/appointmentService');
const settings = require('../services/paymentSettingsService');
const audit = require('../services/auditService');
const sockets = require('../services/socketService');

test('no-show sweep uses configured minutes, exact deadline, and publishes changes', async () => {
  const original = { query: pool.query, ensure: settings.ensurePaymentSettingsTable, log: audit.logAppointmentEvent, emit: sockets.emitToUserAndStaff };
  const events = [];
  let configuredMinutes = 30;
  settings.ensurePaymentSettingsTable = async () => {};
  audit.logAppointmentEvent = async () => {};
  sockets.emitToUserAndStaff = (...args) => events.push(args);
  pool.query = async (sql, params) => {
    if (sql.startsWith('SELECT no_show_grace_minutes')) return { rows: [{ no_show_grace_minutes: configuredMinutes }] };
    assert.match(sql, /WHERE status = 'confirmed'/);
    assert.match(sql, /scheduled_at <= now\(\) - \(\$1 \* interval '1 minute'\)/);
    assert.deepEqual(params, [configuredMinutes]);
    return { rows: [{ appointment_id: 'appointment-1', user_id: 'customer-1', status: 'no_show', scheduled_at: '2026-10-03T07:00:00Z' }] };
  };
  try {
    await service.autoMarkNoShows();
    configuredMinutes = 45;
    await service.autoMarkNoShows();
    assert.equal(events.length, 2);
    assert.equal(events[0][0], 'customer-1');
    assert.equal(events[0][1], 'appointment:updated');
    assert.equal(events[0][2].appointment.status, 'no_show');
  } finally {
    pool.query = original.query;
    settings.ensurePaymentSettingsTable = original.ensure;
    audit.logAppointmentEvent = original.log;
    sockets.emitToUserAndStaff = original.emit;
  }
});

test('rescheduling approved payments preserves payment data and reopens no-shows', async () => {
  const original = { connect: pool.connect, get: service.getAppointmentById, log: audit.logAppointmentEvent };
  const id = '12345678-1234-4234-8234-123456789012';
  audit.logAppointmentEvent = async () => {};
  try {
    for (const paymentStatus of ['approved', 'verified', 'paid', 'pending']) {
      const row = { appointment_id: id, status: 'no_show', payment_status: paymentStatus, payment_method: 'e_wallet', payment_proof_url: 'existing-proof', scheduled_at: '2026-10-03T07:00:00Z' };
      let committed = false;
      pool.connect = async () => ({
        async query(sql, params = []) {
          if (sql.includes('FOR UPDATE OF a')) return { rows: [{ ...row }] };
          if (sql.includes('AS staff_count')) return { rows: [{ staff_count: 3 }] };
          if (sql.includes('COUNT(')) return { rows: [{ count: 0 }] };
          if (sql.startsWith('UPDATE appointments SET')) {
            assert.doesNotMatch(sql, /payment_status =|payment_proof_url =/);
            if (paymentStatus !== 'pending') assert.doesNotMatch(sql, /payment_method =/);
            row.scheduled_at = params[0];
            row.status = params[1];
            if (paymentStatus === 'pending') row.payment_method = params[2];
            return { rows: [{ ...row }] };
          }
          if (sql === 'COMMIT') committed = true;
          return { rows: [] };
        }, release() {},
      });
      service.getAppointmentById = async () => ({ ...row });
      const result = await service.updateAppointment(id, { scheduled_at: '2026-10-07T07:00:00Z', payment_method: 'cash' });
      assert.equal(committed, true);
      assert.equal(result.appointment_id, id);
      assert.equal(result.payment_status, paymentStatus);
      assert.equal(result.payment_proof_url, 'existing-proof');
      assert.equal(result.status, paymentStatus === 'pending' ? 'pending' : 'confirmed');
      assert.equal(result.payment_method, paymentStatus === 'pending' ? 'cash' : 'e_wallet');
    }
  } finally {
    pool.connect = original.connect;
    service.getAppointmentById = original.get;
    audit.logAppointmentEvent = original.log;
  }
});
