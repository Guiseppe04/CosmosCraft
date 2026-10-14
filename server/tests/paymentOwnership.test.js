const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const rbacService = require('../services/rbacService');
const termsService = require('../services/termsService');
const paymentRoutes = require('../routes/paymentRoutes');
const { errorHandler } = require('../middleware/errorHandler');

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const staff = '33333333-3333-4333-8333-333333333333';
const aliceOrder = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bobOrder = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('payment API checks order ownership and serializes concurrent submissions', async t => {
  const orders = new Map([
    [aliceOrder, { order_id: aliceOrder, user_id: alice, total_amount: 100 }],
    [bobOrder, { order_id: bobOrder, user_id: bob, total_amount: 100 }],
  ]);
  const payments = [];
  const lockTails = new Map();
  let historyReads = 0;
  let inserts = 0;

  t.mock.method(jwt, 'verify', token => ({ id: token }));
  t.mock.method(rbacService, 'getUserRoleSummary', async id => ({
    role: id === staff ? 'staff' : 'customer', permissions: [],
  }));
  t.mock.method(termsService, 'requiresAccountAgreement', async () => false);
  t.mock.method(pool, 'query', async (sql, params = []) => {
    if (sql.includes('is_verified, is_active')) return { rows: [{ is_verified: true, is_active: true }] };
    if (sql === 'SELECT user_id FROM orders WHERE order_id = $1') return { rows: orders.has(params[0]) ? [orders.get(params[0])] : [] };
    if (sql === 'SELECT * FROM orders WHERE order_id = $1') return { rows: orders.has(params[0]) ? [orders.get(params[0])] : [] };
    if (sql.includes('WHERE p.payment_id = $1')) {
      const payment = payments.find(p => p.payment_id === params[0]);
      return { rows: payment ? [{ ...payment, user_id: orders.get(payment.order_id).user_id,
        order_user_id: orders.get(payment.order_id).user_id }] : [] };
    }
    if (sql.includes('FROM payments p') && sql.includes('JOIN orders o')) {
      historyReads++;
      const found = payments.filter(p =>
        (!sql.includes('p.order_id = $') || params.includes(p.order_id)) &&
        (!sql.includes('o.user_id = $') || params.includes(orders.get(p.order_id).user_id)));
      return sql.includes('COUNT(*)') ? { rows: [{ total: found.length }] } : {
        rows: found.map(p => ({ ...p, user_id: orders.get(p.order_id).user_id })),
      };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  });
  t.mock.method(pool, 'connect', async () => {
    let unlock;
    return {
      async query(sql, params = []) {
        if (sql === 'BEGIN') return { rows: [] };
        if (sql === 'COMMIT' || sql === 'ROLLBACK') {
          unlock?.();
          return { rows: [] };
        }
        if (sql.includes('FROM orders WHERE order_id = $1 FOR UPDATE')) {
          const previous = lockTails.get(params[0]) || Promise.resolve();
          let release;
          const held = new Promise(resolve => { release = resolve; });
          lockTails.set(params[0], previous.then(() => held));
          await previous;
          unlock = release;
          return { rows: orders.has(params[0]) ? [orders.get(params[0])] : [] };
        }
        if (sql.includes('SELECT p.* FROM payments p')) {
          await Promise.resolve();
          return { rows: payments.filter(p => p.order_id === params[0]) };
        }
        if (sql.includes('FROM payment_config')) return { rows: [] };
        if (sql.includes('INSERT INTO payments')) {
          inserts++;
          const payment = {
            payment_id: randomUUID(), order_id: params[0], user_id: params[1],
            method: params[2], amount: params[3], status: params[8], metadata: JSON.parse(params[9]),
          };
          payments.push(payment);
          return { rows: [payment] };
        }
        if (sql.includes('SELECT project_id FROM projects')) return { rows: [{ project_id: 'existing-project' }] };
        throw new Error(`Unexpected transaction query: ${sql}`);
      },
      release() {},
    };
  });

  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/payments`;
  const request = (user, path = '', options = {}) => fetch(url + path, {
    ...options,
    headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const submit = (user, orderId) => request(user, '', {
    method: 'POST', body: JSON.stringify({ order_id: orderId, method: 'gcash', amount: 100 }),
  });

  const deniedHistory = await request(bob, `?order_id=${aliceOrder}`);
  assert.equal(deniedHistory.status, 403);
  assert.equal(historyReads, 0, 'ownership is checked before reading payment history');
  assert.equal((await submit(bob, aliceOrder)).status, 403);
  assert.equal(inserts, 0);

  const racing = await Promise.all([submit(alice, aliceOrder), submit(alice, aliceOrder)]);
  assert.deepEqual(racing.map(response => response.status).sort(), [201, 400]);
  assert.equal(payments.filter(p => p.order_id === aliceOrder).length, 1);
  assert.equal((await submit(bob, aliceOrder)).status, 403);
  assert.equal((await request(alice, `?order_id=${aliceOrder}`)).status, 200);
  assert.equal((await request(bob, `/${payments[0].payment_id}`)).status, 403);
  assert.equal((await request(bob, `/users/${alice}`)).status, 403);
  assert.deepEqual((await (await request(bob)).json()).data.payments, []);

  const onBehalf = await submit(staff, bobOrder);
  assert.equal(onBehalf.status, 201);
  const submitted = (await onBehalf.json()).data.payment;
  assert.equal(submitted.user_id, bob, 'payment belongs to the order owner');
  assert.equal(submitted.metadata.submitted_by, staff, 'staff actor is recorded separately');
  assert.equal((await request(bob, `?order_id=${bobOrder}`)).status, 200);

  payments.push({ payment_id: 'legacy-misattributed', order_id: bobOrder, user_id: alice, status: 'verified' });
  const bobHistory = (await (await request(bob, `?order_id=${bobOrder}`)).json()).data;
  assert.equal(bobHistory.payments.length, 2);
  assert.equal(bobHistory.pagination.total, 2);
  assert.ok(bobHistory.payments.every(payment => payment.user_id === bob));
  assert.equal((await (await request(alice)).json()).data.payments.length, 1);
});
