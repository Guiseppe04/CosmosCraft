const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');

const queries = [];
const broadcasts = [];
const roles = [];
let storedBranch;
const locations = new Map();
let failCreate = false;
const pool = { async query(sql, params) {
  queries.push({ sql, params });
  if (sql.includes('CREATE TABLE') && failCreate) { failCreate = false; throw new Error('Temporary connection failure'); }
  if (sql.startsWith('UPDATE branch_settings')) storedBranch = { ...storedBranch, address: params[0], address_details: JSON.parse(params[1]) };
  if (sql.startsWith('SELECT') && sql.includes('FROM branch_locations')) return { rows: [...locations.values()] };
  if (sql.startsWith('INSERT INTO branch_locations') || sql.startsWith('UPDATE branch_locations')) {
    if (sql.startsWith('UPDATE') && !locations.has(params[4])) return { rows: [] };
    const location = { id: params[4], name: params[0], address: params[1], hours: params[2], address_details: JSON.parse(params[3]) };
    locations.set(location.id, location);
    return { rows: [location] };
  }
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

const handler = (method, path) => router.stack.find((layer) => layer.route?.methods[method] && (!path || layer.route.path === path)).route.stack.at(-1).handle;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const address = { country: 'PH', streetLine1: ' 123 Example Street ', streetLine2: 'Unit 2', barangay: 'Borol', city: 'Balagtas', stateProvince: 'Bulacan', postalZipCode: '3016' };

test('branch schema initialization retries after failure and preserves existing addresses', async () => {
  failCreate = true;
  await assert.rejects(service.ensureBranchSettings(), /Temporary connection failure/);
  await service.ensureBranchSettings();
  const seed = queries.find((query) => query.sql.includes('INSERT INTO branch_settings'));
  assert.match(seed.sql, /ON CONFLICT \(id\) DO NOTHING/);
  assert.equal(queries.filter((query) => query.sql.includes('CREATE TABLE')).length, 3);
});

test('branch settings are public to read and restricted to super admins to edit', () => {
  assert.deepEqual(roles, [['super_admin'], ['super_admin'], ['super_admin']]);
  assert.equal(router.stack.find((layer) => layer.route.methods.get).route.stack.length, 1);
  assert.equal(router.stack.find((layer) => layer.route.methods.put).route.stack.length, 3);
  for (const layer of router.stack.filter(layer => layer.route.path.startsWith('/locations'))) assert.equal(layer.route.stack.length, 3);
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

test('additional branches can be created, listed and edited without replacing the primary branch', async () => {
  const primary = { ...storedBranch };
  const body = { name: 'CosmosCraft Malolos Branch', hours: 'Mon-Fri 9 AM - 5 PM', address_details: address };
  const created = response();
  await handler('post', '/locations')({ body, params: {} }, created);
  assert.equal(created.statusCode, 201);
  assert.notEqual(created.body.data.id, primary.id);
  assert.deepEqual(broadcasts.at(-1), ['branch:updated', created.body.data]);
  const listed = response();
  await handler('get')({}, listed);
  assert.deepEqual(listed.body.branches, [primary, created.body.data]);
  const updated = response();
  await handler('put', '/locations/:branchId')({ body: { ...body, name: 'Updated branch' }, params: { branchId: created.body.data.id } }, updated);
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.data.name, 'Updated branch');
  assert.deepEqual(storedBranch, primary);
  const missing = response();
  await handler('put', '/locations/:branchId')({ body, params: { branchId: 'unknown' } }, missing);
  assert.equal(missing.statusCode, 404);
});

test('invalid new branch details are rejected before querying the database', async () => {
  const count = queries.length;
  for (const body of [{}, { name: ' ', hours: '9 AM', address_details: address }, { name: 'Branch', hours: '', address_details: address }]) {
    const res = response();
    await handler('post', '/locations')({ body, params: {} }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(queries.length, count);
});
