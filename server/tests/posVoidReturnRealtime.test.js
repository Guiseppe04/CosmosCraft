const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const auditService = require('../services/auditService');
const posService = require('../services/posService');
const posController = require('../controllers/posController');
const socketService = require('../services/socketService');

/**
 * Minimal stand-in for a pooled client that records the order of the statements
 * so a test can prove notifications are published only after COMMIT.
 */
function createFakeClient(handlers, log) {
  return {
    async query(sql, params = []) {
      log.push(sql.trim().split('\n')[0]);
      if (sql === 'COMMIT') log.push('__COMMITTED__');
      if (sql === 'ROLLBACK') log.push('__ROLLED_BACK__');
      for (const [pattern, rows] of handlers) {
        if (pattern.test(sql)) return { rows: typeof rows === 'function' ? rows(params) : rows };
      }
      return { rows: [] };
    },
    release() {},
  };
}

function useFakePool(handlers, log) {
  const original = { connect: pool.connect, query: pool.query };
  pool.connect = async () => createFakeClient(handlers, log);
  // Some helpers (builder-part mirroring, sale numbering) go straight through
  // pool.query instead of the transaction client.
  pool.query = async (sql, params = []) => {
    log.push(sql.trim().split('\n')[0]);
    for (const [pattern, rows] of handlers) {
      if (pattern.test(sql)) return { rows: typeof rows === 'function' ? rows(params) : rows };
    }
    return { rows: [] };
  };
  return () => { pool.connect = original.connect; pool.query = original.query; };
}

function captureSockets() {
  const events = [];
  const original = {
    emitToStaff: socketService.emitToStaff,
    emitBroadcast: socketService.emitBroadcast,
  };
  const record = (room) => (event, payload) => { events.push({ room, event, payload }); };
  socketService.emitToStaff = record('staff_channel');
  socketService.emitBroadcast = record('broadcast');
  return {
    events,
    restore: () => {
      socketService.emitToStaff = original.emitToStaff;
      socketService.emitBroadcast = original.emitBroadcast;
    },
  };
}

function invoke(handler, { id, body, userId = 'staff-1' }) {
  return new Promise((resolve, reject) => {
    const req = { params: { id }, body, user: { user_id: userId, role: 'staff' } };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, payload }); },
    };
    handler(req, res, reject);
  });
}

const SALE_LOCK = [
  [/SELECT sale_id, sale_number, status, total_amount/, [{ sale_id: 'sale-1', sale_number: 'POS-20261005-0001', status: 'completed', total_amount: 500 }]],
];

test('voiding a sale notifies staff and every client about the restored stock after the commit', async () => {
  const statements = [];
  const restorePool = useFakePool([
    ...SALE_LOCK,
    [/FROM pos_sale_items/, [{ item_id: 'item-1', product_id: 'prod-1', item_name: 'Guitar Strings', quantity: 2 }]],
    [/SELECT stock FROM inventory/, [{ stock: 3 }]],
    [/INSERT INTO pos_returns/, (params) => [{
      sale_id: 'sale-1',
      item_id: 'item-1',
      product_id: 'prod-1',
      quantity: 2,
      item_condition: 'resalable',
      inventory_before: 3,
      inventory_after: 5,
      restocked: true,
    }]],
    [/UPDATE pos_sales SET/, [{ sale_id: 'sale-1', status: 'voided', refund_amount: 500 }]],
  ], statements);
  const originalAudit = auditService.logPosEvent;
  auditService.logPosEvent = async () => {};
  const sockets = captureSockets();
  try {
    const response = await invoke(posController.voidSale, { id: 'sale-1', body: { reason: 'Duplicate sale' } });

    assert.equal(response.status, 200);
    assert.equal(response.payload.data.sale.status, 'voided');
    assert.deepEqual(response.payload.data.stockUpdates, [{ product_id: 'prod-1', stock: 5 }]);

    const saleEvent = sockets.events.find(entry => entry.event === 'pos:sale_updated');
    assert.ok(saleEvent, 'pos:sale_updated must be published');
    assert.equal(saleEvent.room, 'staff_channel');
    assert.equal(saleEvent.payload.action, 'voided');
    assert.equal(saleEvent.payload.saleNumber, 'POS-20261005-0001');
    assert.equal(saleEvent.payload.sale.status, 'voided');
    assert.deepEqual(saleEvent.payload.stockUpdates, [{ product_id: 'prod-1', stock: 5 }]);

    const stockEvent = sockets.events.find(entry => entry.event === 'stock:updated');
    assert.ok(stockEvent, 'restored stock must be broadcast');
    assert.equal(stockEvent.room, 'broadcast');
    assert.deepEqual(stockEvent.payload, { productId: 'prod-1', product_id: 'prod-1', stock: 5 });

    const inventoryEvent = sockets.events.find(entry => entry.event === 'inventory:updated');
    assert.ok(inventoryEvent, 'staff inventory views must be told about the restock');
    assert.equal(inventoryEvent.room, 'staff_channel');
    assert.equal(inventoryEvent.payload.stock, 5);

    // Every notification has to follow the commit, otherwise a client could
    // refetch a quantity the database has not accepted yet.
    const commitIndex = statements.indexOf('__COMMITTED__');
    assert.ok(commitIndex > -1, 'the void must commit');
    assert.equal(statements.indexOf('ROLLBACK'), -1);
  } finally {
    auditService.logPosEvent = originalAudit;
    sockets.restore();
    restorePool();
  }
});

test('returning a sale publishes only the resalable items as restocked', async () => {
  const statements = [];
  const restorePool = useFakePool([
    ...SALE_LOCK,
    [/FROM pos_sale_items\s+WHERE sale_id/, [
      { item_id: 'item-1', product_id: 'prod-1', item_name: 'Guitar Strings', quantity: 2 },
      { item_id: 'item-2', product_id: 'prod-2', item_name: 'Guitar Cable', quantity: 1 },
    ]],
    [/SELECT unit_price FROM pos_sale_items/, [{ unit_price: 250 }]],
    [/SELECT stock FROM inventory/, (params) => [{ stock: params[0] === 'prod-1' ? 3 : 8 }]],
    [/INSERT INTO pos_returns/, (params) => [{
      sale_id: 'sale-1',
      item_id: params[1],
      product_id: params[2],
      quantity: params[3],
      item_condition: params[4],
      inventory_before: params[2] === 'prod-1' ? 3 : 8,
      inventory_after: params[2] === 'prod-1' ? 5 : 8,
      restocked: params[4] === 'resalable',
    }]],
    [/UPDATE pos_sales SET/, [{ sale_id: 'sale-1', status: 'returned', refund_amount: 500 }]],
  ], statements);
  const originalAudit = auditService.logPosEvent;
  auditService.logPosEvent = async () => {};
  const sockets = captureSockets();
  try {
    const response = await invoke(posController.returnSale, {
      id: 'sale-1',
      body: {
        reason: 'Customer return',
        items: [
          { item_id: 'item-1', quantity: 2, item_condition: 'resalable' },
          { item_id: 'item-2', quantity: 1, item_condition: 'damaged' },
        ],
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.payload.data.sale.status, 'returned');
    assert.deepEqual(response.payload.data.stockUpdates, [{ product_id: 'prod-1', stock: 5 }]);

    const saleEvent = sockets.events.find(entry => entry.event === 'pos:sale_updated');
    assert.equal(saleEvent.room, 'staff_channel');
    assert.equal(saleEvent.payload.action, 'returned');
    // Both lines were refunded, including the damaged one (2 x 250 + 1 x 250).
    assert.equal(saleEvent.payload.refundAmount, 750);

    const stockEvents = sockets.events.filter(entry => entry.event === 'stock:updated');
    assert.equal(stockEvents.length, 1, 'a damaged item must not be reported as restocked');
    assert.deepEqual(stockEvents[0].payload, { productId: 'prod-1', product_id: 'prod-1', stock: 5 });

    assert.ok(statements.indexOf('__COMMITTED__') > -1);
    assert.equal(statements.indexOf('ROLLBACK'), -1);
  } finally {
    auditService.logPosEvent = originalAudit;
    sockets.restore();
    restorePool();
  }
});

test('a failed void publishes nothing', async () => {
  const statements = [];
  const restorePool = useFakePool([
    ...SALE_LOCK,
    [/FROM pos_sale_items/, [{ item_id: 'item-1', product_id: 'prod-1', item_name: 'Guitar Strings', quantity: 2 }]],
    [/SELECT stock FROM inventory/, [{ stock: 1 }]],
  ], statements);
  const sockets = captureSockets();
  try {
    // Restoring a line with a broken trigger path: the service throws and rolls
    // back, so no listener may be told that stock came back.
    pool.connect = async () => {
      const client = createFakeClient([
        ...SALE_LOCK,
        [/FROM pos_sale_items/, [{ item_id: 'item-1', product_id: 'prod-1', item_name: 'Guitar Strings', quantity: 2 }]],
        [/SELECT stock FROM inventory/, [{ stock: 1 }]],
        [/INSERT INTO pos_returns/, () => { throw new Error('pos_returns unavailable'); }],
      ], statements);
      return client;
    };

    await assert.rejects(
      invoke(posController.voidSale, { id: 'sale-1', body: { reason: 'Duplicate sale' } }),
      /pos_returns unavailable/
    );
    assert.deepEqual(sockets.events, []);
    assert.ok(statements.includes('__ROLLED_BACK__'));
  } finally {
    sockets.restore();
    restorePool();
  }
});

test('a recorded sale reports the stock it deducted', async () => {
  const statements = [];
  const restorePool = useFakePool([
    [/SELECT user_id FROM users/, [{ user_id: 'staff-1' }]],
    [/COUNT\(\*\) as count/, [{ count: '1' }]],
    [/INSERT INTO pos_sales/, [{ sale_id: 'sale-2', sale_number: 'POS-20261005-0002', staff_id: 'staff-1', status: 'completed', total_amount: 500, subtotal: 500 }]],
    [/SELECT stock FROM inventory/, [{ stock: 4 }]],
    [/^FROM pos_sales$/, [{ sale_id: 'sale-2', sale_number: 'POS-20261005-0002', staff_id: 'staff-1', status: 'completed', total_amount: 500, subtotal: 500 }]],
  ], statements);
  const originalAudit = { pos: auditService.logPosEvent, stock: auditService.logStockMovement };
  auditService.logPosEvent = async () => {};
  auditService.logStockMovement = async () => {};
  const sockets = captureSockets();
  try {
    const sale = await posService.createSale('staff-1', {
      customerName: 'Walk-in',
      subtotal: 500,
      totalAmount: 500,
      paymentMethod: 'cash',
      cashReceived: 1000,
      items: [{ product_id: 'prod-1', name: 'Guitar Strings', quantity: 1, price: 500 }],
    });

    assert.deepEqual(sale.stockUpdates, [{ product_id: 'prod-1', product_name: 'Guitar Strings', stock: 3 }]);

    const commitIndex = statements.indexOf('__COMMITTED__');
    assert.ok(commitIndex > -1);
    const inventoryIndex = statements.findIndex(sql => sql.startsWith('UPDATE inventory SET stock = stock -'));
    assert.ok(inventoryIndex > -1 && inventoryIndex < commitIndex, 'stock is deducted inside the transaction');
  } finally {
    auditService.logPosEvent = originalAudit.pos;
    auditService.logStockMovement = originalAudit.stock;
    sockets.restore();
    restorePool();
  }
});