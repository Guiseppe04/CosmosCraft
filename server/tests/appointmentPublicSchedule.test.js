const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const { createServer } = require('node:http');
const { io: connectSocket } = require('../../client/node_modules/socket.io-client');
const service = require('../services/appointmentService');
const controller = require('../controllers/appointmentController');
const sockets = require('../services/socketService');
const audit = require('../services/auditService');

test('guests can read calendar availability, cannot book, and receive close/reopen broadcasts', async () => {
  const methods = ['getAvailableDates', 'getOccupiedDates', 'getScheduleEntry', 'addUnavailableDate', 'removeUnavailableDate'];
  const originals = Object.fromEntries(methods.map(name => [name, service[name]]));
  const originalAudit = audit.logScheduleEvent;
  const date = '2026-11-02';
  service.getAvailableDates = async () => [date];
  service.getOccupiedDates = async () => [];
  service.getScheduleEntry = async () => null;
  service.addUnavailableDate = async () => ({ id: 'closure-1', date });
  service.removeUnavailableDate = async () => ({ id: 'closure-1', date });
  audit.logScheduleEvent = async () => {};
  const app = express();
  app.use(express.json());
  app.use('/api/appointments', require('../routes/appointmentRoutes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = createServer(app);
  const socketServer = sockets.init(server);
  let guest;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${origin}/api/appointments/available-dates?date_from=${date}&date_to=${date}`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { available_dates: [date], occupied_dates: [] });
    for (const path of ['', '/unavailable-dates']) {
      const denied = await fetch(origin + '/api/appointments' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(denied.status, 401);
    }
    guest = connectSocket(origin, { transports: ['websocket'], reconnection: false });
    await new Promise((resolve, reject) => {
      guest.once('connect', resolve);
      guest.once('connect_error', reject);
    });
    const responseStub = { status() { return this; }, json() {} };
    for (const [handler, action] of [[controller.addUnavailableDate, 'unavailable_date_added'], [controller.removeUnavailableDate, 'unavailable_date_removed']]) {
      const event = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Guest did not receive schedule update')), 3000);
        guest.once('appointment:schedule_updated', payload => { clearTimeout(timeout); resolve(payload); });
      });
      await handler({ body: { date }, params: { id: 'closure-1' }, user: { user_id: 'admin-1' } }, responseStub, error => { throw error; });
      assert.deepEqual(await event, { action, date });
    }
  } finally {
    guest?.disconnect();
    await new Promise(resolve => socketServer.close(resolve));
    for (const name of methods) service[name] = originals[name];
    audit.logScheduleEvent = originalAudit;
  }
});
