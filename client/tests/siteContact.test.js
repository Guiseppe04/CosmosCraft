import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const bundle = await build({
  stdin: { contents: `
    export * from './src/app/utils/siteContact.js';
    export { default as TermsAndConditionsModal } from './src/app/components/TermsAndConditionsModal.jsx';
    export { LandingPage } from './src/app/pages/LandingPage.jsx';
    export { AuthProvider } from './src/app/context/AuthContext.jsx';
    export { ThemeProvider } from './src/app/context/ThemeContext.jsx';
    export { MemoryRouter } from 'react-router';
  `, resolveDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), loader: 'jsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  define: { 'import.meta.env': '{}' },
})
const Module = require('node:module')
const compiled = new Module(fileURLToPath(import.meta.url))
compiled.filename = fileURLToPath(import.meta.url)
compiled.paths = Module._nodeModulePaths(path.dirname(compiled.filename))
compiled._compile(bundle.outputFiles[0].text, compiled.filename)
const {
  SITE_CONTACT_STORAGE_KEY, SITE_CONTACT_UPDATED_EVENT,
  getSiteContactSnapshot, publishSiteContact, refreshSiteContact, subscribeSiteContact,
  TermsAndConditionsModal, LandingPage, AuthProvider, ThemeProvider, MemoryRouter,
} = compiled.exports

const originalGlobals = { window: globalThis.window, fetch: globalThis.fetch, CustomEvent: globalThis.CustomEvent, localStorage: globalThis.localStorage }
const baseline = { email: 'shop@example.test', phone: '+639661341242' }
beforeEach(() => {
  const storage = new Map()
  const events = new EventTarget()
  globalThis.window = Object.assign(events, {
    location: { origin: 'http://localhost:5173', hostname: 'localhost' },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  })
  globalThis.CustomEvent = class extends Event {
    constructor(type, options) { super(type); this.detail = options?.detail }
  }
  globalThis.localStorage = globalThis.window.localStorage
  publishSiteContact(baseline)
})
afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key]
    else globalThis[key] = value
  }
})

test('saving contacts updates every subscriber and persists settings for other tabs', () => {
  const observed = []
  const unsubscribe = subscribeSiteContact(() => observed.push(getSiteContactSnapshot()))
  const saved = { email: 'updated@example.test', phone: '+639123456789' }
  try {
    publishSiteContact(saved)
    assert.deepEqual(observed, [saved])
    assert.deepEqual(JSON.parse(window.localStorage.getItem(SITE_CONTACT_STORAGE_KEY)), saved)
    const fromOtherTab = { email: 'another@example.test', phone: '+639987654321' }
    window.localStorage.setItem(SITE_CONTACT_STORAGE_KEY, JSON.stringify(fromOtherTab))
    const event = new Event('storage')
    event.key = SITE_CONTACT_STORAGE_KEY
    window.dispatchEvent(event)
    assert.deepEqual(getSiteContactSnapshot(), fromOtherTab)
    assert.deepEqual(observed, [saved, fromOtherTab])
  } finally { unsubscribe() }
})

test('incoming contact events update the shared snapshot when browser storage is blocked', () => {
  const unsubscribe = subscribeSiteContact(() => {})
  window.localStorage.setItem = () => { throw new Error('Storage blocked') }
  const saved = { email: 'live@example.test', phone: '+639123456789' }
  try {
    window.dispatchEvent(new CustomEvent(SITE_CONTACT_UPDATED_EVENT, { detail: saved }))
    assert.deepEqual(getSiteContactSnapshot(), saved)
  } finally { unsubscribe() }
})

test('contact refreshes share one request and cannot overwrite a newer save', async () => {
  let resolveFetch
  let calls = 0
  globalThis.fetch = () => { calls += 1; return new Promise((resolve) => { resolveFetch = resolve }) }
  const first = refreshSiteContact()
  assert.equal(refreshSiteContact(), first)
  await Promise.resolve()
  const saved = { email: 'newest@example.test', phone: '+639123456789' }
  publishSiteContact(saved)
  resolveFetch({ ok: true, json: async () => ({ data: baseline }) })
  assert.deepEqual(await first, saved)
  assert.equal(calls, 1)
  assert.deepEqual(getSiteContactSnapshot(), saved)
})

test('successful refreshes persist settings; failed or malformed responses retain them', async () => {
  const saved = { email: 'database@example.test', phone: '+639123456789' }
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: saved }) })
  assert.deepEqual(await refreshSiteContact(), saved)
  assert.deepEqual(JSON.parse(window.localStorage.getItem(SITE_CONTACT_STORAGE_KEY)), saved)
  globalThis.fetch = async () => { throw new Error('Offline') }
  assert.deepEqual(await refreshSiteContact(), saved)
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: { email: '' } }) })
  assert.deepEqual(await refreshSiteContact(), saved)
})

test('landing contact details, footer and Terms and Conditions use the same saved settings', () => {
  const terms = renderToStaticMarkup(React.createElement(TermsAndConditionsModal, { isOpen: true, onClose() {} }))
  assert.match(terms, /href="mailto:shop@example.test"/)
  assert.doesNotMatch(terms, /cosmosguitars@gmail.com/)
  const landing = renderToStaticMarkup(
    React.createElement(ThemeProvider, {}, React.createElement(MemoryRouter, {}, React.createElement(AuthProvider, {}, React.createElement(LandingPage)))),
  )
  assert.equal(landing.match(/shop@example.test/g)?.length, 2)
  assert.match(landing, /\+63 966 134 1242/)
})
