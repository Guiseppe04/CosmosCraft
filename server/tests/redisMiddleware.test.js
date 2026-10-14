const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('node:module');
const { publicCache } = require('../middleware/publicCache');
const { redisErrorReason } = require('../config/redis');
const jwt = require('jsonwebtoken');

test('Redis diagnostics identify connection failures without returning secrets', () => {
  assert.equal(redisErrorReason({ code: 'ENOTFOUND' }), 'DNS_LOOKUP_FAILED');
  assert.equal(redisErrorReason({ code: 'ECONNREFUSED' }), 'CONNECTION_REFUSED');
  assert.equal(redisErrorReason({ message: 'Connection timeout' }), 'CONNECTION_TIMEOUT');
  assert.equal(redisErrorReason({ message: 'WRONGPASS invalid username-password pair' }), 'AUTHENTICATION_FAILED');
  assert.equal(redisErrorReason({ message: 'redis://default:secret@host:6379' }), 'UNKNOWN');
});

async function serve(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}

test('public cache separates queries, expires and bypasses credentials, errors and private responses', async t => {
  const entries = new Map();
  let now = 0;
  let reads = 0;
  let down = false;
  const command = async ([operation, key, value, , ttl]) => {
    if (down) throw new Error('offline');
    if (operation === 'GET') {
      const item = entries.get(key);
      return item && item.expires > now ? item.value : null;
    }
    entries.set(key, { value, expires: now + Number(ttl) * 1000 });
    return 'OK';
  };
  const app = express();
  app.get('/catalog', publicCache('test', 15, { enabled: true, command }), (req, res) => {
    reads++;
    if (req.query.error) return res.status(500).json({ reads });
    if (req.query.private) res.set('Cache-Control', 'private, no-store');
    if (req.query.cookie) res.cookie('test', 'secret');
    res.json({ reads, query: req.query });
  });
  const request = await serve(t, app);
  const first = await (await request('/catalog?q=a')).json();
  assert.deepEqual(await (await request('/catalog?q=a')).json(), first);
  assert.notDeepEqual(await (await request('/catalog?q=b')).json(), first);
  for (const headers of [{ Authorization: 'Bearer test' }, { Cookie: 'accessToken=test' },
    { 'X-Access-Token': 'test' }, { 'Cache-Control': 'no-cache' }]) {
    assert.notDeepEqual(await (await request('/catalog?q=a', { headers })).json(), first);
  }
  assert.deepEqual(await (await request('/catalog?q=a')).json(), first);
  for (const query of ['error=1', 'private=1', 'cookie=1']) {
    const a = await (await request(`/catalog?${query}`)).json();
    const b = await (await request(`/catalog?${query}`)).json();
    assert.notEqual(a.reads, b.reads);
  }
  now = 16000;
  assert.notDeepEqual(await (await request('/catalog?q=a')).json(), first);
  down = true;
  assert.equal((await request('/catalog?q=a')).status, 200);
});

test('Redis rate limit counters are shared across app instances, isolated by scope, and fail closed', async t => {
  const counters = new Map();
  let now = 0;
  let ready = true;
  let failCommands = false;
  const mock = {
    redisEnabled: true, keyPrefix: 'test:', getRedisClient: () => ({ isReady: ready }),
    sendRedisCommand: async args => {
      if (failCommands) throw new Error('offline');
      if (args[0] === 'EVAL') {
        const key = args[3], capacity = Number(args[4]), refillMs = Number(args[5]);
        const previous = counters.get(key);
        let tokens = Math.min(capacity, (previous?.tokens ?? capacity) +
          Math.max(0, now - (previous?.updated ?? now)) / refillMs);
        const allowed = tokens >= 1;
        if (allowed) tokens--;
        counters.set(key, { tokens, updated: now });
        return [Number(allowed), Math.floor(tokens * 1000),
          allowed ? 0 : Math.ceil((1 - tokens) * refillMs),
          Math.ceil((capacity - tokens) * refillMs)];
      }
      throw new Error(`Unexpected command ${args[0]}`);
    },
  };
  const originalLoad = Module._load;
  const modulePath = require.resolve('../middleware/rateLimitMiddleware');
  delete require.cache[modulePath];
  let createRateLimiter;
  try {
    Module._load = function (name, parent, ...args) {
      if (name === '../config/redis' && parent?.filename === modulePath) return mock;
      return originalLoad.call(this, name, parent, ...args);
    };
    ({ createRateLimiter } = require(modulePath));
  } finally { Module._load = originalLoad; delete require.cache[modulePath]; }
  const app = express();
  const settings = { scope: 'auth', capacity: 2, refillMs: 100 };
  app.get('/worker-a', createRateLimiter(settings), (req, res) => res.send('ok'));
  app.get('/worker-b', createRateLimiter(settings), (req, res) => res.send('ok'));
  app.get('/contact', createRateLimiter({ ...settings, scope: 'contact' }), (req, res) => res.send('ok'));
  const request = await serve(t, app);
  assert.equal((await request('/worker-a')).status, 200);
  assert.equal((await request('/worker-b')).status, 200);
  const limited = await request('/worker-a');
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
  assert.equal((await request('/contact')).status, 200);
  ready = false;
  assert.equal((await request('/contact')).status, 503);
  ready = true;
  failCommands = true;
  assert.equal((await request('/contact')).status, 503);
  failCommands = false;
  assert.equal((await request('/contact')).status, 200);
  assert.equal((await request('/contact')).status, 429);
  now = 50;
  assert.equal((await request('/worker-a')).status, 429);
  now = 100;
  assert.equal((await request('/worker-b')).status, 200);
});

test('a guest browsing limit does not block login or a signed-in user', async t => {
  const { createRateLimiter, isAuthPath, isSessionAuthPath, getGeneralRateLimitKey } =
    require('../middleware/rateLimitMiddleware');
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'rate-limit-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const app = express();
  const common = { refillMs: 3600000 };
  app.use(createRateLimiter({
    ...common, scope: 'test-general', capacity: 2,
    skip: req => isAuthPath(req.path), keyGenerator: getGeneralRateLimitKey,
  }));
  const attempts = createRateLimiter({
    ...common, scope: 'test-auth', capacity: 1,
    skip: req => isSessionAuthPath(req.path),
  });
  const sessions = createRateLimiter({
    ...common, scope: 'test-auth-session', capacity: 2,
    skip: req => !isSessionAuthPath(req.path),
  });
  app.use('/auth', sessions, attempts);
  app.get('/api/browse', (req, res) => res.send('ok'));
  app.get('/api/private', (req, res) => res.send('ok'));
  app.get('/auth/check', (req, res) => res.send('ok'));
  app.post('/auth/email-login', (req, res) => res.send('ok'));
  const request = await serve(t, app);

  assert.equal((await request('/api/browse')).status, 200);
  assert.equal((await request('/api/browse')).status, 200);
  assert.equal((await request('/api/browse')).status, 429);
  assert.equal((await request('/auth/check')).status, 200);
  assert.equal((await request('/auth/email-login', { method: 'POST' })).status, 200);
  assert.equal((await request('/auth/email-login', { method: 'POST' })).status, 429);

  const token = jwt.sign({ id: 'customer-1' }, process.env.JWT_SECRET);
  assert.equal((await request('/api/private', { headers: { Authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await request('/api/private', { headers: { 'X-Access-Token': token } })).status, 200);
  assert.equal((await request('/api/private', { headers: { Cookie: `accessToken=${token}` } })).status, 429);
  assert.equal((await request('/api/private', { headers: { Authorization: 'Bearer invalid' } })).status, 429);
});

test('a denied client recovers as tokens refill without waiting for a fixed window', async t => {
  const { createRateLimiter } = require('../middleware/rateLimitMiddleware');
  const app = express();
  app.get('/limited', createRateLimiter({ scope: 'test-recovery', capacity: 2, refillMs: 100 }),
    (req, res) => res.send('ok'));
  const request = await serve(t, app);
  assert.equal((await request('/limited')).status, 200);
  assert.equal((await request('/limited')).status, 200);
  const denied = await request('/limited');
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get('retry-after'), '1');
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal((await request('/limited')).status, 200);
});
