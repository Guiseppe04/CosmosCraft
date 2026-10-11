const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../config/database');
const service = require('../services/auditService');
const { validateAuditFilters, validateAuditId } = require('../services/auditFilters');

test('audit routes retain authentication and staff/admin authorization with input validation', async t => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const rbac = require('../services/rbacService');
  const terms = require('../services/termsService');
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'audit-test-only-secret';
  let role = 'customer';
  t.mock.method(pool, 'query', async () => ({ rows: [{ is_active: true, is_verified: true }] }));
  t.mock.method(rbac, 'getUserRoleSummary', async () => ({ role }));
  t.mock.method(terms, 'hasAccountAcceptance', async () => true);
  let readCalls = 0;
  t.mock.method(service, 'getAuditLogs', async () => { readCalls++; return { logs: [], total: 0, limit: 25, offset: 0 }; });
  const app = express();
  app.use('/api/audit-logs', require('../routes/auditRoutes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/audit-logs`;
  const token = jwt.sign({ id: '10000000-0000-4000-8000-000000000001' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };
  try {
    assert.equal((await fetch(endpoint)).status, 401);
    assert.equal((await fetch(endpoint, { headers })).status, 403);
    assert.equal(readCalls, 0);
    for (role of ['staff', 'admin', 'super_admin']) assert.equal((await fetch(endpoint, { headers })).status, 200);
    assert.equal(readCalls, 3);
    assert.equal((await fetch(endpoint + '?limit=100', { headers })).status, 400);
    assert.equal((await fetch(endpoint + '?start_date=invalid', { headers })).status, 400);
    assert.equal(readCalls, 3);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  }
});

test('invalid filter inputs fail before SQL execution', () => {
  for (const filters of [{ limit: 51 }, { offset: -1 }, { limit: '25junk' },
    { search: ['one', 'two'] }, { start_date: 'invalid' },
    { start_date: '2026-10-02', end_date: '2026-10-01' }, { user_id: 'invalid' },
    { entity_type: "order'; DROP TABLE users" }, { unknown: true }]) {
    assert.throws(() => validateAuditFilters(filters), error => error.statusCode === 400);
  }
  assert.throws(() => validateAuditId('9223372036854775808'));
  assert.equal(validateAuditFilters({}).limit, 25);
});

test('PostgreSQL filters, counts, pagination, literal search and compact list projection', async t => {
  const db = new PGlite();
  const actor = '10000000-0000-4000-8000-000000000001';
  const entity = '20000000-0000-4000-8000-000000000001';
  const queries = [];
  t.mock.method(pool, 'query', async (sql, values) => { queries.push({ sql, values }); return db.query(sql, values); });
  try {
    await db.exec(`CREATE TABLE users(user_id uuid PRIMARY KEY,email text,role text,first_name text,middle_name text,last_name text);
      CREATE TABLE audit_logs(audit_id bigserial PRIMARY KEY,user_id uuid,entity_type text,entity_id uuid,action text,
      previous_status text,new_status text,created_at timestamptz,context jsonb,details jsonb,changes jsonb,search_text text);`);
    await db.query("INSERT INTO users VALUES($1,'admin@example.test','admin','Current',NULL,'Actor')", [actor]);
    for (let i = 0; i < 60; i++) {
      await db.query(`INSERT INTO audit_logs(user_id,entity_type,entity_id,action,created_at,context,details,changes,search_text)
        VALUES($1,$2,$3,'UPDATE','2026-10-01T10:00:00Z',$4,$5,$6,$7)`,
      [actor, i < 55 ? 'order' : 'payment', entity,
        { source_table: 'orders', database_operation: 'UPDATE', order_number: 'ORDER-100', actor_name: 'Historic Actor' },
        { old: { large: 'x'.repeat(20000), payment_method: 'cash', previous_quantity: 10 },
          new: { new_quantity: 15 }, reason: 'Adjusted price' },
        { total_amount: { from: 100, to: 200 }, active: { from: false, to: true }, config: { from: {}, to: { large: 'x'.repeat(20000) } } },
        i === 0 ? 'order-100 historic actor 50%_discount' : 'order-100 historic actor']);
    }
    const first = await service.getAuditLogs({ entity_type: 'order', action: 'UPDATE', start_date: '2026-10-01', end_date: '2026-10-02', limit: 25 });
    assert.equal(first.total, 55); assert.equal(first.logs.length, 25);
    assert.equal(first.logs[0].user_name, 'Historic Actor');
    assert.equal(first.logs[0].changes.active.from, false);
    assert.equal(first.logs[0].changes.config.to, 'updated data');
    assert.equal(first.logs[0].details.old, undefined);
    assert.equal(first.logs[0].details.payment_method, 'cash');
    assert.equal(first.logs[0].details.previous_quantity, 10);
    assert.equal(first.logs[0].details.new_quantity, 15);
    assert.match(first.logs[0].display.description, /ORDER-100/);
    const second = await service.getAuditLogs({ entity_type: 'order', limit: 25, offset: 25 });
    assert.equal(new Set([...first.logs, ...second.logs].map(row => row.audit_id)).size, 50);
    assert.equal((await service.getAuditLogs({ search: '50%_discount' })).total, 1);
    assert.equal((await service.getAuditLogs({ search: 'Current' })).total, 60);
    assert.equal((await service.getAuditLogs({ search: "' OR 1=1 --" })).total, 0);
    assert.equal((await service.getAuditLogs({ entity_id: entity, user_id: actor })).total, 60);
    const detail = await service.getAuditLogById(first.logs[0].audit_id);
    assert.equal(detail.details.old.large.length, 20000);
    assert.equal(queries.filter(query => query.sql.startsWith('SELECT COUNT')).every(query => !query.sql.includes('JOIN')), true);
    await db.exec(fs.readFileSync(path.join(__dirname, '../migrations/47_audit_filter_indexes.sql'), 'utf8'));
    await db.exec(`INSERT INTO audit_logs(entity_type,action,created_at,context,details,changes,search_text)
      SELECT 'order','UPDATE','2020-01-01'::timestamptz + n * interval '1 minute','{}','{}','{}','old'
      FROM generate_series(1,20000) n; ANALYZE audit_logs;`);
    const query = queries[0];
    const plan = await db.query('EXPLAIN (ANALYZE, FORMAT JSON) ' + query.sql, query.values);
    assert.match(JSON.stringify(plan.rows), /idx_audit_logs_timeline/);
    console.log('Filtered list plan uses timeline index on 20,060 rows.');
  } finally { await db.close(); }
});
