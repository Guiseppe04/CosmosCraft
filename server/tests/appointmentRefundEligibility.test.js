const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const service = require('../services/appointmentRefundService');
test('refund creation rejects unapproved payments, wrong owners, wrong appointment status and invalid amounts', async () => {
  const original = pool.connect;
  try {
    const cases = [
      [{payment_status:'pending'}, /Approved/], [{payment_status:'rejected'}, /Approved/],
      [{payment_status:'verified'}, /Approved/], [{payment_status:null}, /Approved/],
      [{user_id:'other'}, /Only the appointment customer/], [{status:'confirmed'}, /No Show/],
      [{approved_payment_amount:null}, /confirm/],
    ];
    for (const [override, message] of cases) {
      let rolledBack = false;
      pool.connect = async () => ({ query: async sql => {
        if (sql.startsWith('SELECT * FROM appointments')) return { rows:[{appointment_id:'a',user_id:'u',status:'no_show',payment_status:'approved',approved_payment_amount:500,...override}] };
        if (sql === 'ROLLBACK') rolledBack = true;
        assert.ok(!sql.startsWith('INSERT'));
        return {rows:[]};
      }, release() {} });
      await assert.rejects(service.create({appointment_id:'a',user_id:'u',refund_method:'GCash',account_holder:'Customer',account_number:'09123456789'}),message);
      assert.ok(rolledBack);
    }
  } finally { pool.connect = original; }
});
test('refund completion requires processing and a transaction reference', async () => {
  const original = pool.connect;
  try {
    for (const [status, data, message] of [
      ['pending',{status:'refunded',refund_reference:'x'},/Invalid/],
      ['processing',{status:'refunded'},/reference/],
      ['refunded',{status:'processing'},/Invalid/],
      ['processing',{status:'rejected'},/reason/],
    ]) {
      pool.connect = async () => ({query:async sql => sql.includes('FOR UPDATE') ? {rows:[{status}]} : {rows:[]},release(){}});
      await assert.rejects(service.update('r','admin',data),message);
    }
  } finally { pool.connect = original; }
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
