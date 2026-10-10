const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const service = require('../services/appointmentRefundService');
const { appointmentValidation } = require('../utils/appointmentValidation');

test('refund destinations require either account details or an HTTPS QR image', () => {
  const base = { appointment_id: '11111111-1111-4111-8111-111111111111', refund_method: 'GCash' };
  const schema = appointmentValidation.createRefundRequestSchema;
  const account = schema.validate({ ...base, account_holder: ' Customer ', account_number: '09123456789' });
  assert.ifError(account.error);
  assert.equal(account.value.destination_type, 'account');
  assert.equal(account.value.account_holder, 'Customer');
  const qr = schema.validate({ ...base, destination_type: 'qr', qr_code_url: 'https://example.test/qr.png', account_holder: 'Stale name', account_number: 'Stale number' });
  assert.ifError(qr.error);
  assert.equal(qr.value.account_holder, undefined);
  assert.equal(qr.value.account_number, undefined);
  for (const fields of [
    {}, { account_holder: 'Customer' }, { account_holder: '', account_number: '123' },
    { destination_type: 'qr' }, { destination_type: 'qr', qr_code_url: '' },
    { destination_type: 'qr', qr_code_url: 'http://example.test/qr.png' },
    { destination_type: 'qr', qr_code_url: 'javascript:alert(1)' },
    { destination_type: 'other', account_holder: 'Customer', account_number: '123' },
  ]) assert.ok(schema.validate({ ...base, ...fields }).error);
});

test('refund controller forwards QR destinations without requiring hidden account fields', async (t) => {
  const appointments = require('../services/appointmentService');
  const controller = require('../controllers/appointmentController');
  const appointment_id = '11111111-1111-4111-8111-111111111111';
  let submitted;
  t.mock.method(appointments, 'getAppointmentById', async () => ({ appointment_id, user_id: 'u', payment_method: 'e_wallet' }));
  t.mock.method(appointments, 'createRefundRequest', async data => { submitted = data; return { refund_request_id: 'r', ...data }; });
  const response = { statusCode: 0, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; } };
  await controller.createRefundRequest({ user: { user_id: 'u', role: 'customer' }, body: {
    appointment_id, refund_method: 'GCash', destination_type: 'qr', qr_code_url: 'https://example.test/qr.png',
  } }, response, error => { throw error; });
  assert.equal(response.statusCode, 201);
  assert.equal(submitted.destination_type, 'qr');
  assert.equal(submitted.qr_code_url, 'https://example.test/qr.png');
  assert.equal(submitted.account_holder, undefined);
  assert.equal(submitted.account_number, undefined);
});

test('QR refunds persist the image without account details and reject missing or invalid destinations', async (t) => {
  let saved;
  let rolledBack = false;
  t.mock.method(service, 'recordEvent', async () => {});
  t.mock.method(service, 'notify', async () => {});
  t.mock.method(pool, 'connect', async () => ({ async query(sql, params) {
    if (sql.startsWith('SELECT * FROM appointments')) return { rows: [{ appointment_id: 'a', user_id: 'u', status: 'cancelled', payment_method: 'e_wallet', payment_status: 'approved', approved_payment_amount: 500 }] };
    if (sql.startsWith('INSERT INTO appointment_refunds')) {
      saved = params;
      return { rows: [{ refund_request_id: 'qr-refund', destination_type: params[8], qr_code_url: params[9] }] };
    }
    if (sql === 'ROLLBACK') rolledBack = true;
    return { rows: [] };
  }, release() {} }));
  const data = { appointment_id: 'a', user_id: 'u', refund_method: 'GCash', destination_type: 'qr', qr_code_url: 'https://example.test/qr.png', account_holder: 'Stale name', account_number: 'Stale number' };
  const result = await service.create(data);
  assert.equal(result.qr_code_url, data.qr_code_url);
  assert.deepEqual(saved.slice(5, 7), [null, null]);
  assert.equal(saved[8], 'qr');
  for (const qr_code_url of [undefined, '', 'http://example.test/qr.png']) {
    saved = null;
    rolledBack = false;
    await assert.rejects(service.create({ ...data, qr_code_url }), error => error.statusCode === 400);
    assert.equal(saved, null);
    assert.equal(rolledBack, true);
  }
});
test('refund creation rejects cash payments, unapproved payments, wrong owners, wrong appointment status and invalid amounts', async () => {
  const original = pool.connect;
  try {
    const cases = [
      [{payment_status:'pending'}, /Approved/], [{payment_status:'rejected'}, /Approved/],
      [{payment_status:'verified'}, /Approved/], [{payment_status:null}, /Approved/],
      [{status:'cancelled',payment_status:'pending'}, /Approved/],
      [{user_id:'other'}, /Only the appointment customer/], [{status:'confirmed'}, /No Show/],
      [{approved_payment_amount:null}, /confirm/],
      [{payment_method:'cash'}, /only for e-wallet or bank/],
      [{status:'cancelled',payment_method:'cash'}, /only for e-wallet or bank/],
      [{payment_method:null}, /only for e-wallet or bank/],
      [{payment_method:'card'}, /only for e-wallet or bank/],
    ];
    for (const [override, message] of cases) {
      let rolledBack = false;
      pool.connect = async () => ({ query: async sql => {
        if (sql.startsWith('SELECT * FROM appointments')) return { rows:[{appointment_id:'a',user_id:'u',status:'no_show',payment_method:'e_wallet',payment_status:'approved',approved_payment_amount:500,...override}] };
        if (sql === 'ROLLBACK') rolledBack = true;
        assert.ok(!sql.startsWith('INSERT'));
        return {rows:[]};
      }, release() {} });
      await assert.rejects(service.create({appointment_id:'a',user_id:'u',refund_method:'GCash',account_holder:'Customer',account_number:'09123456789'}),message);
      assert.ok(rolledBack);
    }
  } finally { pool.connect = original; }
});
test('cancelled appointments reuse the refund flow and prevent duplicate requests', async () => {
  const original = { connect: pool.connect, recordEvent: service.recordEvent, notify: service.notify };
  let existing = false;
  const statements = [];
  try {
    service.recordEvent = async () => {};
    service.notify = async () => {};
    pool.connect = async () => ({ query: async (sql, params) => {
      statements.push(sql);
      if (sql.startsWith('SELECT * FROM appointments')) return { rows: [{ appointment_id: 'a', user_id: 'u', status: 'cancelled', payment_method: 'e_bank', payment_status: 'approved', approved_payment_amount: 500 }] };
      if (sql.startsWith('SELECT 1 FROM appointment_refunds')) return { rows: existing ? [{}] : [] };
      if (sql.startsWith('INSERT INTO appointment_refunds')) {
        assert.equal(params[2], 500);
        existing = true;
        return { rows: [{ refund_request_id: 'r', amount_requested: 500 }] };
      }
      return { rows: [] };
    }, release() {} });
    const data = { appointment_id: 'a', user_id: 'u', refund_method: 'GCash', account_holder: 'Customer', account_number: '09123456789' };
    assert.equal((await service.create(data)).refund_request_id, 'r');
    assert.ok(statements.includes('COMMIT'));
    await assert.rejects(service.create(data), /already been requested/);
    assert.equal(statements.filter(sql => sql.startsWith('INSERT INTO appointment_refunds')).length, 1);
    assert.ok(statements.includes('ROLLBACK'));
  } finally {
    pool.connect = original.connect;
    service.recordEvent = original.recordEvent;
    service.notify = original.notify;
  }
});

test('approved e-wallet and bank payments can request refunds for cancelled and no-show appointments', async (t) => {
  t.mock.method(service, 'recordEvent', async () => {});
  t.mock.method(service, 'notify', async () => {});
  for (const status of ['cancelled', 'no_show']) {
    for (const payment_method of ['e_wallet', 'e_bank', 'gcash', 'bank_transfer']) {
      let committed = false;
      t.mock.method(pool, 'connect', async () => ({ async query(sql, params) {
        if (sql.startsWith('SELECT * FROM appointments')) return { rows: [{ appointment_id: 'a', user_id: 'u', status, payment_method, payment_status: 'approved', approved_payment_amount: 500 }] };
        if (sql.startsWith('INSERT INTO appointment_refunds')) {
          assert.equal(JSON.parse(params[3]).payment_method, payment_method);
          assert.equal(params[2], 500);
          return { rows: [{ refund_request_id: 'r', amount_requested: 500 }] };
        }
        if (sql === 'COMMIT') committed = true;
        return { rows: [] };
      }, release() {} }));
      assert.equal((await service.create({ appointment_id: 'a', user_id: 'u', refund_method: 'GCash', account_holder: 'Customer', account_number: '09123456789' })).refund_request_id, 'r');
      assert.equal(committed, true);
    }
  }
});
test('refund completion requires processing and either a transaction reference or payment proof', async () => {
  const original = pool.connect;
  try {
    for (const [status, data, message] of [
      ['pending',{status:'refunded',refund_reference:'x'},/Invalid/],
      ['processing',{status:'refunded'},/reference/],
      ['processing',{status:'refunded',refund_reference:'x',proof_url:'http://example.test/proof.png'},/HTTPS/],
      ['refunded',{status:'processing'},/Invalid/],
      ['processing',{status:'rejected'},/reason/],
    ]) {
      pool.connect = async () => ({query:async sql => sql.includes('FOR UPDATE') ? {rows:[{status}]} : {rows:[]},release(){}});
      await assert.rejects(service.update('r','admin',data),message);
    }
  } finally { pool.connect = original; }
});

test('refund status updates persist details and broadcast appointment identifiers after commit', async t => {
  const sockets = require('../services/socketService');
  const broadcasts = [];
  let committed = false;
  let saved;
  t.mock.method(service, 'recordEvent', async () => {});
  t.mock.method(service, 'notify', async () => {});
  t.mock.method(sockets, 'emitToUserAndStaff', (userId, event, payload) => {
    assert.equal(committed, true, 'Broadcast must follow commit');
    broadcasts.push({ userId, event, payload });
  });
  for (const data of [
    { status: 'processing' },
    { status: 'refunded', refund_reference: ' TRANSFER-123 ', proof_url: 'https://example.test/proof.png', admin_notes: 'Sent' },
    { status: 'refunded', proof_url: 'https://example.test/proof.png', admin_notes: 'Sent' },
    { status: 'refunded', refund_reference: ' TRANSFER-123 ', admin_notes: 'Sent' },
    { status: 'rejected', admin_notes: 'Invalid destination' },
  ]) {
    const status = data.status;
    committed = false;
    t.mock.method(pool, 'connect', async () => ({ async query(sql, params) {
      if (sql.includes('FOR UPDATE OF r,a')) return { rows: [{ appointment_id: 'a', user_id: 'customer', status: status === 'processing' ? 'pending' : 'processing' }] };
      if (sql.startsWith('UPDATE appointment_refunds')) {
        saved = params;
        return { rows: [{ refund_request_id: 'r', status: params[1], refund_reference: params[2], proof_url: params[3], admin_notes: params[4] }] };
      }
      if (sql === 'COMMIT') committed = true;
      return { rows: [] };
    }, release() {} }));
    const result = await service.update('r', 'admin', data);
    assert.equal(result.status, status);
    if (status === 'refunded') assert.deepEqual(saved.slice(2, 5), [data.refund_reference?.trim(), data.proof_url, 'Sent']);
    assert.deepEqual(broadcasts.at(-1), { userId: 'customer', event: 'appointment:updated', payload: { action: 'refund_updated', appointment_id: 'a', refund_request_id: 'r', status } });
  }
});

test('customer rescheduling preserves the original schedule and creates one successor', async () => {
  const appointments = require('../services/appointmentService');
  const audit = require('../services/auditService');
  const original = { connect:pool.connect, get:appointments.getAppointmentById, log:audit.logAppointmentEvent, notify:service.notify };
  const id = '12345678-1234-4234-8234-123456789012';
  const successor = '22345678-1234-4234-8234-123456789012';
  const queries = [];
  const row = {appointment_id:id,user_id:'customer',status:'confirmed',payment_status:'approved',scheduled_at:'2026-10-03T07:00:00Z'};
  try {
    audit.logAppointmentEvent = async () => {};
    service.notify = async () => {};
    appointments.getAppointmentById = async target => ({appointment_id:target});
    pool.connect = async () => ({query:async (sql,params) => {
      queries.push([sql,params]);
      if(sql.includes('FOR UPDATE OF a')) return {rows:[row]};
      if(sql.includes('AS staff_count')) return {rows:[{staff_count:3}]};
      if(sql.includes('COUNT(')) return {rows:[{count:0,active_count:0}]};
      if(sql.startsWith('INSERT INTO appointments')) return {rows:[{appointment_id:successor}]};
      if(sql.startsWith('UPDATE appointments SET scheduled_at')) return {rows:[{...row,appointment_id:successor,scheduled_at:params[0]}]};
      return {rows:[]};
    },release(){}});
    const result = await appointments.updateAppointment(id,{scheduled_at:'2026-10-07T07:00:00Z'},'customer');
    assert.equal(result.appointment_id,successor);
    assert.equal(queries.filter(([sql])=>sql.startsWith('INSERT INTO appointments')).length,1);
    const oldUpdate = queries.find(([sql])=>sql.includes("SET status = 'rescheduled_by_customer'"));
    assert.ok(oldUpdate);
    assert.doesNotMatch(oldUpdate[0],/scheduled_at =/);
    const newUpdate = queries.find(([sql])=>sql.startsWith('UPDATE appointments SET scheduled_at'));
    assert.equal(newUpdate[1].at(-1),successor);
    assert.ok(queries.some(([sql])=>sql==='COMMIT'));
  } finally { pool.connect=original.connect; appointments.getAppointmentById=original.get; audit.logAppointmentEvent=original.log; service.notify=original.notify; }
});
