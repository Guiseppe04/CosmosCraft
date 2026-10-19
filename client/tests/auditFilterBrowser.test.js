import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

test('audit records load only on apply; pagination keeps applied filters; reset cancels stale responses', async () => {
  const bundle = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {AuditLogsSection} from './src/app/pages/admin/components/settings/AuditLogsSection.jsx';
      createRoot(document.getElementById('root')).render(<React.StrictMode><AuditLogsSection /></React.StrictMode>);`, resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', define: { 'import.meta.env': '{}' },
  })
  const requests = []
  const details = []
  let metadataRequests = 0
  const log = { audit_id: '1', entity_type: 'order', action: 'UPDATE', created_at: '2026-10-01T10:00:00Z',
    user_name: 'Admin Actor', context: { source_table: 'orders' }, changes: { status: { from: 'pending', to: 'completed' } },
    display: { title: 'Order: Updated', module: 'Orders', description: 'ORDER-100 changed from Pending to Completed.' } }
  let delay = 0
  let fail = false
  const server = createServer(async (req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(bundle.outputFiles[0].text) }
    if (req.url.startsWith('/api/audit-logs')) {
      res.setHeader('Content-Type', 'application/json')
      if (req.url.startsWith('/api/audit-logs/actions')) {
        metadataRequests++
        const module = new URL(req.url, 'http://localhost').searchParams.get('entity_type')
        return res.end(JSON.stringify({ data: module === 'order' ? ['UPDATE'] : module === 'payment' ? ['VERIFY'] : ['UPDATE', 'DELETE', 'VERIFY'] }))
      }
      if (req.url === '/api/audit-logs/1') { details.push(req.url); return res.end(JSON.stringify({ data: log })) }
      requests.push(new URL(req.url, 'http://localhost').searchParams)
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      if (fail) { res.statusCode = 500; return res.end(JSON.stringify({ message: 'Audit query failed' })) }
      if (requests.at(-1).get('search') === 'empty-results') return res.end(JSON.stringify({ data: [], pagination: { total: 0 } }))
      return res.end(JSON.stringify({ data: [log], pagination: { total: 60 } }))
    }
    res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    const openFilters = async () => {
      const toggle = page.getByRole('button', { name: 'Filters', exact: true })
      if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
    }
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await expect(page.getByText('Select your filters to view audit records.')).toBeVisible()
    await openFilters()
    await page.getByLabel('Module', { exact: true }).selectOption('order')
    await page.getByLabel('Action', { exact: true }).selectOption('UPDATE')
    await expect(page.getByLabel('Action', { exact: true }).locator('option')).toHaveText(['All Actions', 'Updated'])
    await page.getByLabel('Start date').fill('2026-10-01')
    await page.getByLabel('End date').fill('2026-10-02')
    await page.getByLabel('Search audit history').fill('ORDER-100')
    await page.waitForTimeout(450)
    assert.equal(requests.length, 0)
    assert.equal(metadataRequests, 2)
    assert.equal(await page.locator('table').count(), 0)
    await openFilters()
    await page.getByRole('button', { name: 'Apply Filters', exact: true }).click()
    await expect(page.getByText('ORDER-100 changed from Pending to Completed.')).toBeVisible()
    assert.equal(requests.length, 1); assert.equal(requests[0].get('entity_type'), 'order')
    assert.equal(requests[0].get('action'), 'UPDATE'); assert.ok(requests[0].get('start_date'))
    assert.equal(details.length, 0)
    await openFilters()
    await page.getByLabel('Module', { exact: true }).selectOption('payment')
    await expect(page.getByLabel('Action', { exact: true })).toHaveValue('all')
    await expect(page.getByLabel('Action', { exact: true }).locator('option')).toHaveCount(2)
    assert.deepEqual(await page.getByLabel('Action', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value)), ['all', 'VERIFY'])
    await page.getByLabel('Search audit history').fill('unapplied')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Page 2 of 3 (60 matching records)')).toBeVisible()
    assert.equal(requests.length, 2); assert.equal(requests[1].get('entity_type'), 'order')
    assert.equal(requests[1].get('search'), 'ORDER-100'); assert.equal(requests[1].get('offset'), '25')
    await page.getByLabel('View activity details').click()
    await expect(page.getByRole('dialog')).toBeVisible(); assert.equal(details.length, 1)
    await page.getByLabel('Close details').click()
    fail = true
    await openFilters()
    await page.getByRole('button', { name: 'Apply Filters', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Audit query failed')
    fail = false; delay = 300
    await openFilters()
    await page.getByRole('button', { name: 'Apply Filters', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Apply Filters', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Reset Filters', exact: true }).click()
    await openFilters()
    await expect(page.getByLabel('Action', { exact: true }).locator('option')).toHaveCount(4)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveAttribute('aria-expanded', 'false')
    await page.waitForTimeout(400)
    await expect(page.getByText('Select your filters to view audit records.')).toBeVisible()
    assert.equal(await page.locator('table').count(), 0); assert.equal(requests.length, 4)
    delay = 0
    await page.getByLabel('Search audit history').fill('empty-results')
    await openFilters()
    await page.getByRole('button', { name: 'Apply Filters', exact: true }).click()
    await expect(page.getByText('No audit records match the applied filters.')).toBeVisible()
    assert.equal(requests.length, 5)
    await page.getByLabel('Search audit history').fill('ORDER-100')
    await openFilters()
    await page.getByRole('button', { name: 'Apply Filters', exact: true }).click()
    await expect(page.locator('table')).toBeVisible()
    await page.getByLabel('Records per page').selectOption('50')
    await expect(page.getByText('Page 1 of 2 (60 matching records)')).toBeVisible()
    assert.equal(requests.length, 7); assert.equal(requests[6].get('limit'), '50')
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
