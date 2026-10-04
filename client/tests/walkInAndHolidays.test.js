import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { getCalendarHolidays, getHolidaysForYear } from '../src/app/utils/philippineHolidays.js'
import { mapDbCartItem } from '../src/app/utils/cartItemMapping.js'

const require = createRequire(import.meta.url)
const serverHolidays = require('../../server/utils/philippineHolidays.js')

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
