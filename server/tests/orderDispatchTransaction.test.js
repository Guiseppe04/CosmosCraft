const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const orders = require('../services/orderService');

test('both shipping paths save evidence and update through the dispatch transaction', async () => {
  const dispatchPath = require.resolve('../services/dispatchPhotoService');
  const originalDispatch = require.cache[dispatchPath];
  const originalQuery = pool.query;
  const events = [];
  let rejectPhotos = false;
  let pickup = false;
  const db = {
    query: async (sql) => {
      if (sql.includes('SELECT status')) {
        return { rows: [{ status: 'processing', payment_status: 'approved', tracking_number: 'TRACK123' }] };
      }
      assert.match(sql, /UPDATE orders/);
      events.push('update');
      return { rows: [{ order_id: 'order', status: 'shipped' }] };
    },
  };
  require.cache[dispatchPath] = {
    exports: {
      transaction: async (orderId, actorId, operation) => {
        assert.equal(orderId, 'order');
        assert.equal(actorId, 'staff');
        events.push('begin');
        const result = await operation(db, { shipping_method: pickup ? 'pickup' : 'delivery' });
        events.push('commit');
        return result;
      },
      isPickup: (order) => order.shipping_method === 'pickup',
      save: async (executor, orderId, key, photos, actorId) => {
        assert.equal(executor, db);
        assert.equal(orderId, 'order');
        assert.equal(key, 'order');
        assert.deepEqual(photos, [{ order_item_id: 1 }]);
        assert.equal(actorId, 'staff');
        events.push('photos');
        if (rejectPhotos) throw new Error('Invalid dispatch evidence');
      },
    },
  };
  pool.query = async () => { throw new Error('Shipping escaped its transaction'); };
  const shipment = {
    status: 'shipped', tracking_number: 'TRACK123', courier_name: 'Courier',
    additional_shipping_fee: 0, itemPhotos: [{ order_item_id: 1 }],
  };
  try {
    for (const update of [orders.updateOrder, orders.updateShipment]) {
      events.length = 0;
      const result = await update('order', { ...shipment }, 'staff');
      assert.equal(result.status, 'shipped');
      assert.deepEqual(events, ['begin', 'photos', 'update', 'commit']);

      events.length = 0;
      rejectPhotos = true;
      await assert.rejects(update('order', { ...shipment }, 'staff'), /Invalid dispatch evidence/);
      assert.deepEqual(events, ['begin', 'photos']);
      rejectPhotos = false;

      events.length = 0;
      pickup = true;
      await update('order', { ...shipment }, 'staff');
      assert.deepEqual(events, ['begin', 'update', 'commit']);
      pickup = false;
    }
  } finally {
    pool.query = originalQuery;
    if (originalDispatch) require.cache[dispatchPath] = originalDispatch;
    else delete require.cache[dispatchPath];
  }
});
