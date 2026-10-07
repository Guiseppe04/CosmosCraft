const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFixture, png } = require('./helpers/orderRefundFixture');
const { createRefundRequestSchema } = require('../utils/validation');
const workflow = require('../services/orderRefundWorkflow');
const orders = require('../services/orderService');
const fs = require('fs');
const path = require('path');

const destination = { method: 'e_wallet', provider: 'GCash', accountName: 'Customer Test', accountNumber: '09123456789', qrImage: png };
test('refund fields reject incomplete destinations, bank QR uploads, duplicate items and disguised images', () => {
  const base = { reason: 'damaged', items: [{ order_item_id: 1, quantity: 1 }], destination };
  assert.equal(createRefundRequestSchema.validate(base).error, undefined);
  assert.ok(createRefundRequestSchema.validate({ ...base, destination: undefined }).error);
  assert.equal(createRefundRequestSchema.validate({ ...base, destination: { method:'e_wallet',qrImage:png } }).error,undefined);
  assert.equal(createRefundRequestSchema.validate({ ...base, destination: { method:'e_wallet',qrImage:png,provider:'',accountName:'',accountNumber:'' } }).error,undefined);
  for (const field of ['method','provider','accountName','accountNumber']) {
    assert.ok(createRefundRequestSchema.validate({ ...base, destination: { ...destination, qrImage:undefined, [field]: '' } }).error, field);
  }
  assert.ok(createRefundRequestSchema.validate({ ...base, destination: { ...destination, method: 'e_bank' } }).error);
  assert.ok(createRefundRequestSchema.validate({ ...base, items: [base.items[0],base.items[0]] }).error);
  assert.throws(() => workflow.decodeImage('data:image/png;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), /Invalid image/);
});

test('migration preserves legacy records and legacy reads work before migration deployment', async () => {
  const fixture = await createFixture();
  try {
    const legacy = (await fixture.db.query(`INSERT INTO refund_requests(order_id,user_id,reason,status,amount_requested,admin_notes)
      VALUES($1,$2,'Legacy refund','approved',250,'Existing notes') RETURNING *`, [fixture.ids.order,fixture.ids.customer])).rows[0];
    const originalOrder = (await fixture.db.query('SELECT * FROM orders')).rows[0];
    const originalPayment = (await fixture.db.query('SELECT * FROM payments')).rows[0];
    await fixture.db.exec(fs.readFileSync(path.join(__dirname,'../migrations/42_order_refund_workflow.sql'),'utf8'));
    assert.deepEqual((await fixture.db.query('SELECT * FROM refund_requests')).rows[0],legacy);
    assert.deepEqual((await fixture.db.query('SELECT * FROM orders')).rows[0],originalOrder);
    assert.deepEqual((await fixture.db.query('SELECT * FROM payments')).rows[0],originalPayment);
    // Remove only the new schema from this isolated database to emulate pre-deployment.
    await fixture.db.exec(`DROP TABLE refund_private_files; DROP TABLE refund_private_destinations;
      ALTER TABLE refund_requests DROP COLUMN workflow_version, DROP COLUMN preferred_method,
      DROP COLUMN refund_sent_at,DROP COLUMN completed_at,DROP COLUMN completed_by,DROP COLUMN sent_by;`);
    assert.equal((await orders.getUserOrders(fixture.ids.customer))[0].refund_request_status,'approved');
    assert.equal((await orders.getRefundRequestById(legacy.refund_request_id,true)).status,'approved');
    assert.equal((await orders.updateRefundStatus(legacy.refund_request_id,'processing')).status,'processing');
    await assert.rejects(workflow.ensureReady(),/apply refund migration 42/);
  } finally { await fixture.close(); }
});

test('bank refunds support review rejection and partial payments preserve the remaining original payment', async () => {
  const fixture = await createFixture();
  const admin = { id: fixture.ids.admin, role:'admin' };
  const bank = { method:'e_bank', provider:'Test Bank',accountName:'Customer Test',accountNumber:'1234567890',details:'Main branch' };
  try {
    const create = () => orders.createRefundRequest({ orderId:fixture.ids.order,userId:fixture.ids.customer,reason:'damaged',items:[{order_item_id:1,quantity:1}],destination:bank });
    let refund = await create();
    await workflow.update(refund.refund_request_id,'under_review',admin);
    await assert.rejects(workflow.update(refund.refund_request_id,'rejected',admin),/rejection reason/);
    await workflow.update(refund.refund_request_id,'rejected',admin,{adminNotes:'Not eligible: wear from use.'});
    const rejected = (await orders.getUserOrders(fixture.ids.customer))[0];
    assert.equal(rejected.refund_rejection_reason,'Not eligible: wear from use.');
    refund = await create();
    await workflow.update(refund.refund_request_id,'under_review',admin);
    await assert.rejects(workflow.update(refund.refund_request_id,'approved',admin,{approvedAmount:1001}),/cannot exceed/);
    await workflow.update(refund.refund_request_id,'approved',admin);
    await workflow.update(refund.refund_request_id,'processing',admin);
    await assert.rejects(workflow.update(refund.refund_request_id,'refund_sent',admin,{proofImage:'data:image/png;base64,aGVsbG8='}),/Invalid image/);
    assert.equal((await fixture.db.query("SELECT * FROM refund_private_files WHERE kind='proof'")).rows.length,0);
    const sent = await workflow.update(refund.refund_request_id,'refund_sent',admin,{proofImage:png});
    assert.equal(sent.refund_method,'bank_transfer');
    assert.equal(Number(sent.refunded_amount),500);
    const originalPayment = (await fixture.db.query('SELECT amount,status FROM payments')).rows[0];
    assert.equal(originalPayment.status,'verified');
    assert.equal(Number(originalPayment.amount),1000);
    await workflow.update(refund.refund_request_id,'completed',{id:fixture.ids.customer,role:'customer'});
    assert.equal((await fixture.db.query('SELECT payment_status FROM orders')).rows[0].payment_status,'approved');
    await assert.rejects(orders.createRefundRequest({ orderId:fixture.ids.order,userId:fixture.ids.customer,reason:'damaged',items:[{order_item_id:1,quantity:2}],destination:bank }),/exceeds the remaining/);
    assert.equal((await fixture.db.query('SELECT * FROM refund_requests')).rows.length,2);
    assert.equal((await fixture.db.query('SELECT * FROM refund_private_destinations')).rows.length,2);
  } finally { await fixture.close(); }
});

test('complete HTTP and PostgreSQL refund flow enforces privacy, proof, review order and customer confirmation', async () => {
  const fixture = await createFixture();
  const server = fixture.app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const root = `http://127.0.0.1:${server.address().port}/api/orders`;
  async function request(actor,path,method='GET',body) {
    const response = await fetch(root + path, { method, headers: { 'Content-Type':'application/json', 'x-test-actor':actor }, body: body ? JSON.stringify(body) : undefined });
    return { status:response.status, json:await response.json() };
  }
  try {
    let result = await request('customer',`/${fixture.ids.order}/refund-request`,'POST',{ reason:'damaged',items:[{order_item_id:1,quantity:2}],destination:{ method:'e_wallet',qrImage:png } });
    assert.equal(result.status,201,JSON.stringify(result.json));
    const id = result.json.data.refund_request_id;
    assert.equal(Number(result.json.data.amount_requested),1000);
    assert.equal(result.json.data.payment_destination,undefined);
    const detail = await request('admin',`/refund-requests/${id}`);
    assert.equal(detail.json.data.payment_destination.accountNumber,undefined);
    assert.equal(detail.json.data.has_qr,true);
    assert.equal((await request('staff',`/refund-requests/${id}`)).json.data.payment_destination,undefined);
    assert.equal((await request('customer',`/refund-requests/${id}/files/qr`)).status,403);
    assert.equal((await request('staff',`/refund-requests/${id}/files/qr`)).status,403);
    assert.equal((await request('admin',`/refund-requests/${id}/files/qr`)).json.data.image,png);
    assert.equal((await request('staff',`/refund-requests/${id}/status`,'PUT',{status:'under_review'})).status,403);
    assert.equal((await request('admin',`/refund-requests/${id}/status`,'PUT',{status:'approved'})).status,409);
    for (const status of ['under_review','approved','processing']) {
      result = await request('admin',`/refund-requests/${id}/status`,'PUT',{status});
      assert.equal(result.status,200,JSON.stringify(result.json));
      assert.equal(result.json.data.status,status);
    }
    assert.equal((await request('admin',`/refund-requests/${id}/status`,'PUT',{status:'refund_sent'})).status,400);
    result = await request('admin',`/refund-requests/${id}/status`,'PUT',{status:'refund_sent',proofImage:png,refundReference:'TEST-REF-123'});
    assert.equal(result.status,200,JSON.stringify(result.json));
    assert.ok(result.json.data.refund_sent_at);
    assert.equal((await request('other',`/refund-requests/${id}/files/proof`)).status,403);
    assert.equal((await request('staff',`/refund-requests/${id}/files/proof`)).status,403);
    assert.equal((await request('customer',`/refund-requests/${id}/files/proof`)).json.data.image,png);
    const order = (await request('customer','/my-orders')).json.data.orders[0];
    assert.equal(order.refund_request_status,'refund_sent');
    assert.equal(order.refund_reference,'TEST-REF-123');
    assert.equal(order.payment_destination,undefined);
    assert.equal((await request('other',`/refund-requests/${id}/confirm`,'POST')).status,403);
    result = await request('customer',`/refund-requests/${id}/confirm`,'POST');
    assert.equal(result.status,200,JSON.stringify(result.json));
    assert.equal(result.json.data.status,'completed');
    assert.ok(result.json.data.completed_at);
    assert.equal((await request('admin',`/refund-requests/${id}/status`,'PUT',{status:'processing'})).status,409);
    const payments = await fixture.db.query('SELECT amount,status FROM payments');
    assert.equal(Number(payments.rows[0].amount),1000);
    assert.equal(payments.rows[0].status,'refunded');
    const audit = await fixture.db.query('SELECT new_status,details FROM audit_logs');
    assert.deepEqual(audit.rows.map(row => row.new_status),['under_review','approved','processing','refund_sent','completed']);
    assert.ok(!JSON.stringify(audit.rows).includes('09123456789'));
    await fixture.db.query('SET ROLE anon');
    await assert.rejects(fixture.db.query('SELECT * FROM refund_private_files'),/permission denied/);
    await assert.rejects(fixture.db.query('SELECT * FROM refund_private_destinations'),/permission denied/);
    await fixture.db.query('RESET ROLE');
  } finally { await new Promise(resolve => server.close(resolve)); await fixture.close(); }
});
