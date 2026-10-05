const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const service = require('../services/appointmentService');
const audit = require('../services/auditService');

test('prepaid e-wallet / bank transfer appointments cannot be confirmed until the payment is approved', async () => {
  const id = '12345678-1234-4234-8234-123456789012';
  const original = { connect: pool.connect, get: service.getAppointmentById, log: audit.logAppointmentEvent };

  audit.logAppointmentEvent = async () => {};

  const buildClient = (appointmentRow) => ({
    async query(sql, params = []) {
      if (sql.startsWith('BEGIN')) return {};
      if (sql.startsWith('COMMIT')) return {};
      if (sql.startsWith('ROLLBACK')) return {};
      if (sql === 'SELECT pg_advisory_xact_lock($1, $2)') return { rows: [] };
      if (sql.includes('FOR UPDATE OF a')) return { rows: [{ ...appointmentRow }] };
      if (sql.startsWith('UPDATE appointments SET')) return { rows: [{ ...appointmentRow }] };
      if (sql.startsWith('INSERT INTO notifications')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    async release() {},
  });

  const blockedAssertion = async (label) => {
    await assert.rejects(
      service.updateStatus(id, 'confirmed', 'reason', 'staff-1'),
      (err) => err.statusCode === 409 && /cannot be confirmed until the .* payment has been reviewed and approved/.test(err.message),
      `${label} should block updateStatus confirmation`,
    );
    await assert.rejects(
      service.updateAppointment(id, { status: 'confirmed' }, 'staff-1'),
      (err) => err.statusCode === 409 && /cannot be confirmed until the .* payment has been reviewed and approved/.test(err.message),
      `${label} should block updateAppointment confirmation`,
    );
  };

  try {
    // Every prepaid method with any non-approved payment status is blocked on both endpoints.
    for (const payment_method of ['e_wallet', 'e_bank', 'gcash', 'bank_transfer', 'bank', 'E-WALLET']) {
      for (const payment_status of ['pending', 'proof_submitted', 'under_review', 'rejected', 'failed', undefined, null]) {
        pool.connect = async () => buildClient({
          appointment_id: id,
          status: 'pending',
          appointment_type: 'service_in_shop',
          reference_code: 'APT-TEST',
          scheduled_at: '2026-10-03T07:00:00Z',
          user_id: 'customer-1',
          payment_method,
          payment_status,
          services: [],
        });
        await blockedAssertion(`${payment_method}/${String(payment_status)}`);
      }
    }

    // Cash may be confirmed regardless of payment status.
    for (const payment_status of ['pending', 'approved', undefined]) {
      const row = {
        appointment_id: id,
        status: 'pending',
        appointment_type: 'service_in_shop',
        reference_code: 'APT-CASH',
        scheduled_at: '2026-10-03T07:00:00Z',
        user_id: 'customer-1',
        payment_method: 'cash',
        payment_status,
        services: [],
      };
      pool.connect = async () => buildClient(row);
      service.getAppointmentById = async () => ({ appointment_id: id, status: 'confirmed', payment_method: 'cash', payment_status });
      const viaStatus = await service.updateStatus(id, 'confirmed', 'reason', 'staff-1');
      assert.equal(viaStatus.status, 'confirmed');
      const viaPatch = await service.updateAppointment(id, { status: 'confirmed' }, 'staff-1');
      assert.equal(viaPatch.status, 'confirmed');
    }

    // Approved payment unlocks confirmation for prepaid methods.
    for (const payment_status of ['approved', 'verified', 'paid']) {
      const row = {
        appointment_id: id,
        status: 'pending',
        appointment_type: 'service_in_shop',
        reference_code: 'APT-PAID',
        scheduled_at: '2026-10-03T07:00:00Z',
        user_id: 'customer-1',
        payment_method: 'e_wallet',
        payment_status,
        services: [],
      };
      pool.connect = async () => buildClient(row);
      service.getAppointmentById = async () => ({ appointment_id: id, status: 'confirmed', payment_method: 'e_wallet', payment_status });
      const viaStatus = await service.updateStatus(id, 'confirmed', 'reason', 'staff-1');
      assert.equal(viaStatus.status, 'confirmed');
    }
  } finally {
    pool.connect = original.connect;
    service.getAppointmentById = original.get;
    audit.logAppointmentEvent = original.log;
  }
});