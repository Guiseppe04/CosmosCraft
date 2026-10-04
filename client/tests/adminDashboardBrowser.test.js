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

test('dashboard reference layout preserves live figures, navigation and mobile fit', async () => {
  const css = await postcss([tailwindcss({ content: ['./src/app/pages/admin/tabs/DashboardTab.jsx'] }), autoprefixer]).process(
    (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, ''), { from: undefined })
  const fixture = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {DashboardTab} from './src/app/pages/admin/tabs/DashboardTab.jsx';
      const orders=[{order_id:'order',order_number:'ORD-101',first_name:'Jane',last_name:'Doe',total_amount:12000,status:'pending',payment_status:'under_review',created_at:'2026-10-04T00:00:00Z'}];
      const appointments=[{appointment_id:'appointment',service_name:'Guitar setup',customer_name:'Jane Doe',status:'pending',scheduled_at:'2026-10-05T01:30:00Z',created_at:'2026-10-04T00:10:00Z'}];
      const projects=[{project_id:'project',status:'in_progress',estimated_completion_date:'2026-10-01',created_at:'2026-10-03T00:00:00Z'}];
      const report={netSales:12000,totalTransactions:1,averagePerTransaction:12000,dailyTrend:[{date:'2026-10-03',net:2000,transactions:1},{date:'2026-10-04',net:10000,transactions:2}]};
      window.tabs=[]; window.reportRequests=[]; window.dashboardReport=report; window.renderDashboard=(loading=false,empty=false)=>root.render(<DashboardTab user={{first_name:'Alex'}} salesReport={empty?{netSales:0,totalTransactions:0,dailyTrend:[]}:report} visibleOrders={empty?[]:orders} visibleProjects={empty?[]:projects} visibleAppointments={empty?[]:appointments} inventoryHealthData={{status:'Healthy',value:'90%'}} isLoading={loading} setActiveTab={tab=>window.tabs.push(tab)} />);
      const root=createRoot(document.getElementById('root'));window.renderDashboard();`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', jsx: 'automatic', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'dashboard-report-fixture', setup(builder) {
      builder.onLoad({ filter: /adminApi\.js$/ }, () => ({ loader: 'js', contents: `export const adminApi={getSalesReport:async params=>{window.reportRequests.push(params);return {data:window.dashboardReport}}};` }))
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.clock.install({ time: new Date('2026-10-04T01:00:00Z') })
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('heading', { name: 'Good morning, Alex' }).waitFor()
    const snapshot = page.getByRole('region', { name: 'Business snapshot' })
    assert.equal(await snapshot.getByRole('button').count(), 4)
    assert.equal(await snapshot.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 4)
    await snapshot.getByText('₱12,000.00', { exact: true }).first().waitFor()
    await page.getByRole('button', { name: '7 days', exact: true }).click()
    await page.waitForFunction(() => window.reportRequests.some(params => params.start_date === '2026-09-28' && params.end_date === '2026-10-04'))
    await page.getByRole('button', { name: '90 days', exact: true }).click()
    await page.waitForFunction(() => window.reportRequests.some(params => params.start_date === '2026-07-07' && params.end_date === '2026-10-04'))
    assert.equal(await page.getByRole('button', { name: /Export|Create new order/ }).count(), 0)
    await page.getByRole('button', { name: 'Transactions', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Transactions', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'View detailed report' }).click()
    await page.getByRole('button', { name: 'ORD-101', exact: true }).click()
    await page.getByRole('button', { name: 'View appointment calendar' }).click()
    assert.deepEqual(await page.evaluate(() => window.tabs), ['sales-report','orders','appointments'])
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await page.evaluate(() => window.renderDashboard(true))
    await page.locator('.animate-pulse').first().waitFor()
    await page.evaluate(() => window.renderDashboard(false,true))
    await page.getByText('No recent orders.', { exact: true }).waitFor()
    await page.getByText('No upcoming appointments.', { exact: true }).waitFor()
    await page.getByText('No recent activity.', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
