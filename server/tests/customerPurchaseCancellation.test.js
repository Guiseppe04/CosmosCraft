const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const { getUserOrders } = require('../services/orderService');

test('customer purchases show legacy cancelled projects as cancelled and preserve other orders', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    if (sql.includes('SELECT * FROM orders WHERE user_id')) {
      assert.deepEqual(params, ['customer-1']);
      return { rows: [
        { order_id: 'cancelled-build', status: 'processing', customization_status: 'resolution_in_progress' },
        { order_id: 'active-build', status: 'processing' },
        { order_id: 'regular-order', status: 'shipped' },
      ] };
    }
    if (sql.includes('FROM projects WHERE')) {
      return { rows: [
        { order_id: 'cancelled-build', status: 'cancelled' },
        { order_id: 'active-build', status: 'in_progress' },
      ] };
    }
    return { rows: [] };
  };
  try {
    const orders = await getUserOrders('customer-1');
    assert.equal(orders[0].status, 'cancelled');
    assert.equal(orders[0].customization_status, 'resolution_in_progress');
    assert.equal(orders[1].status, 'processing');
    assert.equal(orders[2].status, 'shipped');
  } finally {
    pool.query = originalQuery;
  }
});
