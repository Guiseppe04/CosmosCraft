const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { io: connectSocket } = require('../../client/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');
const rbacService = require('../services/rbacService');
const { pool } = require('../config/database');
const projectService = require('../services/projectService');
const controller = require('../controllers/projectController');
const sockets = require('../services/socketService');

test('milestone and subtask events reach staff and the owner, never guests or other customers', async t => {
  t.mock.method(jwt, 'verify', token => ({ id: token }));
  t.mock.method(rbacService, 'getUserRoleSummary', async id => ({ role: id === 'staff' ? 'staff' : 'customer' }));
  t.mock.method(projectService, 'getProjectCustomerId', async projectId => {
    assert.equal(projectId, 'project-1');
    return 'alice';
  });
  const milestone = { project_id: 'project-1', milestone_id: 'milestone-1', title: 'Private milestone', notes: 'secret' };
  const subtask = { project_id: 'project-1', milestone_id: 'milestone-1', subtask_id: 'subtask-1',
    title: 'Private task', notes: 'secret', assigned_user_id: 'staff' };
  for (const name of ['addMilestone', 'updateMilestone', 'deleteMilestone']) {
    t.mock.method(projectService, name, async () => milestone);
  }
  for (const name of ['addSubtask', 'updateSubtaskStatus', 'deleteSubtask']) {
    t.mock.method(projectService, name, async () => subtask);
  }

  const httpServer = createServer((req, res) => res.end('ok'));
  const io = sockets.init(httpServer);
  const clients = [];
  try {
    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${httpServer.address().port}`;
    for (const id of [null, 'alice', 'bob', 'staff']) {
      const client = connectSocket(origin, { transports: ['websocket'], reconnection: false,
        ...(id ? { auth: { token: id } } : {}) });
      clients.push(client);
      await new Promise((resolve, reject) => {
        client.once('connect', resolve);
        client.once('connect_error', reject);
      });
    }
    const [guest, owner, other, staff] = clients;
    const unexpected = [];
    for (const client of [guest, other]) {
      client.on('project:milestone_updated', payload => unexpected.push(payload));
      client.on('project:subtask_updated', payload => unexpected.push(payload));
    }
    const response = { status() { return this; }, json() {} };
    const cases = [
      ['createMilestone', 'project:milestone_updated', 'created', { id: 'project-1' }, { milestoneId: 'milestone-1' }],
      ['updateMilestone', 'project:milestone_updated', 'updated', { milestoneId: 'milestone-1' }, { milestoneId: 'milestone-1' }],
      ['deleteMilestone', 'project:milestone_updated', 'deleted', { milestoneId: 'milestone-1' }, { milestoneId: 'milestone-1' }],
      ['createSubtask', 'project:subtask_updated', 'created', { milestoneId: 'milestone-1' },
        { subtaskId: 'subtask-1', milestoneId: 'milestone-1' }],
      ['updateSubtask', 'project:subtask_updated', 'updated', { subtaskId: 'subtask-1' }, { subtaskId: 'subtask-1' }],
      ['deleteSubtask', 'project:subtask_updated', 'deleted', { subtaskId: 'subtask-1' }, { subtaskId: 'subtask-1' }],
    ];
    const nextEvent = (client, event) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 2500);
      client.once(event, payload => { clearTimeout(timer); resolve(payload); });
    });
    for (const [handler, event, action, params, staffIds] of cases) {
      const ownerEvent = nextEvent(owner, event);
      const staffEvent = nextEvent(staff, event);
      await controller[handler]({ params, body: {}, user: { id: 'staff', user_id: 'staff', role: 'staff' } },
        response, error => { throw error; });
      assert.deepEqual(await ownerEvent, { projectId: 'project-1', action });
      assert.deepEqual(await staffEvent, { projectId: 'project-1', action, ...staffIds });
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(unexpected, []);
  } finally {
    for (const client of clients) client.disconnect();
    await new Promise(resolve => io.close(resolve));
  }
});

test('project notification recipient comes from the linked order owner', async t => {
  t.mock.method(pool, 'query', async (sql, params) => {
    assert.match(sql, /JOIN orders o ON o\.order_id = p\.order_id/);
    assert.match(sql, /WHERE p\.project_id = \$1/);
    assert.deepEqual(params, ['project-1']);
    return { rows: [{ user_id: 'alice' }] };
  });
  assert.equal(await projectService.getProjectCustomerId('project-1'), 'alice');
});
