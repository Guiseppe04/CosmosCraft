const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const { PGlite } = require('@electric-sql/pglite');
const { pool } = require('../config/database');
const rbac = require('../services/rbacService');
const { hash } = require('../middleware/oauthGuard');
const routes = require('../routes/authRoutes');

test('OAuth transactions, replay rejection, browser proof and single session issuance', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const userId = '10000000-0000-4000-8000-000000000001';
  const migration = fs.readFileSync(path.join(__dirname, '../migrations/52_oauth_transactions.sql'), 'utf8');
  await db.exec(`CREATE TABLE users(user_id UUID PRIMARY KEY, is_active BOOLEAN, is_verified BOOLEAN);
    CREATE TABLE oauth_codes(id SERIAL PRIMARY KEY, provider TEXT, code_hash TEXT UNIQUE, status TEXT,
      created_at TIMESTAMPTZ, processed_at TIMESTAMPTZ, user_id TEXT, oauth_user_id TEXT,
      provider_user_id TEXT, access_token TEXT, error_message TEXT);
    CREATE TABLE refresh_tokens(user_id UUID, token_hash TEXT, expires_at TIMESTAMPTZ);
    INSERT INTO users VALUES ('${userId}', true, true);`);
  await db.query(`INSERT INTO oauth_codes(provider, code_hash, status, oauth_user_id, access_token)
    VALUES ('google', $1, 'success', $2, 'old-secret')`, [hash('retained-code'), userId]);
  await db.exec(migration);
  const old = (await db.query('SELECT * FROM oauth_codes')).rows[0];
  assert.equal(old.status, 'invalidated'); assert.equal(old.oauth_user_id, null); assert.equal(old.access_token, null);
  await db.exec(migration); // rerunnable
  const oldEnv = { ...process.env };
  Object.assign(process.env, { NODE_ENV: 'production', JWT_SECRET: 'test-access', JWT_REFRESH_SECRET: 'test-refresh' });
  t.after(() => { for (const key of ['NODE_ENV', 'JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
  } });
  let failDatabase = false, providerFailure = false, exchanges = 0;
  t.mock.method(pool, 'query', (sql, values) => {
    if (failDatabase) throw new Error('database unavailable');
    return db.query(sql, values);
  });
  t.mock.method(rbac, 'getUserRoleSummary', async () => ({ role: 'customer', permissions: [] }));
  t.mock.method(rbac, 'getUserPermissions', async () => []);
  t.mock.method(passport, 'authenticate', (provider, options, callback) => (req, res) => {
    assert.equal(provider, 'google');
    if (!callback) return res.redirect('https://accounts.example/authorize?state=' + options.state);
    exchanges++;
    callback(providerFailure ? new Error('sensitive-provider-detail') : null,
      { user_id: userId, is_active: true, is_verified: true });
  });
  const app = express(); app.use(express.json(), cookieParser());
  app.use('/auth', routes); app.use('/api/auth', routes);
  app.use((err, req, res, next) => res.status(500).json({ code: 'SERVER_ERROR' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, cookie, body) => fetch(base + url, {
    redirect: 'manual', method: body ? 'POST' : 'GET',
    headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const verifier = 'a'.repeat(64);
  const start = async () => {
    const response = await request('/auth/google?challenge=' + hash(verifier));
    assert.equal(response.status, 302);
    const cookie = response.headers.getSetCookie()[0];
    assert.match(cookie, /^__Host-oauthTransaction=/); assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Secure/); assert.match(cookie, /Max-Age=300/);
    assert.doesNotMatch(cookie, /Partitioned|Domain=/);
    return { cookie: cookie.split(';')[0], state: new URL(response.headers.get('location')).searchParams.get('state') };
  };
  const callback = (tx, code, prefix = '/auth') => request(`${prefix}/google/callback?state=${tx.state}&code=${code}`, tx.cookie);
  const noSession = response => assert.equal(response.headers.getSetCookie().length, 0);

  await t.test('missing, mismatched, malformed and expired state cannot reach Google', async () => {
    assert.equal((await request('/auth/google')).status, 400);
    const tx = await start();
    for (const url of ['/auth/google/callback?code=x', '/auth/google/callback?state=x&code=x',
      `/auth/google/callback?state=${tx.state}&code[]=x`]) {
      const response = await request(url, tx.cookie); assert.equal(response.status, 400); noSession(response);
    }
    assert.equal((await callback({ ...tx, cookie: '' }, 'x')).status, 400);
    const other = await start();
    assert.equal((await callback({ ...tx, cookie: other.cookie }, 'x')).status, 409);
    assert.equal((await callback({ ...tx, state: 'b'.repeat(64) }, 'x')).status, 409);
    await db.query("UPDATE oauth_transactions SET expires_at = now() - interval '1 second' WHERE state_hash = $1", [hash(tx.state)]);
    assert.equal((await callback(tx, 'x')).status, 409);
    assert.equal(exchanges, 0);
  });
  await t.test('concurrent callbacks and completions issue exactly one session across route aliases', async () => {
    const tx = await start();
    const responses = await Promise.all([callback(tx, 'new-code'), callback(tx, 'new-code', '/api/auth')]);
    assert.deepEqual(responses.map(r => r.status).sort(), [302, 409]);
    responses.forEach(noSession); assert.equal(exchanges, 1);
    const success = responses.find(r => r.status === 302);
    assert.equal(success.headers.get('cache-control'), 'no-store');
    assert.equal(success.headers.get('referrer-policy'), 'no-referrer');
    const redirect = new URL(success.headers.get('location'));
    assert.equal(redirect.search, '');
    const handoff = new URLSearchParams(redirect.hash.slice(1)).get('handoff');
    assert.equal((await request('/auth/oauth/complete', null, { handoff, verifier: 'b'.repeat(64) })).status, 409);
    const completed = await Promise.all(['/auth', '/api/auth'].map(prefix => request(prefix + '/oauth/complete', null, { handoff, verifier })));
    assert.deepEqual(completed.map(r => r.status).sort(), [200, 409]);
    noSession(completed.find(r => r.status === 409));
    assert.equal(completed.find(r => r.status === 200).headers.getSetCookie().length, 2);
    assert.equal((await db.query('SELECT * FROM refresh_tokens')).rows.length, 1);
    const replay = await start();
    assert.equal((await callback(replay, 'new-code')).status, 409);
    assert.equal((await callback(replay, 'different-code')).status, 409);
    assert.equal((await callback(await start(), 'retained-code')).status, 409);
    assert.equal(exchanges, 1);
  });
  await t.test('provider failure, cancellation and expired handoffs cannot be retried for a session', async () => {
    providerFailure = true;
    const tx = await start();
    const failed = await callback(tx, 'failure-code');
    assert.equal(failed.status, 400); assert.doesNotMatch(await failed.text(), /sensitive-provider-detail/); noSession(failed);
    providerFailure = false;
    assert.equal((await callback(tx, 'failure-code')).status, 409);
    const cancelled = await start();
    noSession(await request(`/auth/google/callback?state=${cancelled.state}&error=access_denied`, cancelled.cookie));
    assert.equal((await callback(cancelled, 'cancelled-code')).status, 409);
    const success = await callback(await start(), 'expires-code');
    const handoff = new URLSearchParams(new URL(success.headers.get('location')).hash.slice(1)).get('handoff');
    await db.exec("UPDATE oauth_handoffs SET expires_at = now() - interval '1 second'");
    const response = await request('/auth/oauth/complete', null, { handoff, verifier });
    assert.equal(response.status, 409); noSession(response);
    assert.equal((await db.query('SELECT * FROM refresh_tokens')).rows.length, 1);
  });
  await t.test('database outage fails closed and removed Facebook/signup routes return 404', async () => {
    const tx = await start(), before = exchanges;
    failDatabase = true;
    const response = await callback(tx, 'outage-code');
    assert.equal(response.status, 500); noSession(response); assert.equal(exchanges, before);
    failDatabase = false;
    for (const prefix of ['/auth', '/api/auth']) {
      for (const route of ['/facebook', '/facebook/callback?code=x']) assert.equal((await request(prefix + route)).status, 404);
      assert.equal((await request(prefix + '/oauth-signup', null, { provider: 'facebook' })).status, 404);
    }
  });
  await t.test('account deactivation between callback and completion prevents a session', async () => {
    const response = await callback(await start(), 'deactivated-code');
    const handoff = new URLSearchParams(new URL(response.headers.get('location')).hash.slice(1)).get('handoff');
    await db.exec('UPDATE users SET is_active = false');
    const denied = await request('/auth/oauth/complete', null, { handoff, verifier });
    assert.equal(denied.status, 403); noSession(denied);
    await db.exec('UPDATE users SET is_active = true');
    assert.equal((await request('/auth/oauth/complete', null, { handoff, verifier })).status, 409);
    assert.equal((await db.query('SELECT * FROM refresh_tokens')).rows.length, 1);
  });
});
