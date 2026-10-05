import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

test('checkout survives cart empty/refill transitions and completes a multiple-item order', async () => {
  const items = [
    { cart_item_id: 11, id: 'guitar', name: 'Guitar', price: 12000, quantity: 2, stock: 5, type: 'product' },
    { cart_item_id: 12, id: 'strings', name: 'Strings', price: 500, quantity: 3, stock: 10, type: 'product' },
  ]
  const fixture = await build({
    stdin: { contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {createMemoryRouter, RouterProvider} from 'react-router';
      import {CheckoutPage} from './src/app/pages/CheckoutPage.jsx';
      import {TestCartProvider} from './src/app/context/CartContext.jsx';
      const router = createMemoryRouter([
        {path:'/checkout', element:<CheckoutPage />},
        {path:'/dashboard', element:<h1>My Purchases</h1>}
      ], {initialEntries:[{pathname:'/checkout', state:{cartItemIds:[11,12]}}]});
      createRoot(document.getElementById('root')).render(<TestCartProvider><RouterProvider router={router} /></TestCartProvider>);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'isolated-checkout-accounts', setup(builder) {
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ loader: 'js', contents: `
        const user = {id:'customer', name:{firstName:'Test',lastName:'Customer'}, addresses:[{
          address_id:'11111111-1111-4111-8111-111111111111', street_line1:'123 Test Street',
          city:'Manila', province:'Metro Manila', postal_code:'1000', country:'PH', is_default:true
        }]};
        export const useAuth = () => ({isAuthenticated:true,user});
      ` }))
      builder.onLoad({ filter: /CartContext\.jsx$/ }, () => ({ loader: 'jsx', contents: `
        import React, {createContext, useContext, useState, useCallback} from 'react';
        const Context = createContext(null);
        export function TestCartProvider({children}) {
          const [cart,setCart] = useState(window.testCart);
          window.replaceCart = setCart;
          const refreshCart = useCallback(async () => {
            setCart([]);
            await new Promise(resolve=>setTimeout(resolve,30));
          },[]);
          return <Context.Provider value={{cart, refreshCart, selectedItemIds:null, setSelectedItemIds:()=>{},
            getSelectedItemIds:()=>cart.map(item=>String(item.id)), waitForCartUpdates:async()=>true
          }}>{children}</Context.Provider>;
        }
        export const useCart = () => useContext(Context);
      ` }))
    } }],
  })
  const orders = []
  const removed = []
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(fixture.outputFiles[0].text)
    }
    if (req.url === '/api/cart/prepare-checkout') return res.end(JSON.stringify({data:{
      cart:{items:items.map(item=>({cart_item_id:item.cart_item_id,quantity:item.quantity,unit_price:item.price,
        product:{product_id:item.id,name:item.name,stock:item.stock}}))}, checkout_data:{tax_rate:0},
    }}))
    if (req.url === '/api/orders') {
      let body = ''
      for await (const chunk of req) body += chunk
      orders.push(JSON.parse(body))
      return res.end(JSON.stringify({data:{order:{order_id:'order',total_amount:25500}}}))
    }
    if (req.method === 'DELETE' && req.url.startsWith('/api/cart/items/')) removed.push(req.url)
    if (req.url.startsWith('/api/')) return res.end(JSON.stringify({status:'success',data:{}}))
    res.setHeader('Content-Type', 'text/html')
    res.end(`<div id="root"></div><script>window.testCart=${JSON.stringify(items)}</script><script src="/bundle.js"></script>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({headless:true})
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error=>errors.push(error.message))
    page.on('console', message=>{if (message.type() === 'error') errors.push(message.text())})
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('button',{name:'Continue to Payment',exact:true}).waitFor()
    await page.evaluate(()=>window.replaceCart([]))
    await page.getByRole('heading',{name:'Your Cart is Empty',exact:true}).waitFor()
    await page.evaluate(()=>window.replaceCart(window.testCart))
    await page.getByRole('heading',{name:'Checkout',exact:true}).waitFor()
    await page.getByRole('checkbox',{name:'I have read and agree to the Order Terms and Conditions.'}).check()
    await page.getByRole('button',{name:'Continue to Payment',exact:true}).click()
    await page.locator('input[type=file]').setInputFiles({
      name:'receipt.png',mimeType:'image/png',
      buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'),
    })
    await page.getByRole('button',{name:/^Place Order/}).click()
    await page.getByRole('heading',{name:'Order Placed!',exact:true}).waitFor()
    assert.equal(await page.getByRole('heading',{name:'Your Cart is Empty',exact:true}).count(),0)
    assert.equal(orders.length,1)
    assert.deepEqual(orders[0].cartItemIds,[11,12])
    assert.deepEqual(removed.sort(),['/api/cart/items/11','/api/cart/items/12'])
    await page.getByRole('heading',{name:'My Purchases',exact:true}).waitFor()
    assert.equal(errors.filter(message=>/hooks|React Router caught|Unexpected Application Error/i.test(message)).length,0,errors.join('\n'))
  } finally {
    await browser?.close()
    await new Promise(resolve=>server.close(resolve))
  }
})
