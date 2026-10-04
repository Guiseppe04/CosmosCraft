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
    export * from './src/app/utils/branchSettings.js';
    export { AddressForm } from './src/app/components/AddressForm.jsx';
    export { BranchAddressSettings } from './src/app/pages/admin/components/settings/BranchAddressSettings.jsx';
    export { SettingsTab } from './src/app/pages/admin/tabs/SettingsTab.jsx';
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
  DEFAULT_APPOINTMENT_BRANCH, BRANCH_SETTINGS_STORAGE_KEY,
  getBranchSettingsSnapshot, publishBranchSettings, refreshBranchSettings, subscribeBranchSettings,
  AddressForm, BranchAddressSettings, SettingsTab,
} = compiled.exports

const originalGlobals = { window: globalThis.window, fetch: globalThis.fetch }
beforeEach(() => {
  const storage = new Map()
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  })
  publishBranchSettings(DEFAULT_APPOINTMENT_BRANCH)
})
afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key]
    else globalThis[key] = value
  }
})
const saved = {
  ...DEFAULT_APPOINTMENT_BRANCH,
  address: '123 Example Street, Borol, Balagtas, Bulacan 3016, Philippines',
  address_details: { country: 'PH', streetLine1: '123 Example Street', city: 'Balagtas', stateProvince: 'Bulacan', barangay: 'Borol', postalZipCode: '3016' },
}
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))

test('branch form keeps the customer layout while hiding address labels and default options', () => {
  const html = render(AddressForm, { initialAddress: saved.address_details, showCategory: false, showDefault: false, onSubmit() {}, submitLabel: 'Save Branch Address' })
  for (const field of ['Country', 'Street Address 1', 'Street Address 2', 'Province', 'City / Municipality', 'Barangay', 'Postal Code', 'Save Branch Address']) assert.ok(html.includes(field), field)
  assert.doesNotMatch(html, /Address Label|>Home<|>Work<|>Other<|Set as default address/)
  const customer = render(AddressForm, { onSubmit() {} })
  assert.match(customer, /Address Label/)
  assert.match(customer, />Home</)
  assert.match(customer, />Work</)
  assert.match(customer, /Set as default address/)
})

test('database settings override stale browser-only branch addresses and remain editable', async () => {
  window.localStorage.setItem('cosmoscraft.appointment.branch', JSON.stringify({ address: 'Stale browser address' }))
  globalThis.fetch = async (url) => {
    assert.ok(url.endsWith('/api/branch/settings'))
    return { ok: true, json: async () => ({ data: saved }) }
  }
  await refreshBranchSettings()
  assert.deepEqual(getBranchSettingsSnapshot().branch, saved)
  assert.deepEqual(JSON.parse(window.localStorage.getItem(BRANCH_SETTINGS_STORAGE_KEY)), saved)
  const html = render(BranchAddressSettings, {})
  assert.ok(html.includes(saved.address))
  assert.match(html, /Edit Branch Address/)
  assert.doesNotMatch(html, /Stale browser address/)
})

test('saved branch changes reach all consumers and other tabs', () => {
  const first = [], second = []
  const unsubscribe = [subscribeBranchSettings(() => first.push(getBranchSettingsSnapshot().branch)), subscribeBranchSettings(() => second.push(getBranchSettingsSnapshot().branch))]
  try {
    publishBranchSettings(saved)
    assert.deepEqual(first, [saved])
    assert.deepEqual(second, [saved])
    const updated = { ...saved, address: 'Another shared address' }
    window.localStorage.setItem(BRANCH_SETTINGS_STORAGE_KEY, JSON.stringify(updated))
    const event = new Event('storage')
    event.key = BRANCH_SETTINGS_STORAGE_KEY
    window.dispatchEvent(event)
    assert.deepEqual(getBranchSettingsSnapshot().branch, updated)
    assert.deepEqual(first.at(-1), updated)
    assert.deepEqual(second.at(-1), updated)
  } finally { unsubscribe.forEach((remove) => remove()) }
})

test('a late database response cannot replace a newer saved address', async () => {
  let resolveFetch
  globalThis.fetch = () => new Promise((resolve) => { resolveFetch = resolve })
  const pending = refreshBranchSettings()
  assert.equal(refreshBranchSettings(), pending)
  await Promise.resolve()
  publishBranchSettings(saved)
  resolveFetch({ ok: true, json: async () => ({ data: DEFAULT_APPOINTMENT_BRANCH }) })
  await pending
  assert.deepEqual(getBranchSettingsSnapshot().branch, saved)
  assert.equal(getBranchSettingsSnapshot().error, null)
})

test('failed loading retains saved settings, displays an error and allows retry', async () => {
  publishBranchSettings(saved)
  globalThis.fetch = async () => { throw new Error('Connection unavailable') }
  await refreshBranchSettings()
  assert.deepEqual(getBranchSettingsSnapshot().branch, saved)
  assert.equal(getBranchSettingsSnapshot().isLoading, false)
  const html = render(BranchAddressSettings, {})
  assert.match(html, /Connection unavailable/)
  assert.match(html, /Retry/)
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: saved }) })
  await refreshBranchSettings()
  assert.equal(getBranchSettingsSnapshot().error, null)
})

test('settings search filters cards and preserves permission restrictions', () => {
  const props = { user: { email: 'admin@example.test' }, isSuperAdmin: true, siteContactInfo: { email: 'shop@example.test', phone: '+639661341242' } }
  const contact = render(SettingsTab, { ...props, searchQuery: ' PHONE ' })
  assert.match(contact, /Site contact information/)
  assert.match(contact, /shop@example.test/)
  assert.doesNotMatch(contact, /Appointment branch|Your account|General settings/)
  const branch = render(SettingsTab, { ...props, searchQuery: 'branch' })
  assert.match(branch, /Appointment branch/)
  assert.doesNotMatch(branch, /Site contact information/)
  const restricted = render(SettingsTab, { ...props, isSuperAdmin: false, searchQuery: 'phone' })
  assert.match(restricted, /No settings found/)
  assert.doesNotMatch(restricted, /shop@example.test/)
  const all = render(SettingsTab, { ...props, searchQuery: '' })
  for (const section of ['Your account', 'Site contact information', 'Appointment branch', 'General settings', 'Audit logs', 'System information']) assert.ok(all.includes(section), section)
})
