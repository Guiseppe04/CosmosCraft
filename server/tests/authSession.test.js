const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const users = require('../services/userService');
const rbac = require('../services/rbacService');
const tokens = require('../utils/generateTokens');
const { authenticateToken, optionalAuthenticateToken, authorize } = require('../middleware/auth');
const controller = require('../controllers/authController');
const routes = require('../routes/authRoutes');

test('JWT login, expiration, refresh, RBAC and logout lifecycle', async t => {
  for (const [key, value] of Object.entries({ JWT_SECRET: 'access-test-secret', JWT_REFRESH_SECRET: 'refresh-test-secret', JWT_EXPIRE: '15m', JWT_REFRESH_EXPIRY: '7d', NODE_ENV: 'production' })) {
    const old = process.env[key]; process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  const account = { user_id: 'user-1', is_active: true, is_verified: true, email: 'test@example.com', first_name: 'Test', last_name: 'User' };
  let role = 'admin', databaseFailure = false;
  const sessions = new Map();
  t.mock.method(pool, 'query', async (sql, params) => {
    if (databaseFailure) throw new Error('database unavailable');
    if (sql.startsWith('INSERT INTO refresh_tokens')) { sessions.set(params[1], { user_id: params[0], expires_at: params[2], is_revoked: false }); return { rows: [] }; }
    if (sql.startsWith('SELECT * FROM refresh_tokens')) return { rows: sessions.has(params[0]) ? [sessions.get(params[0])] : [] };
    if (sql.startsWith('UPDATE refresh_tokens')) { if (sessions.has(params[0])) sessions.get(params[0]).is_revoked = true; return { rows: [] }; }
    if (sql.startsWith('SELECT is_verified')) return { rows: [account] };
    throw new Error('Unexpected query');
  });
  t.mock.method(users, 'getUserByEmail', async () => account);
  t.mock.method(users, 'getUserById', async () => account);
  t.mock.method(users, 'getUserAuthInfo', async () => ({ provider: 'local', has_local_password: true }));
  t.mock.method(users, 'verifyPassword', async () => true);
  t.mock.method(rbac, 'getUserRoleSummary', async () => ({ role, roles: [role], permissions: [] }));
  t.mock.method(rbac, 'getUserPermissions', async () => []);
  const app = express(); app.use(express.json(), cookieParser()); app.use('/auth', routes);
  app.get('/protected', authenticateToken, authorize('admin', 'super_admin'), (req, res) => res.json({ role: req.user.role }));
  app.get('/optional', optionalAuthenticateToken, controller.checkAuth);
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ code: err.code || 'SERVER_ERROR' }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, cookie, body) => fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(cookie ? { Cookie: cookie } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const login = await request('/auth/email-login', null, { email: account.email, password: 'Valid!Password1' });
  assert.equal(login.status, 200);
  const { accessToken, refreshToken } = (await login.json()).data;
  const access = jwt.verify(accessToken, process.env.JWT_SECRET), refresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  assert.equal(access.exp - access.iat, 900); assert.equal(refresh.exp - refresh.iat, 604800);
  assert.equal(sessions.get(refreshToken).expires_at.getTime(), refresh.exp * 1000);
  assert.throws(() => jwt.verify(refreshToken, process.env.JWT_SECRET));
  const cookies = login.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  for (const cookie of cookies) { assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=None/); assert.match(cookie, /Partitioned/); assert.match(cookie, /Path=\//); }
  assert.match(cookies.find(c => c.startsWith('refreshToken=')), /Max-Age=604800/);
  assert.equal((await request('/protected', `accessToken=${accessToken}`)).status, 200);
  const expired = jwt.sign({ id: account.user_id, role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: -1 });
  const cookie = `accessToken=${expired}; refreshToken=${refreshToken}`;
  assert.equal((await request('/protected', `accessToken=${expired}`)).status, 401);
  const results = await Promise.all(Array.from({ length: 5 }, () => request('/protected', cookie)));
  for (const response of results) { assert.equal(response.status, 200); assert.ok(response.headers.get('X-New-Access-Token')); assert.equal(response.headers.getSetCookie().length, 1); }
  assert.equal(sessions.size, 1);
  assert.equal((await (await request('/optional', `refreshToken=${refreshToken}`)).json()).data.isAuthenticated, true);
  const renewed = await request('/auth/refresh', `refreshToken=${refreshToken}`, {});
  assert.equal(renewed.status, 200); assert.ok((await renewed.json()).data.accessToken); assert.equal(sessions.size, 1);
  role = 'staff';
  const downgraded = await request('/auth/refresh', `refreshToken=${refreshToken}`, {});
  assert.equal(jwt.verify((await downgraded.json()).data.accessToken, process.env.JWT_SECRET).role, 'staff');
  assert.equal((await request('/protected', cookie)).status, 403);
  account.is_active = false;
  assert.equal((await request('/auth/refresh', `refreshToken=${refreshToken}`, {})).status, 403);
  account.is_active = true;
  databaseFailure = true;
  assert.equal((await request('/optional', cookie)).status, 500);
  assert.equal((await request('/auth/refresh', `refreshToken=${refreshToken}`, {})).status, 500);
  databaseFailure = false;
  const logout = await request('/auth/logout', cookie, {});
  assert.equal(logout.status, 200); assert.equal(sessions.size, 1); assert.equal(sessions.get(refreshToken).is_revoked, true);
  for (const cleared of logout.headers.getSetCookie()) { assert.match(cleared, /Expires=Thu, 01 Jan 1970/); assert.doesNotMatch(cleared, /Max-Age=604800/); }
  assert.equal((await request('/auth/refresh', `refreshToken=${refreshToken}`, {})).status, 401);
  assert.equal((await request('/auth/refresh', 'refreshToken=invalid', {})).status, 401);
  const expiredRefresh = jwt.sign({ id: account.user_id }, process.env.JWT_REFRESH_SECRET, { expiresIn: -1 });
  assert.equal((await request('/auth/refresh', `refreshToken=${expiredRefresh}`, {})).status, 401);
  const fresh = await tokens.generateTokens(account.user_id);
  sessions.get(fresh.refreshToken).expires_at = new Date(Date.now() - 1);
  assert.equal((await request('/auth/refresh', `refreshToken=${fresh.refreshToken}`, {})).status, 401);
  delete process.env.JWT_EXPIRE;
  process.env.JWT_REFRESH_EXPIRY = '60s';
  const configured = await tokens.generateTokens(account.user_id);
  const configuredAccess = jwt.decode(configured.accessToken), configuredRefresh = jwt.decode(configured.refreshToken);
  assert.equal(configuredAccess.exp - configuredAccess.iat, 900);
  assert.equal(configuredRefresh.exp - configuredRefresh.iat, 60);
  assert.equal(sessions.get(configured.refreshToken).expires_at.getTime(), configuredRefresh.exp * 1000);
  sessions.get(configured.refreshToken).user_id = 'other-user';
  assert.equal((await request('/auth/refresh', `refreshToken=${configured.refreshToken}`, {})).status, 401);
});
