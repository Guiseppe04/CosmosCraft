import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

test('admin must enter a shipping quote and customers see the separate fee', async () => {
  const fixture = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {OrderManagement} from './src/app/components/admin/OrderManagement.jsx';
        import {ShippingFeeNotice} from './src/app/components/ShippingFeeNotice.jsx';
        const order={order_id:'order-1',order_number:'ORD-1',status:'processing',payment_status:'approved',total_amount:1000,subtotal:1000,items:[]};
        window.apiCalls=[];
        createRoot(document.getElementById('root')).render(<OrderManagement orders={[order]} initialOrder={order} user={{}} pagination={{}} onRefresh={async()=>({data:{orders:[order]}})} />);
        const customerRoot=createRoot(document.getElementById('customer'));
        window.renderCustomerFee=(fee)=>customerRoot.render(<ShippingFeeNotice fee={fee}/>);`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx',
    },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', jsx: 'automatic', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'shipping-fixture', setup(builder) {
      builder.onLoad({ filter: /SocketContext\.jsx$/ }, () => ({ loader: 'js', contents: 'export const useSocketEvent=()=>{}; export const useSocket=()=>({socket:null});' }))
      builder.onLoad({ filter: /adminApi\.js$/ }, () => ({ loader: 'js', contents: `export const adminApi=new Proxy({}, {get:(_,method)=>(...args)=>{window.apiCalls.push({method,args});return Promise.resolve({data:{}})}});` }))
    } }],
  })
  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles[0].text) }
    res.setHeader('Content-Type', 'text/html')
    res.end('<div id="root"></div><div id="customer"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('button', { name: 'Update Order Status', exact: true }).click()
    await page.getByRole('button', { name: 'Shipped', exact: true }).click()
    await page.getByPlaceholder('Enter tracking number').fill('TRACK123')
    const update = page.getByRole('button', { name: 'Update Order Status', exact: true }).last()
    assert.equal(await update.isDisabled(), true)
    const fee = page.getByRole('spinbutton', { name: /Additional shipping fee/ })
    await fee.fill('-1')
    assert.equal(await update.isDisabled(), true)
    await fee.fill('250.751')
    assert.equal(await update.isDisabled(), true)
    await fee.fill('0')
    assert.equal(await update.isEnabled(), true)
    await fee.fill('250.75')
    await update.click()
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await page.waitForFunction(() => window.apiCalls.some(call => call.method === 'updateOrder'))
    const call = await page.evaluate(() => window.apiCalls.find(call => call.method === 'updateOrder'))
    assert.deepEqual(call.args, ['order-1', { status: 'shipped', tracking_number: 'TRACK123', additional_shipping_fee: 250.75 }])
    await page.getByRole('button', { name: 'View Details', exact: true }).click()
    await page.getByText('₱250.75', { exact: true }).waitFor()
    await page.evaluate(() => window.renderCustomerFee(250.75))
    const customer = page.locator('#customer')
    await customer.getByText('₱250.75', { exact: true }).waitFor()
    assert.match(await customer.innerText(), /paid separately/)
    assert.match(await customer.innerText(), /shouldered by the customer/)
    await page.evaluate(() => window.renderCustomerFee('0.00'))
    await customer.getByText('₱0.00', { exact: true }).waitFor()
    await page.evaluate(() => window.renderCustomerFee(null))
    await page.waitForFunction(() => !document.getElementById('customer').innerText.includes('₱'))
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
