const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');

const queries = [];
const broadcasts = [];
const roles = [];
let storedBranch;
let failCreate = false;
const pool = { async query(sql, params) {
  queries.push({ sql, params });
  if (sql.includes('CREATE TABLE') && failCreate) { failCreate = false; throw new Error('Temporary connection failure'); }
  if (sql.startsWith('UPDATE branch_settings')) storedBranch = { ...storedBranch, address: params[0], address_details: JSON.parse(params[1]) };
  return { rows: storedBranch ? [{ ...storedBranch }] : [] };
} };
const originalLoad = Module._load;
Module._load = function (request, parent, ...args) {
  if (parent?.filename.endsWith('branchSettingsService.js') && request === '../config/database') return { pool };
  if (parent?.filename.endsWith('branchRoutes.js')) {
    if (request === '../services/socketService') return { emitBroadcast: (...args) => broadcasts.push(args) };
    if (request === '../middleware/auth') return { authenticateToken() {}, authorize: (...allowed) => { roles.push(allowed); return () => {}; } };
  }
  return originalLoad.call(this, request, parent, ...args);
};
let service, router;
try {
  service = require('../services/branchSettingsService');
  router = require('../routes/branchRoutes');
} finally { Module._load = originalLoad; }
storedBranch = { ...service.DEFAULT_BRANCH };

const handler = (method) => router.stack.find((layer) => layer.route?.methods[method]).route.stack.at(-1).handle;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const address = { country: 'PH', streetLine1: ' 123 Example Street ', streetLine2: 'Unit 2', barangay: 'Borol', city: 'Balagtas', stateProvince: 'Bulacan', postalZipCode: '3016' };

test('branch schema initialization retries after failure and preserves existing addresses', async () => {
  failCreate = true;
  await assert.rejects(service.ensureBranchSettings(), /Temporary connection failure/);
  await service.ensureBranchSettings();
  const seed = queries.find((query) => query.sql.includes('INSERT INTO branch_settings'));
  assert.match(seed.sql, /ON CONFLICT \(id\) DO NOTHING/);
  assert.equal(queries.filter((query) => query.sql.includes('CREATE TABLE')).length, 2);
});

test('branch settings are public to read and restricted to super admins to edit', () => {
  assert.deepEqual(roles, [['super_admin']]);
  assert.equal(router.stack.find((layer) => layer.route.methods.get).route.stack.length, 1);
  assert.equal(router.stack.find((layer) => layer.route.methods.put).route.stack.length, 3);
});

test('saving a structured address persists and broadcasts the same public branch', async () => {
  const res = response();
  await handler('put')({ body: address }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, 'balagtas-main');
  assert.equal(res.body.data.address, '123 Example Street, Unit 2, Borol, Balagtas, Bulacan 3016, Philippines');
  assert.equal(res.body.data.address_details.streetLine1, '123 Example Street');
  assert.equal(res.body.data.address_details.label, undefined);
  assert.equal(res.body.data.address_details.isDefault, undefined);
  assert.deepEqual(broadcasts, [['branch:updated', res.body.data]]);
  const publicResponse = response();
  await handler('get')({}, publicResponse);
  assert.deepEqual(publicResponse.body.data, res.body.data);
  const update = queries.find((query) => query.sql.startsWith('UPDATE branch_settings'));
  assert.match(update.sql, /address_details = \$2::jsonb/);
});

test('invalid or customer-specific fields cannot modify the branch address', async () => {
  const writeCount = queries.length;
  const broadcastCount = broadcasts.length;
  for (const body of [undefined, {}, { ...address, streetLine1: ' ' }, { ...address, barangay: '' }, { ...address, country: 'Philippines' }, { ...address, label: 'Home' }, { ...address, isDefault: true }]) {
    const res = response();
    await handler('put')({ body }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(queries.length, writeCount);
  assert.equal(broadcasts.length, broadcastCount);
});

test('international branch addresses use the customer form fields without requiring a barangay', async () => {
  const res = response();
  await handler('put')({ body: { ...address, country: 'US', stateProvince: 'California', city: 'San Francisco', postalZipCode: '94103', barangay: '' } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body.data.address, /San Francisco, California 94103, US$/);
});
