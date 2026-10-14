import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'

test('browser OAuth proof and completion lifecycle', async t => {
  const storage = () => {
    const values = new Map()
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  }
  let target, calls = 0
  const localStorage = storage(), sessionStorage = storage()
  const location = { origin: 'https://frontend.example', pathname: '/auth/success', hash: '', search: '', assign: url => { target = url } }
  const window = { location, localStorage, history: { state: null, replaceState: (state, title, url) => {
    const parsed = new URL(url, location.origin); location.hash = parsed.hash; location.search = parsed.search
  } } }
  const saved = { window: globalThis.window, sessionStorage: globalThis.sessionStorage, fetch: globalThis.fetch }
  Object.assign(globalThis, { window, sessionStorage })
  t.after(() => { for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value
  } })
  const load = name => import(`../src/app/utils/oauth.js?test=${name}`)
  await t.test('initiation sends a hash and keeps the secret in this tab', async () => {
    const { startGoogleLogin } = await load('start')
    await startGoogleLogin()
    const verifier = sessionStorage.getItem('cosmoscraft.oauth.verifier')
    assert.match(verifier, /^[a-f0-9]{64}$/)
    const url = new URL(target)
    assert.equal(url.pathname, '/auth/google')
    assert.equal(url.searchParams.get('challenge'), createHash('sha256').update(verifier).digest('hex'))
    assert.ok(!target.includes(verifier))
  })
  await t.test('concurrent and repeated UI calls redeem once and scrub the URL', async () => {
    const { completeOAuth } = await load('success')
    location.hash = '#handoff=' + 'b'.repeat(64)
    const verifier = sessionStorage.getItem('cosmoscraft.oauth.verifier')
    globalThis.fetch = async (url, options) => {
      calls++
      assert.equal(url, 'https://frontend.example/auth/oauth/complete')
      assert.deepEqual(JSON.parse(options.body), { handoff: 'b'.repeat(64), verifier })
      assert.equal(options.credentials, 'include')
      return { ok: true, json: async () => ({ data: { accessToken: 'new-session' } }) }
    }
    const first = completeOAuth(), second = completeOAuth()
    assert.equal(first, second)
    await Promise.all([first, second]); await completeOAuth()
    assert.equal(calls, 1); assert.equal(location.hash, '')
    assert.equal(sessionStorage.getItem('cosmoscraft.oauth.verifier'), null)
    assert.equal(localStorage.getItem('cosmoscraft_token'), 'new-session')
  })
  await t.test('missing browser proof never calls the completion endpoint', async () => {
    const { completeOAuth } = await load('missing')
    location.hash = '#handoff=' + 'c'.repeat(64)
    await assert.rejects(completeOAuth(), /tab/)
    assert.equal(calls, 1)
  })
  await t.test('used handoffs do not retry or overwrite an existing session', async () => {
    const { completeOAuth } = await load('used')
    location.hash = '#handoff=' + 'd'.repeat(64)
    sessionStorage.setItem('cosmoscraft.oauth.verifier', 'e'.repeat(64))
    globalThis.fetch = async () => { calls++; return { ok: false, status: 409 } }
    await assert.rejects(completeOAuth(), /already completed/)
    await assert.rejects(completeOAuth(), /already completed/)
    assert.equal(calls, 2)
    assert.equal(localStorage.getItem('cosmoscraft_token'), 'new-session')
  })
  await t.test('legacy URL tokens are scrubbed and never installed', async () => {
    const { completeOAuth } = await load('legacy')
    location.hash = ''; location.search = '?token=attacker-token&accessToken=other-token'
    await completeOAuth()
    assert.equal(location.search, ''); assert.equal(calls, 2)
    assert.equal(localStorage.getItem('cosmoscraft_token'), 'new-session')
  })
})
