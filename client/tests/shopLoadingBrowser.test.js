import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

test('shop skeletons, friendly errors, retry, and background refresh on desktop and mobile', async () => {
  const fixture = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {MemoryRouter} from 'react-router'; import {ShopPage} from './src/app/pages/ShopPage.jsx';
      window.socketHandlers={};
      createRoot(document.getElementById('root')).render(<MemoryRouter><ShopPage/></MemoryRouter>);`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'shop-context-fixture', setup(builder) {
      builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }))
      builder.onLoad({ filter: /CartContext\.jsx$/ }, () => ({ contents: `export const useCart=()=>({cart:[],addToCart:()=>true,isItemAtMaxQuantity:()=>false,getItemAddedState:()=>false});` }))
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ contents: `export const useAuth=()=>({isAuthenticated:false,openLogin:()=>{}});` }))
      builder.onLoad({ filter: /SocketContext\.jsx$/ }, () => ({ contents: `import {useEffect} from 'react'; export function useSocketEvent(event,handler){useEffect(()=>{window.socketHandlers[event]=handler;return()=>delete window.socketHandlers[event]},[event,handler]);}` }))
      builder.onLoad({ filter: /ProductRatingModal\.jsx$/ }, () => ({ contents: 'export const ProductRatingModal=()=>null;' }))
    } }],
  })
  const globals = (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, '')
  const shopCss = await readFile(new URL('../src/styles/ShopPage.css', import.meta.url), 'utf8')
  const css = await postcss([tailwindcss({ content: ['./src/app/pages/ShopPage.jsx'] }), autoprefixer]).process(globals + shopCss, { from: undefined })
  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles.find(file => file.path.endsWith('.js'))?.text || fixture.outputFiles[0].text) }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css.css) }
    res.setHeader('Content-Type', 'text/html')
    res.end('<html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      let mode = 'network'
      let release
      let gate = new Promise(resolve => { release = resolve })
      const product = { product_id: 'guitar', name: 'Test Guitar', brand: 'Cosmos', price: 1200, stock: 3, is_active: true }
      await page.route('**/api/products**', async route => {
        const currentMode = mode
        await gate
        if (currentMode === 'network') return route.abort('failed')
        if (currentMode === 'server') return route.fulfill({ status: 500, json: { message: 'Internal database failure' } })
        const categories = route.request().url().includes('/categories')
        return route.fulfill({ json: categories ? [] : { data: currentMode === 'empty' ? [] : [product], pagination: { totalPages: 1 } } })
      })
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      const grid = page.locator(width >= 1024 ? 'section.hidden .shop-grid' : 'section.lg\\:hidden .shop-grid')
      await grid.locator('.shop-product-skeleton').first().waitFor()
      assert.equal(await grid.locator('.shop-product-skeleton').count(), 6)
      assert.equal(await grid.getByRole('status').innerText(), 'Loading products…')
      assert.equal(await grid.getAttribute('aria-busy'), 'true')
      assert.equal(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), width >= 1024 ? 3 : 2)
      const skeleton = grid.locator('.shop-skeleton-block').first()
      assert.equal(await skeleton.evaluate(el => getComputedStyle(el).animationName), 'shop-skeleton-pulse')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assert.equal(await skeleton.evaluate(el => getComputedStyle(el).animationName), 'none')
      await page.evaluate(() => document.documentElement.dataset.theme = 'light')
      assert.notEqual(await skeleton.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
      const search = page.getByPlaceholder(width >= 1024 ? 'Search our catalog...' : 'Search...', { exact: true }).filter({ visible: true })
      await search.fill('Test')
      release()
      const retry = page.getByRole('button', { name: 'Try again' }).filter({ visible: true })
      await retry.waitFor()
      assert.equal(await page.getByRole('alert').filter({ visible: true }).innerText(), 'We couldn’t load the products right now. Please try again.')
      assert.equal(await page.getByText('No products found').count(), 0)
      assert.equal(await page.getByText('Failed to fetch', { exact: true }).count(), 0)
      mode = 'server'
      gate = new Promise(resolve => { release = resolve })
      await retry.focus()
      await page.keyboard.press('Enter')
      await grid.locator('.shop-product-skeleton').first().waitFor()
      assert.equal(await search.inputValue(), 'Test')
      release()
      await retry.waitFor()
      assert.equal(await page.getByText('Internal database failure').count(), 0)
      mode = 'success'
      gate = new Promise(resolve => { release = resolve })
      await retry.click()
      await grid.locator('.shop-product-skeleton').first().waitFor()
      release()
      await grid.getByText('Test Guitar', { exact: true }).waitFor()
      assert.equal(await grid.locator('.shop-product-skeleton').count(), 0)
      assert.equal(await retry.count(), 0)
      assert.equal(await search.inputValue(), 'Test')
      mode = 'server'
      gate = new Promise(resolve => { release = resolve })
      await page.evaluate(() => window.socketHandlers['product:updated']())
      await page.waitForFunction(() => [...document.querySelectorAll('.shop-grid')].some(el => el.getAttribute('aria-busy') === 'true'))
      assert.equal(await grid.getByText('Test Guitar', { exact: true }).isVisible(), true)
      assert.equal(await grid.locator('.shop-product-skeleton').count(), 0)
      release()
      await retry.waitFor()
      assert.equal(await grid.getByText('Test Guitar', { exact: true }).isVisible(), true)
      mode = 'empty'
      await retry.click()
      await grid.getByText('No products found', { exact: true }).waitFor()
      assert.deepEqual(errors, [])
      await page.close()
    }
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
