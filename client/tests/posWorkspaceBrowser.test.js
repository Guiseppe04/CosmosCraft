import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

test('staff POS supports void/return, pagination, filters and cash checkout', async () => {
  const css = await postcss([tailwindcss({ content: ['./src/app/components/pos/PosWorkspace.jsx', './src/app/pages/admin/components/shared/PaginationBar.jsx'] }), autoprefixer]).process(
    (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, ''), { from: undefined })
  const fixture = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {PosWorkspace} from './src/app/components/pos/PosWorkspace.jsx';
      const inventory=[{product_id:'strings',name:'Guitar Strings',price:500,stock:6},
        ...Array.from({length:5},(_,index)=>({product_id:'part-'+index,name:'Guitar Part '+index,price:100,stock:4}))];
      createRoot(document.getElementById('root')).render(<PosWorkspace inventoryItems={inventory} />);`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'isolated-pos', setup(builder) {
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ loader: 'js', contents: `export const useAuth=()=>({user:{role:'staff'}});` }))
      builder.onLoad({ filter: /SocketContext\.jsx$/ }, () => ({ loader: 'js', contents: `export const useSocketEvent=()=>{}; export const useSocket=()=>({socket:null,isConnected:false});` }))
      builder.onLoad({ filter: /apiConfig\.js$/ }, () => ({ loader: 'js', contents: `export const API=window.location.origin; export const getAuthHeaders=()=>({});` }))
    } }],
  })
  const requests = [], sales = [], adjustments = [], saleStatuses = new Map()
  const server = createServer(async (req, res) => {
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css.css) }
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles[0].text) }
    res.setHeader('Content-Type', 'application/json')
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/api/pos/reports/daily-summary') return res.end(JSON.stringify({ data: { total_sales: 6000, total_transactions: 12 } }))
    if (url.pathname === '/api/pos/sales' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk
      sales.push(JSON.parse(body)); return res.end(JSON.stringify({ data: { sale_number: 'POS-NEW' } }))
    }
    const adjustment = url.pathname.match(/^\/api\/pos\/sales\/([^/]+)\/(void|return)$/)
    if (adjustment && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk
      const [, saleId, action] = adjustment
      adjustments.push({ saleId, action, body: JSON.parse(body) })
      saleStatuses.set(saleId, action === 'void' ? 'voided' : 'returned')
      return res.end(JSON.stringify({ status: 'success' }))
    }
    const saleDetail = url.pathname.match(/^\/api\/pos\/sales\/(sale-\d+)$/)
    if (saleDetail) {
      const saleId = saleDetail[1]
      return res.end(JSON.stringify({ data: {
        sale_id: saleId, sale_number: `POS-${Number(saleId.slice(5)) + 1}`, created_at: '2026-10-04T08:00:00Z',
        total_amount: 500, subtotal: 500, status: saleStatuses.get(saleId) || 'completed', payment_method: 'cash',
        items: [{ item_id: 'item-1', product_id: 'strings', item_name: 'Guitar Strings', quantity: 1, subtotal: 500 }],
      } }))
    }
    if (url.pathname === '/api/pos/sales') {
      requests.push(Object.fromEntries(url.searchParams))
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 8)
      const total = url.searchParams.get('status') ? 1 : 12
      const data = Array.from({ length: Math.min(limit, Math.max(0, total - offset)) }, (_, i) => ({ sale_id: `sale-${offset + i}`, sale_number: `POS-${offset + i + 1}`, created_at: '2026-10-04T08:00:00Z', total_amount: 500, item_count: 1, payment_method: 'cash', status: 'completed', payment_status: 'verified' }))
      return res.end(JSON.stringify({ data, pagination: { total } }))
    }
    res.setHeader('Content-Type', 'text/html'); res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []
    await page.addInitScript(() => {
      window.printedReceipts = []
      window.open = () => {
        let html = ''
        return { document: { open() {}, write(value) { html += value }, close() {} }, focus() {}, print() { window.printedReceipts.push(html) } }
      }
    })
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByText('POS Orders Today', { exact: true }).waitFor()
    const productGrid = page.getByRole('button', { name: 'Add Guitar Strings', exact: true }).locator('..').locator('..')
    assert.equal(await productGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 4)
    assert.equal(await page.getByPlaceholder('Customer name').count(), 0)
    await page.getByRole('button', { name: 'Add Guitar Strings', exact: true }).click()
    await page.getByRole('button', { name: 'View All Orders', exact: true }).first().click()
    const dialog = page.getByRole('region', { name: 'All POS Orders' })
    await dialog.getByText('POS-10', { exact: true }).waitFor()
    assert.equal(await dialog.locator('tbody tr').count(), 10)
    await dialog.getByRole('button', { name: 'Next', exact: true }).click()
    await dialog.getByText('POS-12', { exact: true }).waitFor()
    assert.equal(await dialog.locator('tbody tr').count(), 2)
    await dialog.getByLabel('Status', { exact: true }).selectOption('completed')
    await dialog.getByText('POS-1', { exact: true }).waitFor()
    assert.equal(await dialog.locator('tbody tr').count(), 1)
    assert.ok(requests.some(params => params.status === 'completed' && params.offset === '0'))
    await dialog.getByRole('searchbox', { name: 'Search POS orders' }).fill('POS-1')
    await page.waitForResponse(response => response.url().includes('search=POS-1'))
    assert.ok(requests.some(params => params.search === 'POS-1' && params.offset === '0'))
    await dialog.getByRole('searchbox', { name: 'Search POS orders' }).fill('')
    await dialog.getByLabel('From', { exact: true }).fill('2026-10-04')
    await dialog.getByLabel('To', { exact: true }).fill('2026-10-04')
    await page.waitForFunction(() => !document.body.textContent.includes('Loading orders...'))
    assert.ok(requests.some(params => params.startDate === '2026-10-04T00:00:00+08:00' && params.endDate === '2026-10-04T16:00:00.000Z'))
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Add Guitar Strings', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Back to POS', exact: true }).click()
    await page.getByPlaceholder('Cash received', { exact: true }).fill('1000')
    await page.getByRole('button', { name: 'Place Order', exact: true }).click()
    await page.waitForFunction(() => document.body.textContent.includes('Add products from the left panel.'))
    assert.equal(sales.length, 1)
    assert.equal(sales[0].totalAmount, 500)
    assert.equal(sales[0].cashReceived, 1000)
    assert.equal(sales[0].items[0].quantity, 1)
    await page.getByRole('heading', { name: 'Do you want to print receipt?' }).waitFor()
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await page.getByRole('heading', { name: 'Do you want to print receipt?' }).waitFor({ state: 'hidden' })
    assert.equal(await page.evaluate(() => window.printedReceipts.length), 0)
    await page.getByRole('button', { name: 'Add Guitar Strings', exact: true }).click()
    await page.getByPlaceholder('Cash received', { exact: true }).fill('1000')
    await page.getByRole('button', { name: 'Place Order', exact: true }).click()
    await page.getByRole('button', { name: 'Yes, print receipt', exact: true }).click()
    await page.waitForFunction(() => window.printedReceipts.length === 1)
    assert.match(await page.evaluate(() => window.printedReceipts[0]), /Guitar Strings|Guitar<br\/>Strings/)
    assert.equal(sales.length, 2)
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await productGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await page.getByRole('button', { name: 'View All Orders', exact: true }).first().click()
    await dialog.getByRole('table').waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await dialog.getByLabel('Status', { exact: true }).selectOption('')
    await dialog.getByText('POS-10', { exact: true }).waitFor()
    for (const [index, action, reason] of [[0, 'void', 'Duplicate sale'], [1, 'return', 'Customer return']]) {
      const row = dialog.locator('tbody tr').nth(index)
      await row.getByRole('button', { name: 'View receipt', exact: true }).click()
      await page.getByRole('button', { name: action === 'void' ? 'Void' : 'Return', exact: true }).click()
      const confirm = page.getByRole('button', { name: action === 'void' ? 'Confirm Void' : 'Confirm Return', exact: true })
      await confirm.click()
      assert.equal(adjustments.length, index, 'a reason is required')
      await page.getByPlaceholder(action === 'void' ? 'Why is this transaction being voided?' : 'Why is this transaction being returned?').fill(reason)
      if (action === 'return') {
        await confirm.click()
        assert.equal(adjustments.length, index, 'an item condition is required')
        await page.getByRole('button', { name: 'Perfect / Resalable', exact: true }).click()
      }
      const submitted = page.waitForResponse(response => response.url().endsWith(`/${action}`) && response.request().method() === 'POST')
      await confirm.click()
      await submitted
      await page.getByRole('heading', { name: 'Receipt', exact: true }).waitFor({ state: 'hidden' })
      assert.deepEqual(adjustments[index], {
        saleId: `sale-${index}`, action,
        body: action === 'void' ? { reason } : { reason, items: [{ item_id: 'item-1', quantity: 1, item_condition: 'resalable' }] },
      })
      await row.getByRole('button', { name: 'View receipt', exact: true }).click()
      await page.getByRole('heading', { name: 'Receipt', exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Void', exact: true }).count(), 0)
      assert.equal(await page.getByRole('button', { name: 'Return', exact: true }).count(), 0)
      await page.getByRole('heading', { name: 'Receipt', exact: true }).locator('..').getByRole('button').click()
    }
    await page.getByRole('button', { name: 'Back to POS', exact: true }).click()
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
