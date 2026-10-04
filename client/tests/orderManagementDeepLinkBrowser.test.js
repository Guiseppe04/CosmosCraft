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

test('order management reflects a dashboard payment deep-link and clears back to normal filtering', async () => {
  const css = await postcss([tailwindcss({ content: ['./src/app/components/admin/OrderManagement.jsx'] }), autoprefixer]).process(
    (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, ''), { from: undefined })
  const fixture = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {ThemeProvider} from './src/app/context/ThemeContext.jsx';
      import {OrderManagement} from './src/app/components/admin/OrderManagement.jsx';
      window.queries=[]; window.apiCalls=[];
      const onRefresh=async params=>{window.queries.push(params||{}); return {data:{orders:[],pagination:{total:0,page:1,page_size:10,total_pages:1}}}};
      const root=createRoot(document.getElementById('root'));
      window.renderOM=(payment='for_verification',status='all')=>root.render(<ThemeProvider><OrderManagement orders={[]} onRefresh={onRefresh} user={{first_name:'Alex',email:'a@b.test'}} pagination={{}} loading={false} initialPaymentStatusFilter={payment} initialStatusFilter={status} /></ThemeProvider>);
      window.renderOM();`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', jsx: 'automatic', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'order-mgmt-fixture', setup(builder) {
      builder.onLoad({ filter: /SocketContext\\.jsx$/ }, () => ({ loader: 'js', contents: 'export const useSocketEvent=()=>{}; export const useSocket=()=>({socket:null});' }))
      builder.onLoad({ filter: /adminApi\\.js$/ }, () => ({
        loader: 'js',
        contents: `export const adminApi=new Proxy({}, {get:(_,m)=>(...args)=>{window.apiCalls.push({method:m});return Promise.resolve({data:[]});}});`,
      }))
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
    await page.goto(`http://127.0.0.1:${server.address().port}`)

    // Deep-link notice appears and the initial fetch carries the grouped filter.
    await page.getByText('opened from the Dashboard.').waitFor()
    assert.ok((await page.evaluate(() => window.queries.some(q => q.payment_status === 'for_verification'))),
      'expected initial fetch to send payment_status for_verification')

    // The payment status dropdown reflects the applied filter.
    await page.getByRole('button', { name: 'Sort & Filter' }).click()
    const paymentSelect = page.locator('select').filter({ has: page.locator('option:has-text("Awaiting verification")') })
    assert.equal(await paymentSelect.inputValue(), 'for_verification')
    assert.equal(await paymentSelect.locator('option:checked').innerText(), 'Awaiting verification')

    // Clearing the deep-link notice resets the filter and the next fetch is unfiltered.
    await page.getByRole('button', { name: 'Clear filter' }).click()
    await page.waitForFunction(() => window.queries.length >= 2)
    const last = await page.evaluate(() => window.queries.at(-1))
    assert.ok(!('payment_status' in last), 'expected the cleared query to omit payment_status')
    assert.equal(await paymentSelect.inputValue(), 'all')

    // A normal (unfiltered) mount shows no deep-link notice.
    await page.evaluate(() => window.renderOM('all', 'all'))
    await page.waitForFunction(() => !document.body.textContent.includes('opened from the Dashboard.'))
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})