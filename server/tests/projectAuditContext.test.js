const assert = require('node:assert/strict');
const { test } = require('node:test');
const { presentAudit } = require('../services/auditPresentation');
const auditService = require('../services/auditService');
const controller = require('../controllers/auditController');

test('backend translates stored project changes without changing the database snapshot', () => {
  const record = {
    action: 'subtask_status_changed', entity_type: 'project',
    context: { source_table: 'project_subtasks', database_operation: 'UPDATE', order_number: 'ORDER-1' },
    changes: { status: { from: 'pending', to: 'completed' }, progress: { from: 0, to: 100 } },
  };
  const before = JSON.stringify(record);
  const result = presentAudit(record);
  assert.match(result.display.description, /ORDER-1/);
  assert.match(result.display.description, /Pending \u2192 Completed/);
  assert.equal(result.display.changes[1].fromLabel, '0');
  assert.equal(JSON.stringify(record), before);
});

test('module endpoint passes its module path parameter to the read service', async t => {
  let module;
  t.mock.method(auditService, 'getAuditLogsByModule', async value => { module = value; return []; });
  let response;
  await controller.getAuditLogsByModule({ params: { module: 'project' }, query: {} },
    { json(value) { response = value; } }, error => { throw error; });
  assert.equal(module, 'project');
  assert.deepEqual(response, { status: 'success', data: [] });
});
