const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { pool } = require('../config/database');
const terms = require('../services/termsService');
const { createOrderSchema, emailSignupSchema } = require('../utils/validation');
const { checkoutSchema } = require('../utils/cartValidation');

test('versioned acknowledgments enforce explicit consent, ownership, applicable policies and one order per checkout', async t => {
  const db = new PGlite();
  const firstUser = '11111111-1111-4111-8111-111111111111';
  const otherUser = '22222222-2222-4222-8222-222222222222';
  const checkoutId = '33333333-3333-4333-8333-333333333333';
  const orderId = '44444444-4444-4444-8444-444444444444';
  await db.exec(`CREATE TABLE users (user_id UUID PRIMARY KEY);
    CREATE TABLE orders (order_id UUID PRIMARY KEY);
    INSERT INTO users VALUES ('${firstUser}'), ('${otherUser}');
    INSERT INTO orders VALUES ('${orderId}');`);
  const migration = fs.readFileSync(path.join(__dirname, '../migrations/44_terms_acknowledgments.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Migration can safely be applied twice.
  const query = pool.query, connect = pool.connect;
  const client = { query: (sql, params) => db.query(sql, params), release() {} };
  pool.query = client.query;
  pool.connect = async () => client;
  const agreement = { agreed: true, versions: { ...terms.versions } };
  try {
    await t.test('missing, stale, and scrolling-only consent is rejected', async () => {
      for (const value of [undefined, { ...agreement, agreed: false }, { ...agreement, agreed: 'true' }, { agreed: true, versions: { account: 'obsolete' } }]) {
        assert.throws(() => terms.validateAgreement(value, ['account']), /explicitly accept/);
      }
      assert.equal(await terms.hasAccountAcceptance(firstUser), false);
      assert.ok(emailSignupSchema.validate({}).error.details.some(detail => detail.path[0] === 'termsAgreement'));
      assert.ok(createOrderSchema.validate({}, { abortEarly: false }).error.details.some(detail => detail.path[0] === 'checkoutAcknowledgmentId'));
      assert.ok(checkoutSchema.validate({}).error);
    });
    await t.test('account acceptance is timestamped and deduplicated across registration/login', async () => {
      await terms.recordAccount(firstUser, agreement, 'registration');
      await terms.recordAccount(firstUser, agreement, 'login');
      assert.equal(await terms.hasAccountAcceptance(firstUser), true);
      const { rows } = await db.query('SELECT * FROM terms_acknowledgments');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].context, 'registration');
      assert.equal(rows[0].user_id, firstUser);
      assert.ok(rows[0].acknowledged_at);
      const current = terms.versions.account;
      try {
        terms.versions.account = 'future-version';
        assert.equal(await terms.hasAccountAcceptance(firstUser), false);
        assert.throws(() => terms.validateAgreement(agreement, ['account']));
        await terms.recordAccount(firstUser, { agreed: true, versions: { account: 'future-version' } }, 'login');
        assert.equal(await terms.hasAccountAcceptance(firstUser), true);
      } finally { terms.versions.account = current; }
    });
    await t.test('retries reuse records; mixed orders require both policies and ownership', async () => {
      const request = { ...agreement, checkoutId, types: ['orders'] };
      await terms.recordCheckout(firstUser, request);
      await terms.recordCheckout(firstUser, request);
      const count = await db.query("SELECT count(*) FROM terms_acknowledgments WHERE context = 'checkout'");
      assert.equal(Number(count.rows[0].count), 1);
      const mixed = [{ productId: 'product' }, { customization: {} }];
      await assert.rejects(terms.attachCheckout(client, otherUser, checkoutId, mixed, orderId), /accept the current terms/);
      await assert.rejects(terms.attachCheckout(client, firstUser, checkoutId, mixed, orderId), /accept the current terms/);
      await assert.rejects(terms.attachCheckout(client, firstUser, undefined, mixed, orderId), /required/);
      await terms.recordCheckout(firstUser, { ...request, types: ['orders', 'customization'] });
      // A failed order transaction must leave the receipt available for a valid retry.
      await client.query('BEGIN');
      await terms.attachCheckout(client, firstUser, checkoutId, mixed, orderId);
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await terms.attachCheckout(client, firstUser, checkoutId, mixed, orderId);
      await client.query('COMMIT');
      const { rows } = await db.query("SELECT * FROM terms_acknowledgments WHERE context = 'checkout'");
      assert.equal(rows.length, 2);
      assert.ok(rows.every(row => row.order_id === orderId && row.checkout_id === checkoutId));
      await assert.rejects(terms.recordCheckout(firstUser, request), /already been used/);
      await assert.rejects(terms.attachCheckout(client, firstUser, checkoutId, mixed, orderId));
    });
    await t.test('checkout policies must match current versions and never allow account-only acceptance', async () => {
      const newCheckout = '55555555-5555-4555-8555-555555555555';
      await assert.rejects(terms.recordCheckout(firstUser, { ...agreement, checkoutId: newCheckout, types: ['account'] }));
      await assert.rejects(terms.recordCheckout(firstUser, { ...agreement, agreed: false, checkoutId: newCheckout, types: ['orders'] }));
      await assert.rejects(terms.recordCheckout(firstUser, { agreed: true, versions: { orders: 'old' }, checkoutId: newCheckout, types: ['orders'] }));
      await terms.recordCheckout(firstUser, { ...agreement, checkoutId: newCheckout, types: ['customization'] });
      await assert.rejects(terms.attachCheckout(client, firstUser, newCheckout, [{ productId: 'product' }], orderId));
      const current = terms.versions.customization;
      try {
        terms.versions.customization = 'updated';
        await assert.rejects(terms.attachCheckout(client, firstUser, newCheckout, [{ customization_id: 'custom' }], orderId));
      } finally { terms.versions.customization = current; }
    });
    await t.test('customer APIs block provisional sessions but allow review, acceptance and logout', async () => {
      const jwt = require('jsonwebtoken');
      const rbac = require('../services/rbacService');
      const { authenticateToken } = require('../middleware/auth');
      const originalSummary = rbac.getUserRoleSummary;
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'terms-test-secret';
      let role = 'customer';
      rbac.getUserRoleSummary = async () => ({ role });
      pool.query = async (sql, params) => sql.includes('SELECT is_verified, is_active')
        ? { rows: [{ is_verified: true, is_active: true }] } : client.query(sql, params);
      const token = jwt.sign({ id: otherUser }, process.env.JWT_SECRET);
      const run = url => new Promise((resolve, reject) => {
        let status;
        authenticateToken({ cookies: {}, headers: { authorization: `Bearer ${token}` }, originalUrl: url, path: url },
          { status(code) { status = code; return this; }, json(body) { resolve({ status, body }); } },
          error => error ? reject(error) : resolve({ allowed: true }));
      });
      try {
        assert.equal((await run('/api/orders')).body.code, 'TERMS_REQUIRED');
        assert.equal((await run('/api/cart/checkout')).status, 403);
        for (const route of ['/auth/terms/status', '/auth/terms/account', '/auth/logout', '/api/auth/terms/account']) {
          assert.equal((await run(route)).allowed, true);
        }
        assert.equal((await run('/auth/terms/checkout')).status, 403);
        await db.query('UPDATE users SET terms_registration_pending = true WHERE user_id = $1', [otherUser]);
        await new Promise((resolve, reject) => {
          require('../controllers/termsController').acceptAccount({ user: { id: otherUser }, body: agreement }, { json: resolve }, reject);
        });
        const pending = await db.query('SELECT terms_registration_pending FROM users WHERE user_id = $1', [otherUser]);
        assert.equal(pending.rows[0].terms_registration_pending, false);
        const record = await db.query("SELECT context FROM terms_acknowledgments WHERE user_id = $1 AND terms_type = 'account'", [otherUser]);
        assert.equal(record.rows[0].context, 'registration');
        assert.equal((await run('/api/orders')).allowed, true);
        role = 'staff';
        assert.equal((await run('/api/orders')).allowed, true);
      } finally {
        rbac.getUserRoleSummary = originalSummary;
        pool.query = client.query;
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
      }
    });
  } finally {
    pool.query = query;
    pool.connect = connect;
    await db.close();
  }
});
