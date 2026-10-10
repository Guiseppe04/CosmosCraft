const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const { createServer } = require('node:http');
const auth = require('../middleware/auth');
const service = require('../services/appointmentRefundService');

test('refund PATCH uses validation middleware and passes validated values to the service', async t => {
  t.mock.method(auth, 'authenticateToken', (req, res, next) => {
    req.user = { user_id: 'admin', role: req.headers['x-test-role'] || 'admin' };
    next();
  });
  const updates = [];
  t.mock.method(service, 'update', async (id, actorId, data) => {
    updates.push({ id, actorId, data });
    return { refund_request_id: id, ...data };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/appointments', require('../routes/appointmentRoutes'));
  app.use((error, req, res, next) => res.status(500).json({ message: error.message }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const patch = (body, role = 'admin') => fetch(`http://127.0.0.1:${server.address().port}/api/appointments/refund-requests/refund-1`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-test-role': role }, body: JSON.stringify(body),
  });
  try {
    for (const body of [{}, { status: 'completed' }, { status: 'refunded', proof_url: 'http://example.test/proof.png' }]) {
      assert.equal((await patch(body)).status, 400);
    }
    assert.equal((await patch({ status: 'processing' }, 'customer')).status, 403);
    assert.equal(updates.length, 0);
    assert.equal((await patch({ status: 'processing', ignored: 'value' })).status, 200);
    assert.deepEqual(updates[0], { id: 'refund-1', actorId: 'admin', data: { status: 'processing' } });
    const completed = { status: 'refunded', refund_reference: ' TRANSFER-123 ', proof_url: 'https://example.test/proof.png', admin_notes: ' Sent ' };
    assert.equal((await patch(completed)).status, 200);
    assert.deepEqual(updates[1].data, { ...completed, refund_reference: 'TRANSFER-123', admin_notes: 'Sent' });
    assert.equal((await patch({ status: 'rejected', admin_notes: 'Invalid destination' })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
