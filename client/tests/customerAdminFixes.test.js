import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeRiderContact } from '../src/app/utils/phone.js'
import { formatContactPhone } from '../src/app/utils/contactDisplay.js'

// Compile the real JSX components in memory for rendering regression checks.
const require = createRequire(import.meta.url)
const componentBundle = await build({
  stdin: { contents: `
    export { SelectableCartItemRow } from './src/app/components/cart/SelectableCartItemRow.jsx';
    export { default as AppointmentCard } from './src/app/components/appointments/AppointmentCard.jsx';
    export { default as CustomBuildThumbnail } from './src/app/components/customize/CustomBuildThumbnail.jsx';
    export { PaymentModal } from './src/app/components/PaymentModal.jsx';
    export { default as PhoneInput } from './src/app/components/PhoneInput.jsx';
    export { useStickerDraft } from './src/app/hooks/useStickerDraft.js';
  `, resolveDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), loader: 'jsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  define: { 'import.meta.env': '{}' },
})
const Module = require('node:module')
const compiled = new Module(fileURLToPath(import.meta.url))
compiled.filename = fileURLToPath(import.meta.url)
compiled.paths = Module._nodeModulePaths(path.dirname(compiled.filename))
compiled._compile(componentBundle.outputFiles[0].text, compiled.filename)
const { SelectableCartItemRow, AppointmentCard, CustomBuildThumbnail, PaymentModal, PhoneInput, useStickerDraft } = compiled.exports
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))

test('zero-stock cart rows disable selection and quantity increase; stocked rows remain selectable', () => {
  const props = { item: { id: 'p', name: 'Guitar', quantity: 1, stock: 0 }, isSelected: true }
  const unavailable = render(SelectableCartItemRow, props)
  assert.match(unavailable, /Out of Stock/)
  assert.match(unavailable, /type="checkbox"[^>]*disabled=""/)
  assert.doesNotMatch(unavailable, /type="checkbox"[^>]*checked=""/)
  assert.match(unavailable, /disabled=""[^>]*aria-label="Increase quantity"/)
  const available = render(SelectableCartItemRow, { ...props, item: { ...props.item, stock: 2 } })
  assert.doesNotMatch(available, /type="checkbox"[^>]*disabled/)
  assert.match(available, /checked=""/)
});

test('customer appointment cards hide cancellation for approved and pickup-ready records', () => {
  const apt = { appointment_id: 'a', status: 'confirmed', payment_status: 'pending', scheduled_at: new Date(Date.now() + 86400000).toISOString(), services: [] }
  assert.match(render(AppointmentCard, { apt }), /Cancel Appointment/)
  for (const patch of [{ payment_status: 'approved' }, { status: 'ready_for_pickup' }, { related_pickup_ready: true }]) {
    assert.doesNotMatch(render(AppointmentCard, { apt: { ...apt, ...patch } }), /Cancel Appointment/)
  }
});

test('payment summary renders saved customization images and generated previews with stickers', () => {
  const saved = { id: 'build', name: 'Saved guitar', quantity: 1, price: 100, customization: { customization_id: 'saved-id', preview_image: 'https://example.test/correct-build.png' } }
  assert.match(render(CustomBuildThumbnail, { item: saved }), /correct-build\.png/)
  const item = { ...saved, customization: { config: {}, stickers: [{ id: 's', src: 'https://example.test/sticker.png', x: 12, y: 34, size: 18, rotation: 45 }] } }
  const fallback = render(CustomBuildThumbnail, { item })
  assert.match(fallback, /sticker\.png/)
  assert.match(fallback, /rotate\(45deg\)/)
  assert.match(render(PaymentModal, { isOpen: true, total: 100, items: [saved] }), /correct-build\.png/)
});

test('contact formatting preserves configured subscriber digits and rider validation stays strict', () => {
  for (const phone of ['09123456789', '+639123456789', '63+9123456789']) assert.equal(formatContactPhone(phone), '+63 912 345 6789')
  assert.equal(formatContactPhone('+095213121581').replace(/\D/g, ''), '6395213121581')
  assert.equal(normalizeRiderContact(' +63 912 345 6789 '), '+639123456789')
  for (const phone of ['abc', '0912-345-6789', '+639123', '+6391234567890']) assert.equal(normalizeRiderContact(phone), null)
});

test('contact inputs show a fixed +63 prefix and ten editable digits for legacy and international values', () => {
  for (const value of ['09661341242', '+639661341242', '9661341242']) {
    const html = render(PhoneInput, { value })
    assert.match(html, />\+63<\/span>/)
    assert.match(html, /maxLength="10"/)
    assert.match(html, /value="9661341242"/)
  }
  assert.match(render(PhoneInput, { value: '', disabled: true }), /disabled=""/)
});

test('returning to a builder restores every sticker property and its selection from the session draft', () => {
  const originalStorage = globalThis.sessionStorage
  const sticker = { id: 's', src: 'data:image/png;base64,test', x: 12, y: 34, size: 18, rotation: 45, side: 'rear', aspectRatio: 2, price: 100 }
  const draft = { stickers: [sticker], selectedStickerId: 's' }
  let restored
  globalThis.sessionStorage = { getItem: () => JSON.stringify(draft) }
  const DraftReader = () => {
    restored = useStickerDraft('test-build')
    return null
  }
  try {
    render(DraftReader, {})
    assert.deepEqual(restored.stickers, [sticker])
    assert.equal(restored.selectedStickerId, 's')
  } finally {
    if (originalStorage === undefined) delete globalThis.sessionStorage
    else globalThis.sessionStorage = originalStorage
  }
});
