const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const guitars = require('../services/guitarService');
const cart = require('../services/cartService');
const { assignmentSchema } = require('../utils/walkInValidation');

test('walk-in customer lookup and assignment allow staff/admin and deny customers', () => {
  const router = require('../routes/guitarRoutes');
  for (const path of ['/walk-in-customers', '/walk-in-customizations']) {
    const route = router.stack.find(layer => layer.route?.path === path).route;
    const authorize = route.stack[1].handle;
    for (const role of ['staff', 'admin', 'super_admin', 'customer', undefined]) {
      let allowed = false;
      let status;
      const res = { status(code) { status = code; return this; }, json() {} };
      authorize({ user: role ? { role } : undefined }, res, () => { allowed = true; });
      assert.equal(allowed, ['staff', 'admin', 'super_admin'].includes(role));
      if (!allowed) assert.equal(status, 403);
    }
  }
});

test('customer lookup returns only display fields and paginates eligible accounts', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    assert.match(sql, /SELECT user_id, first_name, last_name, email/);
    assert.match(sql, /role = 'customer' AND is_active = TRUE AND is_verified = TRUE AND deleted_at IS NULL/);
    assert.deepEqual(params, ['Jane', 11, 10]);
    return { rows: Array.from({ length: 11 }, (_, index) => ({ user_id: `customer-${index}` })) };
  };
  try {
    const result = await guitars.getWalkInCustomers({ search: 'Jane', page: 2 });
    assert.equal(result.users.length, 10);
    assert.equal(result.hasMore, true);
    assert.equal(result.page, 2);
  } finally { pool.query = originalQuery; }
});

const customerId = '11111111-1111-4111-8111-111111111111';
const buildId = '22222222-2222-4222-8222-222222222222';
const payload = {
  customer_id: customerId, customization_id: buildId, quantity: 2,
  design: { name: 'Custom build', guitar_type: 'electric', total_price: 12000,
    config_json: { body: 'strat' }, stickers: [], preview_image: '/preview.png',
    summary: { body: 'Strat' }, pricingBreakdown: { base: 12000 },
    lineItems: [{ id: 'base', category: 'Base', name: 'Starting Price', unitPrice: 12000, quantity: 1, subtotal: 12000 }],
  },
};

test('assignment validates customer IDs, quantity, design and prices', () => {
  assert.ifError(assignmentSchema.validate(payload).error);
  for (const bad of [
    { ...payload, customer_id: 'invalid' }, { ...payload, quantity: 0 },
    { ...payload, design: { ...payload.design, total_price: -1 } },
    { ...payload, design: { ...payload.design, guitar_type: 'invalid' } },
  ]) assert.ok(assignmentSchema.validate(bad).error);
});

test('assignment is atomic, customer-owned, idempotent and rejects reassignment', async () => {
  const originals = { query: pool.query, connect: pool.connect };
  let row;
  let inserts = 0;
  let carts = 0;
  let validCustomer = true;
  let failCart = false;
  let released = 0;
  const statements = [];
  pool.query = async sql => {
    assert.match(sql, /ALTER TABLE customizations/);
    return { rows: [] };
  };
  pool.connect = async () => {
    let before;
    return {
      async query(sql, values = []) {
        statements.push(sql);
        if (sql === 'BEGIN') before = row;
        if (sql === 'ROLLBACK') row = before;
        if (sql.includes('FROM users')) return { rows: validCustomer ? [{ user_id: values[0] }] : [] };
        if (sql === 'SELECT * FROM customizations WHERE customization_id = $1') return { rows: row ? [row] : [] };
        if (sql.includes('COUNT(*)')) return { rows: [{ total: 0 }] };
        if (sql.includes('INSERT INTO customizations')) {
          inserts++;
          row = { user_id: values[0], customization_id: values[15], config_json: JSON.parse(values[12]), total_price: values[10] };
          return { rows: [row] };
        }
        if (sql.includes('SELECT * FROM carts')) return { rows: [{ cart_id: 'cart', user_id: values[0] }] };
        if (sql.includes('INSERT INTO cart_items')) {
          if (failCart) throw new Error('Cart write failed');
          carts++;
          assert.deepEqual(values, ['cart', buildId, 2, 12000]);
        }
        if (sql.includes('SELECT quantity, unit_price')) return { rows: [{ quantity: 2, unit_price: 12000 }] };
        return { rows: [] };
      },
      release() { released++; },
    };
  };
  try {
    failCart = true;
    await assert.rejects(guitars.assignWalkInCustomization('admin', payload), /Cart write failed/);
    assert.equal(row, undefined);
    assert.equal(statements.at(-1), 'ROLLBACK');
    failCart = false;
    const result = await guitars.assignWalkInCustomization('admin', payload);
    assert.equal(result.customization.user_id, customerId);
    assert.equal(result.customization.config_json._walkIn.createdBy, 'admin');
    assert.equal(result.customization.config_json.body, 'strat');
    assert.equal(result.alreadyAssigned, false);
    const retry = await guitars.assignWalkInCustomization('admin', { ...payload, quantity: 5 });
    assert.equal(retry.alreadyAssigned, true);
    assert.equal(inserts, 2); // Includes the rolled-back attempt.
    assert.equal(carts, 1);
    await assert.rejects(guitars.assignWalkInCustomization('other-admin', payload), /different customer or administrator/);
    await assert.rejects(guitars.assignWalkInCustomization('admin', { ...payload, customer_id: 'another-customer' }), /different customer or administrator/);
    validCustomer = false;
    await assert.rejects(guitars.assignWalkInCustomization('admin', payload), /registered customer/);
    assert.equal(released, 6);
    assert.ok(statements.some(sql => sql.includes('pg_advisory_xact_lock')));
    assert.ok(statements.some(sql => sql.includes('FOR UPDATE')));
  } finally {
    pool.query = originals.query;
    pool.connect = originals.connect;
  }
});

test('customers cannot add another customer’s custom build to their cart', async () => {
  const original = pool.query;
  pool.query = async (sql, values) => {
    if (sql.includes('FROM carts')) return { rows: [{ cart_id: 'cart' }] };
    assert.match(sql, /customization_id = \$1 AND user_id = \$2/);
    assert.deepEqual(values, [buildId, customerId]);
    return { rows: [] };
  };
  try {
    await assert.rejects(cart.addItemToCart(customerId, { customization_id: buildId }), /Customization not found/);
  } finally { pool.query = original; }
});

test('existing checkout creates a customization order using the assigned build ID and database price', async () => {
  const orders = require('../services/orderService');
  const originals = { query: pool.query, connect: pool.connect };
  const statements = [];
  pool.query = async () => ({ rows: [] });
  pool.connect = async () => ({
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes('FROM carts cart')) {
        assert.deepEqual(values, [customerId, [17]]);
        assert.match(sql, /cu.user_id = \$1/);
        return { rows: [{ cart_item_id: 17, customization_id: buildId, quantity: 2,
          customization_name: 'Walk-in build', customization_price: '12000.00' }] };
      }
      if (sql.includes('INSERT INTO order_number_counters')) return { rows: [{ last_number: 1 }] };
      if (sql.includes('SELECT address_id FROM addresses')) return { rows: [{ address_id: 'address' }] };
      if (sql.includes('INSERT INTO orders')) return { rows: [{ order_id: 'order', order_type: values[1], user_id: values[2] }] };
      return { rows: [] };
    },
    release() {},
  });
  try {
    const order = await orders.createOrder({ userId: customerId, cartItemIds: [17],
      shippingMethod: 'standard', paymentMethod: 'gcash', termsAccepted: true, shippingAddressId: 'address',
      billingAddress: { street: 'Test street', city: 'Manila', province: 'Metro Manila', postalCode: '1000', country: 'PH' },
    });
    assert.equal(order.order_type, 'customization');
    assert.equal(order.user_id, customerId);
    const insert = statements.find(({ sql }) => sql.includes('INSERT INTO order_items'));
    assert.deepEqual(insert.values.slice(0, 3), ['order', null, buildId]);
    assert.deepEqual(insert.values.slice(-2), [2, 12000]);
    assert.equal(statements.some(({ sql }) => sql.includes('INSERT INTO customizations')), false);
    assert.equal(statements.at(-1).sql, 'COMMIT');
  } finally { pool.query = originals.query; pool.connect = originals.connect; }
});
