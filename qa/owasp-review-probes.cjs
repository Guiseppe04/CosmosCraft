// Security review evidence: asserts vulnerable behavior, not desired regressions.
// All database, mail and token-issuance dependencies are isolated; no remote I/O.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const context = { module, exports: module.exports, process: { env: {} },
    console: { log() {}, warn() {}, error() {} }, setTimeout,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (name === 'crypto') return require('node:crypto');
      throw new Error(`Unmocked dependency: ${name}`);
    } };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return module.exports;
}
test('F1: a used OAuth code issues fresh cookies without a browser session', async () => {
  let issued = 0;
  const guard = load('server/middleware/oauthGuard.js', {
    '../config/database': { pool: { async query(sql) {
      if (sql.startsWith('INSERT')) throw Object.assign(new Error('duplicate'), { code: '23505' });
      if (sql.includes('information_schema')) return { rows: [{}] };
      return { rows: [{ status: 'success', oauth_user_id: 'victim' }] };
    } } },
    '../services/rbacService': { getUserRoleSummary: async () => ({ role: 'customer' }) },
    '../utils/generateTokens': { async generateTokens(id) {
      assert.equal(id, 'victim'); issued++;
      return { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' };
    } },
  });
  const cookies = [];
  for (let i = 0; i < 2; i++) {
    await guard.oauthSingleUseGuard('google')({ query: { code: 'synthetic-used-code' }, body: {}, headers: {} },
      { clearCookie() {}, cookie: (...args) => cookies.push(args), redirect() {} },
      err => { throw err || new Error('Unexpected provider exchange'); });
  }
  assert.equal(issued, 2);
  assert.equal(cookies.length, 4);
});
test('F2: configured request limit is never enforced', () => {
  const { createRateLimiter } = load('server/middleware/rateLimitMiddleware.js', {
    'express-rate-limit': () => { throw new Error('Real limiter unexpectedly used'); }, jsonwebtoken: {},
  });
  const limiter = createRateLimiter({ max: 1, windowMs: 60000 });
  let passed = 0;
  for (let i = 0; i < 100; i++) limiter({ headers: {}, ip: '127.0.0.1' }, {}, () => passed++);
  assert.equal(passed, 100);
});
test('F3: incorrect OTP guesses do not record failed attempts or lock out', async () => {
  const queries = [];
  const client = { release() {}, async query(sql) { queries.push(sql); return { rows: [] }; } };
  const service = load('server/services/userService.js', {
    bcryptjs: {}, '../utils/phAddress': {}, '../middleware/errorHandler': {},
    '../config/database': { pool: { connect: async () => client } },
    './rbacService': {}, '../middleware/appointmentCapacityLock': {},
  });
  for (let i = 0; i < 6; i++) {
    const result = await service.verifyAndConsumeOTPWithAttempts('synthetic-user', 'incorrect');
    assert.equal(result.valid, false);
    assert.equal(result.maxAttemptsReached, false);
  }
  assert.equal(queries.filter(sql => sql.includes('otp_attempts')).length, 0);
});
test('F4: payment creation accepts an order belonging to another user', async () => {
  let inserted;
  class AppError extends Error {}
  const service = load('server/services/paymentService.js', {
    '../config/database': { pool: { connect: async () => ({ release() {}, async query(sql, args) {
      if (sql.startsWith('SELECT * FROM orders')) return { rows: [{ order_id: 'victim-order', user_id: 'victim', total_amount: 100 }] };
      if (sql.includes('INSERT INTO payments')) {
        inserted = { order_id: args[0], user_id: args[1], amount: args[3] };
        return { rows: [inserted] };
      }
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' ||
          sql.includes('FROM payments p') || sql.includes('FROM payment_config') ||
          sql.includes('FROM projects') || sql.includes('JOIN order_items')) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    } }) } },
    '../middleware/errorHandler': { AppError }, './defaultWorkflowService': {}, './projectRefundService': {},
  });
  const payment = await service.createPayment({ order_id: 'victim-order', user_id: 'attacker', method: 'gcash', amount: 1 });
  assert.equal(payment.order_id, 'victim-order');
  assert.equal(payment.user_id, 'attacker');
});
