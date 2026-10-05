const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const orders = require('../services/orderService');
const audit = require('../services/auditService');
const { updateOrderSchema, updateShipmentSchema } = require('../utils/validation');

test('shipping requests require an explicit fee and reject invalid money amounts', () => {
  for (const schema of [updateOrderSchema, updateShipmentSchema]) {
    const base = schema === updateOrderSchema
      ? { status: 'shipped', tracking_number: 'TRACK123' }
      : { tracking_number: 'TRACK123', courier_name: 'Courier' };
    for (const fee of [undefined, null, '', '250', -1, Infinity, NaN, 1.234, 10000000000]) {
      assert.ok(schema.validate({ ...base, additional_shipping_fee: fee }).error, `fee ${fee} should fail`);
    }
    for (const fee of [0, 250, 250.75]) {
      assert.equal(schema.validate({ ...base, additional_shipping_fee: fee }).error, undefined);
    }
  }
  assert.equal(updateOrderSchema.validate({ notes: 'Customer note' }).error, undefined);
});

test('both shipping services store the separate quote without altering paid order totals', async () => {
  const originalQuery = pool.query;
  const originalLog = audit.logOrderEvent;
  const writes = [];
  pool.query = async (sql, params) => {
    if (sql.includes('SELECT status')) return { rows: [{ status: 'processing', payment_status: 'approved', tracking_number: 'TRACK123' }] };
    writes.push({ sql, params });
    return { rows: [{ order_id: 'order', status: 'shipped', additional_shipping_fee: 250.75 }] };
  };
  audit.logOrderEvent = async () => {};
  try {
    for (const fee of [undefined, null, '', -10, 'abc', 1.234]) {
      await assert.rejects(orders.updateOrder('order', { status: 'shipped', tracking_number: 'TRACK123', additional_shipping_fee: fee }), /shipping fee/);
      await assert.rejects(orders.updateShipment('order', { tracking_number: 'TRACK123', courier_name: 'Courier', additional_shipping_fee: fee }), /shipping fee/);
    }
    assert.equal(writes.length, 0);
    const result = await orders.updateOrder('order', { status: 'shipped', tracking_number: 'TRACK123', additional_shipping_fee: 250.75 });
    assert.equal(result.additional_shipping_fee, 250.75);
    await orders.updateShipment('order', { tracking_number: 'TRACK123', courier_name: 'Courier', additional_shipping_fee: 250.75 });
    await orders.updateOrder('order', { status: 'shipped', tracking_number: 'TRACK123', additional_shipping_fee: 0 });
    assert.equal(writes.length, 3);
    assert.equal(writes[0].params[12], 250.75);
    assert.equal(writes[1].params[5], 250.75);
    assert.equal(writes[2].params[12], 0);
    for (const { sql } of writes) {
      assert.match(sql, /additional_shipping_fee/);
      assert.doesNotMatch(sql, /total_amount\s*=|shipping_cost\s*=|UPDATE payments/);
    }
  } finally {
    pool.query = originalQuery;
    audit.logOrderEvent = originalLog;
  }
});
