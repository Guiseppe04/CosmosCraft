const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the private lookup without loading unrelated services or a database.
const source = fs.readFileSync(require.resolve('../services/projectService'), 'utf8');
const lookupSource = source.slice(source.indexOf('const projectAuditContextCache'), source.lastIndexOf('/**', source.indexOf('const logActivity =')));
function makeLookup() {
  return vm.runInNewContext(`${lookupSource}\nreadProjectAuditContext`, { console: { warn() {} } });
}

test('project audit context resolves order, customer and model from their owning tables', async () => {
  const queries = [];
  const client = { release() {}, async query(sql) {
    queries.push(sql);
    if (!sql.startsWith('SELECT')) return { rows: [] };
    assert.ok(sql.includes('LEFT JOIN orders o ON o.order_id = p.order_id'));
    assert.ok(sql.includes('c.user_id = o.user_id'));
    assert.ok(sql.includes('c_model.body_model'));
    assert.doesNotMatch(sql, /p\.(customer_id|order_number|body_model)/);
    return { rows: [{ project_id: 'project', order_number: 'ORDER-1', custom_build_id: 'BUILD-1', customer_name: 'Jane Doe' }] };
  } };
  const context = await makeLookup()(client, 'project');
  assert.equal(context.orderNumber, 'ORDER-1');
  assert.equal(context.customBuildId, 'BUILD-1');
  assert.equal(context.customerName, 'Jane Doe');
  assert.equal(queries[0], 'SAVEPOINT project_audit_context_savepoint');
  assert.equal(queries.at(-1), 'RELEASE SAVEPOINT project_audit_context_savepoint');
});

test('failed context lookup restores the transaction and allows later queries', async () => {
  let aborted = false;
  const queries = [];
  const client = { release() {}, async query(sql) {
    queries.push(sql);
    if (sql.startsWith('ROLLBACK TO SAVEPOINT')) { aborted = false; return { rows: [] }; }
    if (aborted) throw new Error('current transaction is aborted');
    if (sql.startsWith('SELECT')) { aborted = true; throw new Error('lookup failed'); }
    return { rows: [] };
  } };
  const lookup = makeLookup();
  assert.equal(Object.keys(await lookup(client, 'project')).length, 0);
  await client.query('INSERT INTO audit_logs');
  assert.ok(queries.includes('ROLLBACK TO SAVEPOINT project_audit_context_savepoint'));
  await lookup(client, 'project');
  assert.equal(queries.filter(sql => sql.startsWith('SELECT')).length, 2);
});
