const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');

test('real Redis enforces a shared atomic token bucket and refills it', {
  skip: !process.env.TEST_REDIS_URL,
}, async () => {
  const prefix = `cosmoscraft-test:${randomUUID()}:`;
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
  process.env.REDIS_KEY_PREFIX = prefix;
  const { createRateLimiter } = require('../middleware/rateLimitMiddleware');
  const app = express();
  const options = { scope: 'integration', capacity: 2, refillMs: 250 };
  app.get('/one', createRateLimiter(options), (req, res) => res.send('ok'));
  app.get('/two', createRateLimiter(options), (req, res) => res.send('ok'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const client = require('../config/redis').getRedisClient();
    if (!client.isReady) {
      let timer;
      try {
        await Promise.race([
          new Promise(resolve => client.once('ready', resolve)),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Redis did not become ready')), 5000);
          }),
        ]);
      } finally { clearTimeout(timer); }
    }
    const requests = await Promise.all(['/one', '/two', '/one'].map(path => fetch(url + path, {
      headers: { Connection: 'close' },
    })));
    const statuses = requests.map(response => response.status).sort();
    assert.deepEqual(statuses, [200, 200, 429], `Observed statuses: ${statuses.join(', ')}`);
    await new Promise(resolve => setTimeout(resolve, 280));
    assert.equal((await fetch(url + '/two', { headers: { Connection: 'close' } })).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    // The isolated bucket key has a 500 ms TTL; no production keys are touched.
    require('../config/redis').closeRedis();
  }
});
