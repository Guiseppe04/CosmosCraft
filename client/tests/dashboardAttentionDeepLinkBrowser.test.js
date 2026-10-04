import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

test('dashboard attention items deep-link an orders filter and normal paths reset it', async () => {
  const css = await postcss([tailwindcss({ content: ['./src/app/pages/admin/tabs/DashboardTab.jsx'] }), autoprefixer]).process(
    (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, ''), { from: undefined })
  const fixture = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {DashboardTab} from './src/app/pages/admin/tabs/DashboardTab.jsx';
      const orders=[
        {order_id:'o1',order_number:'ORD-101',first_name:'Jane',last_name:'Doe',total_amount:12000,status:'pending',payment_status:'under_review',created_at:'2026-10-04T00:00:00Z'},
        {order_id:'o2',order_number:'ORD-102',first_name:'Bob',last_name:'Smith',total_amount:5000,status:'pending',payment_status:'pending',created_at:'2026-10-03T00:00:00Z'},
      ];
      const appointments=[{appointment_id:'apt1',service_name:'Guitar setup',customer_name:'Jane Doe',status:'pending',scheduled_at:'2026-10-05T01:30:00Z',created_at:'2026-10-04T00:10:00Z'}];
      const projects=[{project_id:'proj1',status:'on_hold',estimated_completion_date:'2026-10-01',created_at:'2026-10-03T00:00:00Z'}];
      const report={netSales:17000,totalTransactions:2,averagePerTransaction:8500,dailyTrend:[{date:'2026-10-03',net:5000,transactions:1},{date:'2026-10-04',net:12000,transactions:1}]};
      window.tabs=[]; window.payFilters=[]; window.statusFilters=[]; window.aptFilters=[]; window.projFilters=[];
      window.renderDashboard=()=>root.render(<DashboardTab user={{first_name:'Alex'}} salesReport={report} visibleOrders={orders} visibleProjects={projects} visibleAppointments={appointments} inventoryHealthData={{status:'Healthy',value:'90%'}} isLoading={false}
        setActiveTab={tab=>window.tabs.push(tab)}
        setDashboardOrderPaymentFilter={v=>window.payFilters.push(v)}
        setDashboardOrderStatusFilter={v=>window.statusFilters.push(v)}
        setDashboardAppointmentStatusFilter={v=>window.aptFilters.push(v)}
        setProjectStatusFilter={v=>window.projFilters.push(v)} />);
      const root=createRoot(document.getElementById('root'));window.renderDashboard();`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', jsx: 'automatic', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'dashboard-report-fixture', setup(builder) {
      builder.onLoad({ filter: /adminApi\.js$/ }, () => ({ loader: 'js', contents: `export const adminApi={getSalesReport:async()=>({data:null})};` }))
    } }],
  })
  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles[0].text) }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css.css) }
    res.setHeader('Content-Type', 'text/html')
    res.end('<html data-theme="light"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root" style="padding:16px"></div><script src="/bundle.js"></script></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } }), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.clock.install({ time: new Date('2026-10-04T01:00:00Z') })
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('heading', { name: 'Good morning, Alex' }).waitFor()

    // 1. Click "awaiting payment verification" attention item → orders tab with grouped filter.
    await page.getByRole('button', { name: /awaiting payment verification/ }).click()
    await page.waitForFunction(() => window.tabs.includes('orders'))
    assert.deepEqual(await page.evaluate(() => window.tabs.filter(t=>t==='orders').slice(-1)), ['orders'])
    assert.deepEqual(await page.evaluate(() => window.payFilters.at(-1)), 'for_verification')
    assert.deepEqual(await page.evaluate(() => window.statusFilters.at(-1)), 'all')

    // 2. Re-render (as if returning to dashboard) and click "awaiting payment" → pending filter.
    await page.evaluate(() => window.renderDashboard())
    await page.getByRole('button', { name: /^1 order awaiting payment View/ }).click()
    await page.waitForFunction(() => window.payFilters.filter(f=>f!=='all').length >= 2)
    assert.deepEqual(await page.evaluate(() => window.payFilters.at(-1)), 'pending')
    assert.deepEqual(await page.evaluate(() => window.statusFilters.at(-1)), 'all')

    // 3. Generic "Total orders" metric must reset the deep-link filters to all.
    await page.evaluate(() => window.renderDashboard())
    await page.getByRole('region', { name: 'Business snapshot' }).getByRole('button').nth(1).click()
    await page.waitForFunction(() => window.tabs.filter(t=>t==='orders').length >= 3)
    assert.deepEqual(await page.evaluate(() => window.payFilters.at(-1)), 'all')
    assert.deepEqual(await page.evaluate(() => window.statusFilters.at(-1)), 'all')

    // 4. Appointments pending attention item → appointments tab with pending status filter.
    await page.evaluate(() => window.renderDashboard())
    await page.getByRole('button', { name: /appointment? awaiting confirmation/ }).click()
    await page.waitForFunction(() => window.tabs.includes('appointments'))
    assert.deepEqual(await page.evaluate(() => window.aptFilters.at(-1)), 'pending')

    // 5. "projects on hold" attention item → project status filter on_hold.
    await page.evaluate(() => window.renderDashboard())
    await page.getByRole('button', { name: /on hold View Projects/ }).click()
    await page.waitForFunction(() => window.projFilters.includes('on_hold'))
    assert.deepEqual(await page.evaluate(() => window.projFilters.at(-1)), 'on_hold')

    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})