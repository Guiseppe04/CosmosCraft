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

test('checkout separates order and customization terms and requires both for mixed selections', async () => {
  const css = await postcss([tailwindcss({ content: ['./src/app/pages/CheckoutPage.jsx', './src/app/components/CheckoutTermsAgreement.jsx', './src/app/components/TermsAndConditionsModal.jsx'] }), autoprefixer]).process(
    (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, ''), { from: undefined })
  const product = { cart_item_id: 11, id: 'strings', name: 'Strings', price: 500, quantity: 1, stock: 10, type: 'product' }
  const custom = { cart_item_id: 12, id: 'custom', name: 'Custom Guitar', price: 20000, quantity: 1, type: 'customization' }
  const fixture = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {createMemoryRouter,RouterProvider} from 'react-router';
      import {CheckoutPage} from './src/app/pages/CheckoutPage.jsx';
      import {TestCartProvider} from './src/app/context/CartContext.jsx';
      const router=createMemoryRouter([{path:'/checkout',element:<CheckoutPage/>}],{initialEntries:[{pathname:'/checkout',state:{cartItemIds:window.testCart.map(item=>item.cart_item_id)}}]});
      createRoot(document.getElementById('root')).render(<TestCartProvider><RouterProvider router={router}/></TestCartProvider>);`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'checkout-terms-fixture', setup(builder) {
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ loader: 'js', contents: `
        const user={id:'customer',addresses:[{address_id:'11111111-1111-4111-8111-111111111111',street_line1:'123 Test Street',city:'Manila',province:'Metro Manila',postal_code:'1000',country:'PH',is_default:true}]};
        export const useAuth=()=>({isAuthenticated:true,user});` }))
      builder.onLoad({ filter: /CartContext\.jsx$/ }, () => ({ loader: 'jsx', contents: `
        import React,{createContext,useContext,useState} from 'react'; const Context=createContext(null);
        export function TestCartProvider({children}) {
          const [selectedItemIds,setSelectedItemIds]=useState(null);
          const cart=window.testCart;
          window.selectItems=setSelectedItemIds;
          return <Context.Provider value={{cart,selectedItemIds,setSelectedItemIds,
            getSelectedItemIds:()=>selectedItemIds??cart.map(item=>String(item.id)),
            toggleItemSelection:id=>setSelectedItemIds(previous=>{const selected=previous??cart.map(item=>String(item.id));return selected.includes(id)?selected.filter(item=>item!==id):[...selected,id]}),
            waitForCartUpdates:async()=>true
          }}>{children}</Context.Provider>;
        }
        export const useCart=()=>useContext(Context);` }))
      builder.onLoad({ filter: /useSiteContact\.js$/ }, () => ({ loader: 'js', contents: `export const useSiteContact=()=>({email:'support@example.test'});` }))
    } }],
  })
  const server = createServer(async (req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles[0].text) }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css.css) }
    if (req.url === '/api/cart/prepare-checkout') {
      let body = ''; for await (const chunk of req) body += chunk
      const ids = JSON.parse(body).cart_item_ids.map(Number)
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ data: { cart: { items: [product, custom].filter(item => ids.includes(item.cart_item_id)).map(item => ({
        cart_item_id: item.cart_item_id, quantity: item.quantity, unit_price: item.price,
        ...(item.type === 'customization' ? { customization: { customization_id: item.id, name: item.name, config_json: {} } } : { product: { product_id: item.id, name: item.name, stock: item.stock } }),
      })) }, checkout_data: { tax_rate: 0 } } }))
    }
    if (req.url.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ data: {} })) }
    const mode = new URL(req.url, 'http://localhost').searchParams.get('mode')
    const items = mode === 'orders' ? [product] : mode === 'customization' ? [custom] : [product, custom]
    res.setHeader('Content-Type', 'text/html')
    res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script>window.testCart=${JSON.stringify(items)}</script><script src="/bundle.js"></script></html>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    const base = `http://127.0.0.1:${server.address().port}`
    for (const mode of ['orders', 'customization', 'mixed']) {
      await page.goto(`${base}/?mode=${mode}`)
      const hasOrders = mode !== 'customization', hasCustom = mode !== 'orders'
      const orderAgreement = page.getByRole('checkbox', { name: 'I have read and agree to the Order Terms and Conditions.', exact: true })
      const customAgreement = page.getByRole('checkbox', { name: 'I have read and agree to the Customization Terms and Conditions.', exact: true })
      const proceed = page.getByRole('button', { name: hasCustom ? 'Continue to Down Payment' : 'Continue to Payment', exact: true })
      await proceed.waitFor()
      const firstAgreement = hasOrders ? orderAgreement : customAgreement
      await firstAgreement.waitFor()
      assert.equal(await orderAgreement.count(), hasOrders ? 1 : 0)
      assert.equal(await customAgreement.count(), hasCustom ? 1 : 0)
      assert.equal(await proceed.isDisabled(), true)
      const title = hasOrders ? 'Order Terms and Conditions' : 'Customization Terms and Conditions'
      await page.getByRole('button', { name: title, exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('heading', { name: title, exact: true }).waitFor()
      assert.equal(await dialog.getByRole('heading', { name: /Down Payment and Remaining Balance/ }).count(), hasOrders ? 0 : 1)
      assert.match(await dialog.innerText(), /additional shipping fee/)
      if (mode === 'mixed') {
        await dialog.getByRole('tab', { name: 'Customization', exact: true }).click()
        await dialog.getByRole('heading', { name: 'Customization Terms and Conditions', exact: true }).waitFor()
        await dialog.getByRole('heading', { name: /Down Payment and Remaining Balance/ }).waitFor()
        assert.equal(await dialog.getByRole('heading', { name: /Order Details and Product Availability/ }).count(), 0)
      }
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 })
        assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), true)
        assert.equal(await dialog.evaluate(element => element.getBoundingClientRect().height <= window.innerHeight), true)
        assert.equal(await dialog.getByRole('button', { name: 'Close', exact: true }).isVisible(), true)
      }
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await firstAgreement.check()
      if (mode === 'mixed') {
        assert.equal(await proceed.isDisabled(), true)
        await page.getByRole('button', { name: 'Customization Terms and Conditions', exact: true }).click()
        await page.getByRole('dialog').getByRole('heading', { name: 'Customization Terms and Conditions', exact: true }).waitFor()
        await page.keyboard.press('Escape')
        await customAgreement.check()
      }
      assert.equal(await proceed.isEnabled(), true)
      if (mode === 'mixed') {
        await page.evaluate(() => window.selectItems(['strings']))
        await customAgreement.waitFor({ state: 'detached' })
        assert.equal(await orderAgreement.isChecked(), false)
        await page.evaluate(() => window.selectItems(['strings', 'custom']))
        await customAgreement.waitFor()
        assert.equal(await orderAgreement.isChecked(), false)
        assert.equal(await customAgreement.isChecked(), false)
        assert.equal(await proceed.isDisabled(), true)
      }
    }
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
