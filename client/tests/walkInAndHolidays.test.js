import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { getCalendarHolidays, getHolidaysForYear } from '../src/app/utils/philippineHolidays.js'
import { mapDbCartItem } from '../src/app/utils/cartItemMapping.js'
import { mergeWalkInSavedBuilds, readSavedBuilds } from '../src/app/utils/walkInSavedBuilds.js'
import { getBuildCreatedAt, formatBuildCreatedAt } from '../src/app/utils/buildCreatedAt.js'
import { getCustomBuildDetailGroups } from '../src/app/utils/customBuildSummary.js'

const require = createRequire(import.meta.url)
const serverHolidays = require('../../server/utils/philippineHolidays.js')

test('creation dates use the database creation time rather than later edits', () => {
  const saved = {savedAt:'2026-10-05T01:00:00Z',created_at:'2026-10-04T12:30:00Z'}
  assert.equal(formatBuildCreatedAt(saved),'Oct 4, 2026 • 8:30 PM')
  assert.equal(getBuildCreatedAt(saved,{created_at:'2026-10-03T12:30:00Z'}),'2026-10-03T12:30:00Z')
  assert.equal(getBuildCreatedAt({savedAt:saved.savedAt}),saved.savedAt)
  for (const value of [undefined,'invalid']) assert.equal(formatBuildCreatedAt({savedAt:value}),'Date unavailable')
})

test('grouped details preserve every component and its price without changing the build', () => {
  const lineItems = [
    {id:'base',category:'Base',name:'Starting Price',subtotal:12000},
    {id:'bodyWood',category:'Body Wood',name:'Mahogany',subtotal:1500},
    {id:'frets',category:'Frets',name:'24 Stainless Steel',subtotal:500},
    {id:'pickups',category:'Pickups',name:'Humbucker',subtotal:1000},
    {id:'bridge',category:'Bridge',name:'Fixed Bridge',subtotal:500},
    {id:'finishColor',category:'Finish Color',name:'Midnight Blue',subtotal:300},
    {id:'other',category:'Special Component',name:'Custom Selection',subtotal:700},
  ]
  const build = {lineItems,price:16500,additionalParts:[{name:'Legacy Strap',price:500,quantity:2}],stickers:[{src:'/design.png'}]}
  const original = structuredClone(build)
  const groups = getCustomBuildDetailGroups(build)
  assert.deepEqual(groups.map(group=>group.label),['Guitar Build','Body','Neck','Electronics','Hardware','Finish / Design','Other Components','Additional Parts'])
  for (const line of lineItems) {
    const displayed = groups.flatMap(group=>group.items).find(item=>item.id===line.id)
    assert.equal(displayed.name,line.name)
    assert.equal(displayed.subtotal,line.subtotal)
  }
  assert.equal(groups.find(group=>group.label==='Additional Parts').items[0].subtotal,1000)
  assert.deepEqual(build,original)
  const legacy = getCustomBuildDetailGroups({config:{bassType:'jazz',frets:24,multiscale:false},summary:{body:'Jazz Bass'}})
  assert.equal(legacy.find(group=>group.label==='Body').items[0].name,'Jazz Bass')
  assert.equal(legacy.find(group=>group.label==='Neck').items.find(item=>item.id==='frets').name,'24')
  assert.equal(legacy.find(group=>group.label==='Guitar Build').items.find(item=>item.id==='multiscale').name,'No')
})

test('saved build cache reads tolerate missing, malformed and restricted browser storage', () => {
  for (const value of [null, '{invalid', '{}']) assert.deepEqual(readSavedBuilds({getItem:()=>value},'builds'),[])
  assert.deepEqual(readSavedBuilds({getItem:()=>{throw new Error('Storage unavailable')}},'builds'),[])
  assert.deepEqual(readSavedBuilds({getItem:()=>JSON.stringify([{id:'build'}])},'builds'),[{id:'build'}])
})

test('received walk-in builds sync on a clean browser with customer ownership and stable identities', () => {
  const config = { body: 'strat', _walkIn: { customerId: 'customer', summary: { body: 'Strat' }, pricingBreakdown: { base: 12000 }, lineItems: [] } }
  const build = { customization_id: 'received', user_id: 'customer', guitar_type: 'electric', total_price: '12000.00', config_json: config, stickers: [{ id: 'sticker', src: '/sticker.png' }], preview_image: '/preview.png', updated_at: '2026-10-04', name: 'Strat build', is_saved: true }
  const received = mergeWalkInSavedBuilds([], [build], 'customer', 'electric')
  assert.equal(received.length, 1)
  assert.equal(received[0].price, 12000)
  assert.equal(received[0].dbCustomizationId, build.customization_id)
  assert.deepEqual(received[0].config, config)
  assert.deepEqual(received[0].stickers, build.stickers)
  assert.deepEqual(received[0].summary, config._walkIn.summary)
  const existing = { ...received[0], id: 'local-id', additionalParts: [{ id: 'part' }] }
  const refreshed = mergeWalkInSavedBuilds([existing], [{ ...build, config_json: JSON.stringify(config) }], 'customer', 'electric')
  assert.equal(refreshed.length, 1)
  assert.equal(refreshed[0].id, 'local-id')
  assert.deepEqual(refreshed[0].additionalParts, existing.additionalParts)
  assert.deepEqual(mergeWalkInSavedBuilds([], [build], 'other-customer', 'electric'), [])
  assert.deepEqual(mergeWalkInSavedBuilds(received, [], 'other-customer', 'electric'), [])
  assert.deepEqual(mergeWalkInSavedBuilds(received, [], 'customer', 'electric'), [])
  assert.deepEqual(mergeWalkInSavedBuilds([], [build], 'customer', 'bass'), [])
  const personal = { id: 'personal', config: {} }
  assert.deepEqual(mergeWalkInSavedBuilds([personal], [], 'customer', 'electric'), [personal])
})

test('month and week closure data agrees with server in past, future and leap years', () => {
  for (const year of [2025, 2026, 2027, 2028, 2029, 2030]) {
    assert.deepEqual(getHolidaysForYear(year), serverHolidays.getHolidaysForYear(year))
    const month = getCalendarHolidays([year])
    const week = getCalendarHolidays([year - 1, year])
    for (const date of Object.keys(getHolidaysForYear(year))) {
      assert.ok(month.closedDates.has(date))
      assert.ok(week.closedDates.has(date))
      assert.equal(month.labels[date], week.labels[date])
    }
  }
  const crossYear = getCalendarHolidays([2026, 2027], ['2026-01-01'])
  assert.ok(crossYear.closedDates.has('2027-01-01'))
  const reopened = getCalendarHolidays([2027], [], ['2027-01-01'])
  assert.equal(reopened.closedDates.has('2027-01-01'), false)
  assert.ok(reopened.labels['2027-01-01'])
})

test('database custom cart mapping preserves identity, price, quantity, preview and design', () => {
  const config = { body: 'strat', finishColor: '#112233', _walkIn: {
    summary: { body: 'Strat' }, pricingBreakdown: { base: 1000, body: 500 },
    lineItems: [{ id: 'body', name: 'Strat', subtotal: 500 }],
  } }
  const item = mapDbCartItem({ cart_item_id: 17, quantity: 2, unit_price: 1500,
    customization: { customization_id: 'customer-build', config_json: config,
      name: 'Walk-in design', stickers: [{ src: '/sticker.png' }], preview_image: '/preview.png' },
  })
  assert.equal(item.id, 'customer-build')
  assert.equal(item.cart_item_id, 17)
  assert.equal(item.quantity, 2)
  assert.equal(item.price, 1500)
  assert.equal(item.stock, undefined)
  assert.equal(item.type, 'customization')
  assert.equal(item.image, '/preview.png')
  assert.deepEqual(item.customization.config, config)
  assert.deepEqual(item.customization.lineItems, config._walkIn.lineItems)
  assert.deepEqual(item.customization.summary, config._walkIn.summary)
  assert.deepEqual(item.customization.stickers, [{ src: '/sticker.png' }])
})

test('regular product mapping retains existing stock and cart behavior', () => {
  assert.deepEqual(mapDbCartItem({ cart_item_id: 3, unit_price: 500, quantity: 1,
    product: { product_id: 'product', name: 'Strings', stock: 8, image: '/strings.png' } }), {
    id: 'product', cart_item_id: 3, name: 'Strings', price: 500,
    quantity: 1, stock: 8, image: '/strings.png', type: 'product',
  })
})
