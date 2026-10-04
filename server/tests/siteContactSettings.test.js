const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');

let settings = { email: 'old@example.test', phone: '+639661341242' };
const queries = [];
const broadcasts = [];
const messages = [];
const originalLoad = Module._load;

// Isolate database, authentication and delivery boundaries; no live writes or mail.
Module._load = function (request, parent, ...args) {
  if (parent?.filename.endsWith('contactRoutes.js')) {
    if (request === '../config/database') return { pool: { async query(sql, params) {
      queries.push(sql);
      if (sql.startsWith('UPDATE contact_settings')) settings = { email: params[0], phone: params[1] };
      return { rows: [{ ...settings }] };
    } } };
    if (request === '../middleware/auth') return { authenticateToken() {}, authorize: () => () => {} };
    if (request === '../services/socketService') return { emitBroadcast: (...args) => broadcasts.push(args) };
    if (request === '../services/mailService') return { sendContactMessageEmail: async (message) => messages.push(message) };
  }
  return originalLoad.call(this, request, parent, ...args);
};
let router;
try { router = require('../routes/contactRoutes'); }
finally { Module._load = originalLoad; }

const handler = (method, route) => router.stack.find((layer) => layer.route?.path === route && layer.route.methods[method]).route.stack.at(-1).handle;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('saved contact settings are returned publicly and broadcast to open visitors', async () => {
  const res = response();
  await handler('put', '/settings')({ body: { email: 'updated@example.test', phone: '9661341242' } }, res);
  const expected = { email: 'updated@example.test', phone: '+639661341242' };
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, expected);
  assert.deepEqual(broadcasts, [['site-contact:updated', expected]]);
  const publicResponse = response();
  await handler('get', '/settings')({}, publicResponse);
  assert.deepEqual(publicResponse.body.data, expected);
});

test('invalid contact changes neither write settings nor broadcast them', async () => {
  const queryCount = queries.length;
  const broadcastCount = broadcasts.length;
  for (const body of [{ email: 'invalid', phone: '9661341242' }, { email: 'valid@example.test', phone: '123' }]) {
    const res = response();
    await handler('put', '/settings')({ body }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(queries.length, queryCount);
  assert.equal(broadcasts.length, broadcastCount);
});

test('contact form delivery uses the updated site email', async () => {
  const res = response();
  await handler('post', '/')({ body: { firstName: 'Test', lastName: 'Customer', email: 'customer@example.test', message: 'A test message' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(messages[0].to, settings.email);
  assert.equal(messages[0].replyTo, 'customer@example.test');
});
