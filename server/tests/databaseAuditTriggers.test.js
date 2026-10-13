const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { wrapAuditClient } = require('../config/auditDatabaseContext');
const { auditRequestContext, getAuditRequestContext } = require('../services/auditRequestContext');
const { presentAudit } = require('../services/auditPresentation');

const migration = fs.readFileSync(path.join(__dirname, '../migrations/46_database_audit_triggers.sql'), 'utf8');
const marker = '-- COSMOSCRAFT DATABASE AUDIT TRIGGERS (migration 46)';
function testSchema() {
  // PGlite embeds PostgreSQL without the dump's optional extension binaries or
  // psql commands. All tables, constraints and application functions stay real.
  return fs.readFileSync(path.join(__dirname, '../../schema.sql'), 'utf8').split(marker)[0]
    .replace(/^\\.*$/gm, '')
    .replace(/^SET transaction_timeout.*$/gm, '')
    .replace(/^CREATE EXTENSION.*$/gm, '')
    .replace(/^COMMENT ON EXTENSION.*$/gm, '')
    .replace(/^CREATE INDEX .*gin_trgm_ops.*$/gm, '');
}

test('database triggers own history, redact secrets, preserve context and roll back atomically', async t => {
  const db = new PGlite();
  const actor = '10000000-0000-4000-8000-000000000001';
  const customer = '10000000-0000-4000-8000-000000000002';
  const order = '20000000-0000-4000-8000-000000000001';
  const project = '30000000-0000-4000-8000-000000000001';
  try {
    await db.exec(testSchema());
    await db.exec('SET search_path = public');
    await db.query("INSERT INTO users(user_id,email,first_name,last_name,role,password_hash) VALUES($1,'admin@test.local','Admin','User','admin','super-secret')", [actor]);
    await db.query("INSERT INTO users(user_id,email,first_name,last_name) VALUES($1,'customer@test.local','Customer','User')", [customer]);
    await db.query("INSERT INTO orders(order_id,order_number,user_id,subtotal,total_amount) VALUES($1,'AUDIT-ORDER',$2,1000,1000)", [order, customer]);
    await db.query("INSERT INTO projects(project_id,order_id,title) VALUES($1,$2,'Custom Guitar')", [project, order]);
    // Historical receipts must survive the transition without inventing events.
    await db.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,'project_part_received','project',$2,$3)`,
      [actor, project, { part_key: 'neck', part_name: 'Neck', received_quantity: 2, stock_updated: true, received_by: actor }]);
    await db.query(`INSERT INTO audit_logs(action,entity_type,entity_id,details) VALUES('project_part_unreceived','project',$1,$2)`,
      [project, { part_key: 'neck', received_quantity: -1, stock_updated: true }]);
    await db.exec(migration);

    await t.test('every application table has a trigger; rerunning preserves backfilled receipts', async () => {
      const uncovered = await db.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>'audit_logs'
        AND NOT EXISTS(SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid=c.oid AND tg.tgname='trg_database_audit')`);
      assert.deepEqual(uncovered.rows, []);
      const before = (await db.query('SELECT count(*)::int AS count FROM audit_logs')).rows[0].count;
      await db.exec(migration);
      assert.equal((await db.query('SELECT count(*)::int AS count FROM audit_logs')).rows[0].count, before);
      const receipt = (await db.query('SELECT received_quantity,stock_deducted_quantity FROM project_part_receipts')).rows[0];
      assert.equal(Number(receipt.received_quantity), 1);
      assert.equal(Number(receipt.stock_deducted_quantity), 1);
    });

    await t.test('request actor, IP, user agent and status diff are captured by direct SQL', async () => {
      await db.exec('BEGIN');
      await db.query(`SELECT set_config('cosmos.audit_actor_id',$1,true),set_config('cosmos.audit_ip','127.0.0.1',true),
        set_config('cosmos.audit_user_agent','Audit Test Browser',true)`, [actor]);
      await db.query("UPDATE orders SET status='processing' WHERE order_id=$1", [order]);
      await db.exec('COMMIT');
      const log = (await db.query("SELECT * FROM audit_logs WHERE action='ORDER_STATUS_CHANGED' ORDER BY audit_id DESC LIMIT 1")).rows[0];
      assert.equal(log.user_id, actor);
      assert.equal(log.ip_address, '127.0.0.1');
      assert.equal(log.user_agent, 'Audit Test Browser');
      assert.deepEqual(log.changes.status, { from: 'pending', to: 'processing' });
      assert.equal(log.context.order_number, 'AUDIT-ORDER');
      assert.equal(log.context.actor_name, 'Admin User');
      assert.ok(log.search_text.includes('audit-order'));
      assert.ok(presentAudit(log).display.description.includes('AUDIT-ORDER'));
      await db.query("UPDATE orders SET notes='direct database maintenance' WHERE order_id=$1", [order]);
      assert.equal((await db.query('SELECT user_id FROM audit_logs ORDER BY audit_id DESC LIMIT 1')).rows[0].user_id, null);
    });

    await t.test('nested credentials, OTP values, private destinations and file bytes are redacted', async () => {
      await db.query("UPDATE users SET password_hash='changed-secret' WHERE user_id=$1", [actor]);
      const log = (await db.query("SELECT * FROM audit_logs WHERE action='PASSWORD_RESET' ORDER BY audit_id DESC LIMIT 1")).rows[0];
      assert.equal(log.details.password_hash, '[redacted]');
      assert.ok(!JSON.stringify(log).includes('changed-secret'));
      const redacted = (await db.query('SELECT audit_redact($1::jsonb) AS value', [{
        config: { apiKey: 'key-secret', password: 'password-secret', accountNumber: '09123456789' },
        payment_destination: { account_number: '09123456789' }, file_data: 'file-secret',
        code: '123456', preview_image: 'data:image/png;base64,PRIVATE', notes: 'safe reason',
      }])).rows[0].value;
      assert.equal(redacted.notes, 'safe reason');
      for (const secret of ['key-secret','password-secret','09123456789','file-secret','123456','PRIVATE']) {
        assert.ok(!JSON.stringify(redacted).includes(secret), secret);
      }
    });

    await t.test('rollback removes audit events, unchanged updates are skipped, child events identify their project', async () => {
      const before = (await db.query('SELECT count(*)::int AS count FROM audit_logs')).rows[0].count;
      await db.exec('BEGIN');
      await db.query("UPDATE projects SET progress=50 WHERE project_id=$1", [project]);
      await db.exec('ROLLBACK');
      assert.equal((await db.query('SELECT count(*)::int AS count FROM audit_logs')).rows[0].count, before);
      await db.query('UPDATE projects SET updated_at=now() WHERE project_id=$1', [project]);
      assert.equal((await db.query('SELECT count(*)::int AS count FROM audit_logs')).rows[0].count, before);
      const milestone = (await db.query("INSERT INTO project_milestones(project_id,title) VALUES($1,'Neck') RETURNING milestone_id", [project])).rows[0].milestone_id;
      const task = (await db.query("INSERT INTO project_subtasks(milestone_id,title) VALUES($1,'Shape') RETURNING subtask_id", [milestone])).rows[0].subtask_id;
      await db.query("UPDATE project_subtasks SET status='completed' WHERE subtask_id=$1", [task]);
      const log = (await db.query("SELECT * FROM audit_logs WHERE action='subtask_status_changed' ORDER BY audit_id DESC LIMIT 1")).rows[0];
      assert.equal(log.entity_id, project);
      assert.equal(log.context.project_title, 'Custom Guitar');
      assert.equal(log.context.order_number, 'AUDIT-ORDER');
      assert.equal(log.previous_status, 'pending');
      assert.equal(log.new_status, 'completed');
    });

    await t.test('walk-in build assignment and receipt changes are derived from business rows', async () => {
      await db.exec('BEGIN');
      await db.query("SELECT set_config('cosmos.audit_actor_id',$1,true)", [actor]);
      const build = (await db.query(`INSERT INTO customizations(user_id,name,guitar_type,total_price,config_json)
        VALUES($1,'Customer Strat','electric',1000,$2) RETURNING customization_id`,
        [customer, { _walkIn: { createdBy: actor, customerId: customer } }])).rows[0];
      await db.query("UPDATE project_part_receipts SET received_quantity=2,stock_deducted_quantity=2 WHERE project_id=$1", [project]);
      await db.exec('COMMIT');
      const sent = (await db.query("SELECT * FROM audit_logs WHERE action='BUILD_SENT_TO_CUSTOMER'")).rows[0];
      assert.equal(sent.entity_id, build.customization_id);
      assert.equal(sent.user_id, actor);
      assert.equal(sent.context.customerId, customer);
      assert.equal(sent.context.customerName, 'Customer User');
      const receipt = (await db.query("SELECT * FROM audit_logs WHERE context->>'source_table'='project_part_receipts' ORDER BY audit_id DESC LIMIT 1")).rows[0];
      assert.equal(receipt.entity_id, project);
      assert.equal(receipt.action, 'project_part_received');
      assert.equal(receipt.details.received_quantity, 1);
      assert.equal(receipt.details.stock_updated, true);
      await db.query('TRUNCATE category_parent_links_backup');
      const truncation = (await db.query("SELECT * FROM audit_logs WHERE action='TRUNCATE' ORDER BY audit_id DESC LIMIT 1")).rows[0];
      assert.equal(truncation.context.source_table, 'category_parent_links_backup');
      assert.ok(truncation.search_text);
    });

    await t.test('manual audit writes and history tampering are rejected, actor deletion preserves snapshot', async () => {
      for (const sql of ["INSERT INTO audit_logs(action,entity_type) VALUES('UPDATE','users')", 'UPDATE audit_logs SET action=\'DELETE\'', 'DELETE FROM audit_logs', 'TRUNCATE audit_logs']) {
        await assert.rejects(db.query(sql), /Audit history is written only/);
      }
      // The receipt FK also clears received_by; both changes are audited.
      await db.query('DELETE FROM users WHERE user_id=$1', [actor]);
      const log = (await db.query("SELECT user_id,context FROM audit_logs WHERE action='ORDER_STATUS_CHANGED' LIMIT 1")).rows[0];
      assert.equal(log.user_id, null);
      assert.equal(log.context.actor_name, 'Admin User');
    });

    await t.test('an audit insert failure prevents the business change from committing', async () => {
      const before = (await db.query('SELECT notes FROM orders WHERE order_id=$1', [order])).rows[0].notes;
      await db.exec("ALTER TABLE audit_logs ADD CONSTRAINT test_audit_unavailable CHECK (action <> 'UPDATE') NOT VALID");
      try {
        await assert.rejects(db.query("UPDATE orders SET notes='must not commit' WHERE order_id=$1", [order]), /test_audit_unavailable/);
        assert.equal((await db.query('SELECT notes FROM orders WHERE order_id=$1', [order])).rows[0].notes, before);
      } finally { await db.exec('ALTER TABLE audit_logs DROP CONSTRAINT test_audit_unavailable'); }
    });
  } finally { await db.close(); }
});

test('connection context is transaction-local, serialized and cleared across requests and rollbacks', async () => {
  const calls = [];
  let releases = 0;
  let context = { actorId: 'actor-a', ip: '', userAgent: '', source: 'request' };
  const client = wrapAuditClient({ async query(sql, values) {
    calls.push({ sql, values });
    if (sql === 'FAIL') throw new Error('statement failed');
    return { rows: [{ sql }] };
  }, release() { releases++; } }, () => ({ ...context }));
  await client.query('BEGIN');
  await client.query('UPDATE first');
  context.actorId = 'actor-b';
  await client.query('UPDATE second');
  await client.query('COMMIT');
  context = { actorId: '', ip: '', userAgent: '', source: 'database' };
  await assert.rejects(client.query('FAIL'), /statement failed/);
  const results = await Promise.all([client.query('SELECT first'), client.query('SELECT second')]);
  assert.equal(results.length, 2);
  const settings = calls.filter(c => c.sql.includes('set_config'));
  assert.equal(settings[0].values[0], 'actor-a');
  assert.equal(settings[1].values[0], 'actor-b');
  assert.equal(settings[2].values[0], '');
  assert.ok(settings.every(c => c.sql.includes('$1, true')));
  assert.equal(calls.filter(c => c.sql === 'ROLLBACK').length, 1);
  client.release();
  assert.equal(releases, 1);
});

test('request context follows authentication without trusting a request body actor', async () => {
  const req = { body: { user_id: 'spoof' }, ip: '127.0.0.1', headers: { 'user-agent': 'Browser' } };
  await new Promise((resolve, reject) => auditRequestContext(req, {}, async () => {
    try {
      assert.equal(getAuditRequestContext().actorId, '');
      req.user = { user_id: '10000000-0000-4000-8000-000000000001' };
      await Promise.resolve();
      assert.equal(getAuditRequestContext().actorId, req.user.user_id);
      resolve();
    } catch (error) { reject(error); }
  }));
  assert.equal(getAuditRequestContext().actorId, '');
});

module.exports = { testSchema, migration };
