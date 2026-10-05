const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const rbacService = require('../services/rbacService');
const posService = require('../services/posService');
const posRoutes = require('../routes/posRoutes');

test('POS void and return allow staff and admins, reject customers, and record the actor', async (t) => {
  t.mock.method(jwt, 'verify', (token, secret, callback) => callback(null, { id: `user-${token}` }));
  t.mock.method(pool, 'query', async () => ({ rows: [{ is_active: true, is_verified: true }] }));
  t.mock.method(rbacService, 'getUserRoleSummary', async (id) => ({ role: id.slice(5) }));
  const calls = [];
  for (const action of ['void', 'return']) {
    t.mock.method(posService, `${action}Sale`, async (...args) => {
      calls.push({ action, args });
      return { sale_id: args[0], status: action === 'void' ? 'voided' : 'returned' };
    });
  }

  const app = express();
  app.use(express.json());
  app.use('/api/pos', posRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const action of ['void', 'return']) {
      const body = action === 'void'
        ? { reason: 'Duplicate sale' }
        : { reason: 'Customer return', items: [{ item_id: 'item-1', quantity: 1, item_condition: 'resalable' }] };
      for (const role of [null, 'customer', 'staff', 'admin', 'super_admin']) {
        const before = calls.length;
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/pos/sales/sale-1/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${role}` } : {}) },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!role || role === 'customer') {
          assert.equal(response.status, role ? 403 : 401);
          assert.equal(calls.length, before);
        } else {
          assert.equal(response.status, 200, `${role} ${action}`);
          assert.equal(payload.status, 'success');
          assert.deepEqual(calls.at(-1), {
            action,
            args: ['sale-1', `user-${role}`, action === 'void' ? body.reason : body],
          });
        }
      }
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
