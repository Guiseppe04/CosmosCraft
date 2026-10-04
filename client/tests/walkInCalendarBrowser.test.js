import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindConfig from '../tailwind.config.js'

const { assignmentSchema } = createRequire(import.meta.url)('../../server/utils/walkInValidation.js')

// Exercise the actual UI with isolated accounts and API responses, without a database.
test('calendar navigation, saved-only sending and customer checkout work across retries and screen sizes', async () => {
  const stylesheet = await postcss([tailwindcss(tailwindConfig), autoprefixer]).process(
    (await readFile('src/styles/globals.css','utf8')).replace(/^@import.*$/gm,''), {from:'src/styles/globals.css'},
  )
  const fixture = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import AppointmentCalendar from './src/app/components/appointments/AppointmentCalendar.jsx';
      import { WalkInAssignmentPanel } from './src/app/components/customize/WalkInAssignmentPanel.jsx';
      import { createMemoryRouter, RouterProvider } from 'react-router';
      import { CustomizePage } from './src/app/pages/CustomizePage.jsx';
      import { BassCustomizePage } from './src/app/pages/BassCustomizePage.jsx';
      import { DashboardPage } from './src/app/pages/DashboardPage.jsx';
      import { CheckoutPage } from './src/app/pages/CheckoutPage.jsx';
      const root = createRoot(document.getElementById('root'));
      window.mountCalendar = () => root.render(<AppointmentCalendar isAdminMode />);
      window.mountAssignment = () => root.render(<WalkInAssignmentPanel
        config={{body:'strat'}} summary={{body:'Strat'}} pricingBreakdown={{base:12000}}
        lineItems={[]} stickers={[]} price={12000} guitarType="electric"
        previewRef={{current:null}} loadingPrices={false} onNewBuild={()=>{}}
      />);
      window.mountBuilder = (bass) => root.render(<RouterProvider router={createMemoryRouter([
        {path:'*', element: bass ? <BassCustomizePage /> : <CustomizePage />}
      ], {initialEntries:[bass ? '/customize-bass?mode=walk-in' : '/customize?mode=walk-in']})} />);
      window.mountDashboard = () => root.render(<RouterProvider router={createMemoryRouter([
        {path:'/dashboard', element: <DashboardPage />}, {path:'/checkout', element:<CheckoutPage />}
      ], {initialEntries:['/dashboard?section=my-guitar']})} />);
    `, resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent',
    loader: { '.css': 'empty' },
    define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'test-auth-and-preview', setup(builder) {
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ contents: `export const useAuth = () => ({ isAuthenticated:true, user: window.testUser || {id:'admin',user_id:'admin',role:'admin'} });`, loader: 'js' }))
      builder.onLoad({ filter: /CartContext\.jsx$/ }, () => ({ contents: `const cartContext = {cart:[], getTotalPrice:()=>0, getCartCount:()=>0, getSelectedItemIds:()=>[], waitForCartUpdates:async()=>true,refreshCart:async()=>{}}; export const useCart = () => cartContext;`, loader: 'js' }))
      builder.onLoad({ filter: /SocketContext\.jsx$/ }, () => ({ contents: `export const useSocketEvent = () => {};`, loader: 'js' }))
      builder.onLoad({ filter: /exportMaskedPreview\.js$/ }, () => ({ contents: `export const exportMaskedPreview = async () => 'data:image/png;base64,test'; export const downloadPreviewImages = () => {};`, loader: 'js' }))
      builder.onLoad({ filter: /captureBuildViews\.jsx$/ }, () => ({ contents: `export const captureBuildViews = async () => ({front:'data:image/png;base64,front-test',rear:'data:image/png;base64,rear-test'});`, loader: 'js' }))
    } }],
  })
  const customer = { user_id: '11111111-1111-4111-8111-111111111111', first_name: 'Selected', last_name: 'Customer', name:{firstName:'Selected',lastName:'Customer'}, email: 'selected@example.test', role: 'customer', is_active: true, is_verified: true,
    addresses:[{address_id:'33333333-3333-4333-8333-333333333333',street_line1:'123 Test Street',city:'Manila',province:'Metro Manila',postal_code:'1000',country:'PH',is_default:true}] }
  const calls = []
  const delivered = []
  const personalSaves = []
  const cartWrites = []
  const orders = []
  const payments = []
  let customerFetchFailure = false
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(fixture.outputFiles[0].text)
    }
    if (req.url === '/styles.css') {
      res.setHeader('Content-Type','text/css')
      return res.end(stylesheet.css)
    }
    if (req.url.startsWith('/api/guitars/walk-in-customers')) return res.end(JSON.stringify({ data: { users: [customer], hasMore:false } }))
    if (req.url === '/api/guitars/my-customizations') {
      if (req.method !== 'GET') personalSaves.push(req.method)
      if (customerFetchFailure) {
        res.statusCode = 503
        return res.end(JSON.stringify({message:'Build service temporarily unavailable'}))
      }
      return res.end(JSON.stringify({ data: delivered }))
    }
    if (req.url === '/api/guitars/walk-in-customizations') {
      let body = ''
      for await (const chunk of req) body += chunk
      calls.push(JSON.parse(body))
      assert.ifError(assignmentSchema.validate(calls.at(-1), { stripUnknown:true }).error)
      res.statusCode = calls.length === 1 ? 503 : 201
      if (calls.length > 1) {
        const payload = calls.at(-1)
        if (!delivered.some(build => build.customization_id === payload.customization_id)) delivered.push({...payload.design, customization_id:payload.customization_id, user_id:customer.user_id,
          config_json:{...payload.design.config_json, _walkIn:{summary:payload.design.summary,pricingBreakdown:payload.design.pricingBreakdown,lineItems:payload.design.lineItems, customerId:customer.user_id, createdBy:'admin'}},
          created_at:'2026-10-04T12:30:00Z', updated_at:'2026-10-05T01:00:00Z', is_saved:true})
      }
      return res.end(JSON.stringify(calls.length === 1 ? { message: 'Temporary failure' } : { status: 'success' }))
    }
    if (req.url.startsWith('/api/cart') && req.method !== 'GET' && req.url !== '/api/cart/prepare-checkout') cartWrites.push(req.url)
    if (req.url === '/api/cart/prepare-checkout') return res.end(JSON.stringify({data:{cart:{items:[]},checkout_data:{tax_rate:0}}}))
    if (req.url === '/api/orders' || req.url === '/api/payments') {
      let body = ''
      for await (const chunk of req) body += chunk
      const payload = JSON.parse(body)
      if (req.url === '/api/payments') {
        payments.push(payload)
        return res.end(JSON.stringify({status:'success',data:{}}))
      }
      orders.push(payload)
      return res.end(JSON.stringify({data:{order:{order_id:'order',total_amount:payload.items.reduce((total,item)=>total+item.price*item.quantity,0)}}}))
    }
    if (req.url.startsWith('/api/')) return res.end(JSON.stringify({data:[], pagination:{total:0,total_pages:1}}))
    res.setHeader('Content-Type', 'text/html')
    res.end('<link rel="stylesheet" href="/styles.css"><div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ timezoneId: 'Asia/Manila' })
    const renderErrors = []
    page.on('pageerror', error=>renderErrors.push(error.message))
    await page.clock.install({ time: new Date('2026-10-04T09:00:00+08:00') })
    const url = `http://127.0.0.1:${server.address().port}`
    await page.goto(url)
    await page.evaluate(() => window.mountCalendar())
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next month' }).click()
    await page.getByText('January 2027', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '1', exact: true }).getAttribute('title'), "New Year's Day")
    assert.equal(await page.getByRole('button', { name: '1', exact: true }).isDisabled(), true)
    await page.getByRole('button', { name: 'Week', exact: true }).click()
    assert.ok(await page.getByText("New Year's Day", { exact: true }).count())
    await page.getByRole('button', { name: 'Next week' }).click()
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    assert.ok(await page.getByText('January 2027', { exact: true }).count())
    for (const year of [2028, 2029]) {
      for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Next month' }).click()
      assert.ok(await page.getByText(`January ${year}`, { exact: true }).count())
      assert.equal(await page.getByRole('button', { name: '1', exact: true }).isDisabled(), true)
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      assert.ok(await page.getByText("New Year's Day", { exact: true }).count())
      await page.getByRole('button', { name: 'Month', exact: true }).click()
      // The visible week may begin in December; return to January if necessary.
      if (await page.getByText(`December ${year - 1}`, { exact: true }).count()) await page.getByRole('button', { name: 'Next month' }).click()
    }
    await page.evaluate(() => window.mountAssignment())
    assert.equal(await page.getByRole('button', { name: 'Send to Customer', exact: true }).isDisabled(), true)
    await page.getByLabel('Select Selected Customer').click()
    await page.getByRole('button', { name: 'Send to Customer', exact: true }).click()
    await page.getByText('Temporary failure', { exact: true }).waitFor()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].customer_id, customer.user_id)
    assert.equal(calls[0].quantity, 1)
    // Refresh before retrying: the request and selected customer must be restored.
    await page.reload()
    await page.evaluate(() => window.mountAssignment())
    await page.getByRole('button', { name: 'Retry Send', exact: true }).click()
    await page.getByRole('button', { name: 'Sent to Customer', exact: true }).waitFor()
    assert.deepEqual(calls[1], calls[0])
    assert.equal(await page.getByRole('button', { name: 'Sent to Customer', exact: true }).isDisabled(), true)
    await page.reload()
    await page.evaluate(() => window.mountAssignment())
    await page.getByRole('button', { name: 'Sent to Customer', exact: true }).waitFor()
    assert.equal(calls.length, 2)

    // Saving an admin project must bypass the personal build limit and storage.
    for (const bass of [false, true]) {
      await page.reload()
      const originalBuilds = Array.from({length:10}, (_,i) => ({id:'existing-'+i, config:{body:'strat'}, price:100}))
      await page.evaluate(({bass, originalBuilds}) => {
        localStorage.setItem('cosmoscraft_saved_builds', JSON.stringify(originalBuilds))
        localStorage.setItem('cosmoscraft_saved_bass_builds', '[]')
        window.mountBuilder(bass)
      }, {bass, originalBuilds})
      await page.getByRole('button', {name:'Save Build', exact:true}).click()
      await page.getByRole('dialog').waitFor()
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cosmoscraft_saved_builds'))), originalBuilds)
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cosmoscraft_saved_bass_builds'))), [])
      await page.getByLabel('Select Selected Customer').click()
      await page.getByRole('button', {name:'Send to Customer', exact:true}).click()
      await page.getByRole('dialog').waitFor({state:'detached'})
      assert.equal(calls.at(-1).design.guitar_type, bass ? 'bass' : 'electric')
    }
    assert.deepEqual(personalSaves, [])

    // A customer's clean browser imports delivered electric and bass designs.
    await page.reload()
    await page.evaluate(customer => {
      localStorage.removeItem('cosmoscraft_saved_builds')
      localStorage.removeItem('cosmoscraft_saved_bass_builds')
      window.testUser = {...customer, id:customer.user_id}
      window.mountDashboard()
    }, customer)
    await page.getByRole('button', {name:'Saved Builds', exact:true}).click()
    await page.getByText('My Saved Builds', {exact:true}).waitFor()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cosmoscraft_saved_bass_builds') || '[]').length === 1)
    const imported = await page.evaluate(() => [...JSON.parse(localStorage.getItem('cosmoscraft_saved_builds')), ...JSON.parse(localStorage.getItem('cosmoscraft_saved_bass_builds'))])
    assert.deepEqual(new Set(imported.map(build => build.dbCustomizationId)), new Set(delivered.map(build => build.customization_id)))
    assert.equal(await page.getByRole('button',{name:'Add Parts',exact:true}).count(),0)
    assert.ok(await page.getByText('Oct 4, 2026 • 8:30 PM',{exact:true}).count())
    assert.deepEqual(cartWrites,[])

    const firstBuild = imported[0]
    const previewButton = page.getByRole('button',{name:`View ${firstBuild.name} preview`,exact:true}).first()
    const card = previewButton.locator('xpath=../..')
    for (const width of [1280,390]) {
      await page.setViewportSize({width,height:844})
      assert.equal(await card.evaluate(el=>el.scrollWidth <= el.clientWidth),true)
    }
    await previewButton.click()
    await page.getByRole('dialog',{name:`${firstBuild.name} preview`,exact:true}).waitFor()
    assert.equal(await page.getByRole('dialog').locator('img').first().getAttribute('src'), firstBuild.preview_image)
    assert.equal(await page.getByRole('dialog').locator('img').first().evaluate(el=>getComputedStyle(el).objectFit),'contain')
    const previewBounds = await page.getByRole('dialog').boundingBox()
    assert.ok(previewBounds.width <= 390 && previewBounds.height <= 844 * 0.9 + 1)
    await page.keyboard.press('Escape')
    await page.clock.runFor(50)
    await page.getByRole('dialog').waitFor({state:'detached'})
    await previewButton.click()
    await page.getByRole('button',{name:'Close build preview',exact:true}).click()
    await page.getByRole('dialog').waitFor({state:'detached'})
    await previewButton.click()
    await page.locator('[data-build-preview-backdrop]').click({position:{x:1,y:1}})
    await page.getByRole('dialog').waitFor({state:'detached'})

    // Review and explicitly buy an admin-sent design through existing checkout.
    await card.getByRole('button',{name:'View Summary',exact:true}).click()
    await page.getByRole('heading',{name:`${firstBuild.name} Summary`,exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Add Parts',exact:true}).count(),0)
    await page.getByRole('button',{name:'Buy Now',exact:true}).last().click()
    await page.getByRole('heading',{name:'Checkout',exact:true}).waitFor()
    await page.getByRole('button',{name:`View ${firstBuild.name} front and rear preview`,exact:true}).click()
    await page.getByRole('button',{name:/^rear$/i}).click()
    assert.equal(await page.getByRole('button',{name:/^rear$/i}).getAttribute('aria-pressed'),'true')
    await page.getByRole('button',{name:'Close build preview',exact:true}).click()
    await page.getByRole('dialog').waitFor({state:'detached'})
    const buildDetails = page.locator('details').filter({has:page.locator('summary').filter({hasText:'View build details'})}).first()
    assert.equal(await buildDetails.getAttribute('open'),null)
    await page.getByText('View build details',{exact:true}).click()
    await page.getByText(/^Body \(/).click()
    assert.ok(await page.getByText('Body Wood',{exact:true}).count())
    const orderSummary = page.getByRole('heading',{name:'Order Summary',exact:true}).locator('xpath=../..')
    for (const width of [1280,390]) {
      await page.setViewportSize({width,height:844})
      assert.equal(await orderSummary.evaluate(el=>el.scrollWidth <= el.clientWidth),true)
      assert.equal(await page.getByText('Total Amount',{exact:true}).evaluate(el=>{
        for (let node=el.parentElement;node;node=node.parentElement) {
          if (node.querySelector('h2')?.textContent==='Order Summary') break
          if (getComputedStyle(node).overflowY==='auto') return false
        }
        return true
      }),true)
    }
    await page.getByRole('checkbox',{name:'I have read and agree to the Terms and Conditions.'}).check()
    await page.getByRole('button',{name:'Continue to Down Payment',exact:true}).click()
    await page.locator('input[type=file]').setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')})
    await page.getByRole('button',{name:/^Pay Down Payment/}).click()
    await page.getByRole('heading',{name:'Order Placed!',exact:true}).waitFor()
    assert.equal(orders.length,1)
    assert.equal(orders[0].items[0].customization.customizationId,firstBuild.dbCustomizationId)
    assert.equal(orders[0].items[0].price,firstBuild.price)
    assert.equal(payments[0].amount,firstBuild.price * 0.5)
    assert.deepEqual(cartWrites,[])

    // Delivered designs stay visible when the account only has user_id and
    // local caching fails (e.g. quota exceeded or browser storage restricted).
    await page.reload()
    await page.evaluate(customer => {
      localStorage.removeItem('cosmoscraft_saved_builds')
      localStorage.removeItem('cosmoscraft_saved_bass_builds')
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = function(key, value) {
        if (key === 'cosmoscraft_saved_builds' || key === 'cosmoscraft_saved_bass_builds') throw new DOMException('Storage full', 'QuotaExceededError')
        return originalSetItem.call(this, key, value)
      }
      window.testUser = customer
      window.mountDashboard()
    }, customer)
    await page.getByRole('button', {name:'View received builds',exact:true}).click()
    for (const name of new Set(delivered.map(build=>build.name))) {
      assert.ok(await page.getByRole('heading',{name,exact:true}).count())
    }
    assert.equal(await page.evaluate(()=>localStorage.getItem('cosmoscraft_saved_builds')),null)
    assert.equal(await page.evaluate(()=>localStorage.getItem('cosmoscraft_saved_bass_builds')),null)

    // Customer retrieval errors are visible and retryable.
    customerFetchFailure = true
    await page.reload()
    await page.evaluate(customer => {
      window.testUser = {...customer,id:customer.user_id}
      window.mountDashboard()
    },customer)
    await page.getByRole('alert').filter({hasText:'Build service temporarily unavailable'}).waitFor()
    customerFetchFailure = false
    await page.getByRole('button',{name:'Retry loading builds',exact:true}).click()
    await page.getByRole('button',{name:'View received builds',exact:true}).waitFor()
    assert.equal(await page.getByRole('alert').filter({hasText:'Build service temporarily unavailable'}).count(),0)
    assert.deepEqual(renderErrors,[])
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
