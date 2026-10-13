import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authFetch } from '../src/app/utils/authFetch.js'
import { getAuthToken, setAuthToken } from '../src/app/utils/apiConfig.js'

function setup(t) {
  const storage = new Map()
  const events = []
  const oldWindow = globalThis.window
  globalThis.window = { location: { origin: 'https://app.example', hostname: 'app.example' }, localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) }, dispatchEvent: event => events.push(event.type) }
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow })
  setAuthToken('old')
  storage.set('cosmoscraft_auth', '{}')
  return { storage, events }
}

test('concurrent 401s refresh once and retry with the renewed bearer and credentials', async t => {
  setup(t)
  let refreshes = 0, retries = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.credentials, 'include')
    if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise(resolve => setTimeout(resolve, 10)); return Response.json({ data: { accessToken: 'new' } }) }
    if (options.headers.Authorization === 'Bearer old') return Response.json({}, { status: 401 })
    assert.equal(options.headers.Authorization, 'Bearer new'); retries++
    return Response.json({ success: true })
  })
  const responses = await Promise.all(Array.from({ length: 8 }, () => authFetch('https://app.example/api/orders', { headers: { Authorization: 'Bearer old' } })))
  assert.equal(refreshes, 1); assert.equal(retries, 8); assert.ok(responses.every(r => r.ok)); assert.equal(getAuthToken(), 'new')
})

test('invalid refresh clears session, but temporary errors preserve it', async t => {
  for (const status of [401, 403, 429, 500, 503]) {
    const { storage, events } = setup(t)
    t.mock.method(globalThis, 'fetch', async url => Response.json({}, { status: url.endsWith('/auth/refresh') ? status : 401 }))
    await assert.rejects(authFetch('https://app.example/api/orders'))
    assert.equal(Boolean(getAuthToken()), status !== 401 && status !== 403)
    assert.equal(storage.has('cosmoscraft_auth'), status !== 401 && status !== 403)
    assert.equal(events.length, status === 401 || status === 403 ? 1 : 0)
  }
})

test('login and refresh are excluded; a persistent 401 retries only once; network errors preserve state', async t => {
  setup(t)
  let count = 0
  t.mock.method(globalThis, 'fetch', async url => { count++; return url.endsWith('/auth/refresh') ? Response.json({ data: { accessToken: 'new' } }) : Response.json({}, { status: 401 }) })
  assert.equal((await authFetch('https://app.example/auth/email-login')).status, 401); assert.equal(count, 1)
  await authFetch('https://app.example/auth/refresh'); assert.equal(count, 2)
  assert.equal((await authFetch('https://app.example/api/orders')).status, 401); assert.equal(count, 5)
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(authFetch('https://app.example/api/orders')); assert.equal(getAuthToken(), 'new')
})

test('a delayed refresh failure cannot clear a subsequent successful login', async t => {
  const { events } = setup(t)
  let releaseRefresh, refreshStarted
  const started = new Promise(resolve => { refreshStarted = resolve })
  t.mock.method(globalThis, 'fetch', async url => {
    if (!url.endsWith('/auth/refresh')) return Response.json({}, { status: 401 })
    refreshStarted()
    return new Promise(resolve => { releaseRefresh = () => resolve(Response.json({}, { status: 401 })) })
  })
  const request = authFetch('https://app.example/api/orders')
  const rejected = assert.rejects(request)
  await started
  setAuthToken('fresh-login')
  releaseRefresh()
  await rejected
  assert.equal(getAuthToken(), 'fresh-login')
  assert.deepEqual(events, [])
})
