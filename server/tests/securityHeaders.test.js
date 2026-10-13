const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const cors = require('cors');
const { securityHeaders } = require('../middleware/securityHeaders');
const { errorHandler, notFound, AppError } = require('../middleware/errorHandler');
const policy = require('../../shared/securityPolicy.cjs');

test('headers cover JSON, errors, static media and credentialed CORS without exposing stacks', async t => {
  const loggedErrors = [];
  t.mock.method(console, 'error', (...args) => loggedErrors.push(args));
  const app = express();
  app.use(securityHeaders);
  app.use(cors({ origin: 'http://localhost:3000', credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'], exposedHeaders: ['X-New-Access-Token'] }));
  app.use(express.json());
  app.get('/ok', (req, res) => res.json({ ok: true }));
  app.post('/body', (req, res) => res.json(req.body));
  app.get('/failure', (req, res, next) => next(new Error('private-configuration-and-token')));
  app.get('/unauthorized', (req, res, next) => next(new AppError('Please sign in.', 401)));
  app.get('/limited', (req, res) => res.status(429).json({ message: 'Try again later.' }));
  app.get('/uploads/test.png', (req, res) => res.type('png').send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')));
  app.use(notFound, errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [path, status] of [['/ok', 200], ['/failure', 500], ['/missing', 404], ['/unauthorized', 401], ['/limited', 429], ['/uploads/test.png', 200]]) {
    const res = await fetch(base + path, { headers: { Origin: 'http://localhost:3000' } });
    assert.equal(res.status, status);
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(res.headers.get('permissions-policy'), 'geolocation=()');
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
    assert.equal(res.headers.get('cross-origin-embedder-policy'), null);
    assert.equal(res.headers.get('cross-origin-resource-policy'), path.startsWith('/uploads/') ? 'cross-origin' : 'same-origin');
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(res.headers.get('strict-transport-security'), null);
    assert.match(res.headers.get('content-type'), path.endsWith('.png') ? /^image\/png/ : /^application\/json/);
    if (path === '/failure') { const body = await res.json(); assert.equal(body.stack, undefined); assert.doesNotMatch(JSON.stringify(body), /private-configuration-and-token/); }
  }
  const preflight = await fetch(base + '/ok', { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'Authorization,X-Refresh-Token' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('x-content-type-options'), 'nosniff');
  const invalidJson = await fetch(base + '/body', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"token":"private-test-value"' });
  assert.equal(invalidJson.status, 400); assert.doesNotMatch(await invalidJson.text(), /private-test-value|stack/);
  assert.doesNotMatch(JSON.stringify(loggedErrors), /private-test-value|private-configuration-and-token/);
});

test('HSTS is sent only for secure production requests, without subdomain or preload commitments', async t => {
  const old = process.env.NODE_ENV; t.after(() => { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; });
  const app = express(); app.set('trust proxy', 1); app.use(securityHeaders); app.get('/', (req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const [environment, protocol, expected] of [['development', 'http', null], ['development', 'https', null], ['production', 'http', null], ['production', 'https', 'max-age=31536000']]) {
    process.env.NODE_ENV = environment;
    const res = await fetch(`http://127.0.0.1:${server.address().port}/`, { headers: { 'X-Forwarded-Proto': protocol } });
    assert.equal(res.headers.get('strict-transport-security'), expected);
  }
});

test('document candidate uses exact browser origins and preserves the tested baseline', () => {
  const env = { VITE_API_URL: 'http://localhost:5000', VITE_API_URL_PROD: 'https://api.example/api', VITE_SOCKET_URL: 'https://socket.example', VITE_WS_URL: 'wss://messages.example/ws' };
  const prod = policy.createFrontendHeaders(env, { documentOrigin: 'https://app.example' });
  const candidate = prod['Content-Security-Policy-Report-Only'];
  for (const origin of ['https://api.example', 'wss://api.example', 'https://api.cloudinary.com', 'https://res.cloudinary.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'wss://socket.example']) assert.ok(candidate.includes(origin), origin);
  assert.ok(!candidate.includes('messages.example')); // Legacy WebSocketProvider is not mounted by App.
  for (const forbidden of ['localhost', 'supabase', 'brevo', 'postgres', 'unsafe-eval', 'upgrade-insecure-requests', '*']) assert.ok(!candidate.includes(forbidden), forbidden);
  assert.equal(prod['Content-Security-Policy'], policy.documentBaseline);
  assert.equal(prod['Cross-Origin-Embedder-Policy'], undefined);
  assert.equal(prod['Strict-Transport-Security'], undefined);
  const lan = policy.createFrontendHeaders(env, { development: true, documentOrigin: 'http://192.168.1.2:3000' })['Content-Security-Policy-Report-Only'];
  for (const origin of ['http://localhost:5000', 'ws://localhost:5000', 'http://192.168.1.2:5000', 'ws://192.168.1.2:3000']) assert.ok(lan.includes(origin));
  assert.throws(() => policy.createFrontendPolicy({ VITE_API_URL_PROD: 'https://user:secret@api.example' }));
});
