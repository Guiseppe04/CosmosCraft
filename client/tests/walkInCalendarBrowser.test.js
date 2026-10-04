import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

// Exercise the actual UI with isolated accounts and API responses, without a database.
test('calendar navigation and customer assignment remain correct across view switches and retries', async () => {
  const fixture = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import AppointmentCalendar from './src/app/components/appointments/AppointmentCalendar.jsx';
      import { WalkInAssignmentPanel } from './src/app/components/customize/WalkInAssignmentPanel.jsx';
      const root = createRoot(document.getElementById('root'));
      window.mountCalendar = () => root.render(<AppointmentCalendar isAdminMode />);
      window.mountAssignment = () => root.render(<WalkInAssignmentPanel
        config={{body:'strat'}} summary={{body:'Strat'}} pricingBreakdown={{base:12000}}
        lineItems={[]} stickers={[]} price={12000} guitarType="electric"
        previewRef={{current:null}} loadingPrices={false} onNewBuild={()=>{}}
      />);
    `, resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'test-auth-and-preview', setup(builder) {
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ contents: `export const useAuth = () => ({ user: {user_id:'admin',role:'admin'} });`, loader: 'js' }))
      builder.onLoad({ filter: /exportMaskedPreview\.js$/ }, () => ({ contents: `export const exportMaskedPreview = async () => 'data:image/png;base64,test';`, loader: 'js' }))
    } }],
  })
  const customer = { user_id: '11111111-1111-4111-8111-111111111111', first_name: 'Selected', last_name: 'Customer', email: 'selected@example.test', role: 'customer', is_active: true, is_verified: true }
  const calls = []
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(fixture.outputFiles[0].text)
    }
    if (req.url.startsWith('/api/users')) return res.end(JSON.stringify({ data: { users: [customer] } }))
    if (req.url === '/api/guitars/walk-in-customizations') {
      let body = ''
      for await (const chunk of req) body += chunk
      calls.push(JSON.parse(body))
      res.statusCode = calls.length === 1 ? 503 : 201
      return res.end(JSON.stringify(calls.length === 1 ? { message: 'Temporary failure' } : { status: 'success' }))
    }
    res.setHeader('Content-Type', 'text/html')
    res.end('<div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ timezoneId: 'Asia/Manila' })
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
    assert.equal(await page.getByRole('button', { name: 'Assign to Customer', exact: true }).isDisabled(), true)
    await page.getByLabel('Select customer account').selectOption(customer.user_id)
    await page.getByLabel('Assigned guitar quantity').fill('2')
    await page.getByRole('button', { name: 'Assign to Customer', exact: true }).click()
    await page.getByText('Temporary failure', { exact: true }).waitFor()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].customer_id, customer.user_id)
    assert.equal(calls[0].quantity, 2)
    assert.equal(await page.getByLabel('Assigned guitar quantity').isDisabled(), true)
    // Refresh before retrying: the request and selected customer must be restored.
    await page.reload()
    await page.evaluate(() => window.mountAssignment())
    await page.getByRole('button', { name: 'Retry Assignment', exact: true }).click()
    await page.getByRole('button', { name: 'Assigned to Customer', exact: true }).waitFor()
    assert.deepEqual(calls[1], calls[0])
    assert.equal(await page.getByRole('button', { name: 'Assigned to Customer', exact: true }).isDisabled(), true)
    await page.reload()
    await page.evaluate(() => window.mountAssignment())
    await page.getByRole('button', { name: 'Assigned to Customer', exact: true }).waitFor()
    assert.equal(calls.length, 2)
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
